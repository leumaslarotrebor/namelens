from __future__ import annotations

import hashlib
import logging
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import schemas
from app.config import Settings, get_settings
from app.db import Base, engine, get_db
from app.models import Feedback
from app.nameproc import NameValidationError, normalize_name, parse_name
from app.retrieval.demo import DemoProvider
from app.retrieval.service import RetrievalService
from app.retrieval.wikidata import WikidataProvider
from app.retrieval.wikipedia import WikipediaProvider

log = logging.getLogger("namelens")

CSP = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
    "media-src https://commons.wikimedia.org https://upload.wikimedia.org; connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
)

SOURCE_CATALOGUE = [
    (
        "wikidata",
        "Wikidata",
        "structured_database",
        "https://www.wikidata.org/",
        "Structured statements about names: name class, language of origin, IPA, audio.",
        "Crowd-edited. Coverage is uneven and most names have no pronunciation data.",
    ),
    (
        "wikipedia",
        "Wikipedia (English)",
        "encyclopedia",
        "https://en.wikipedia.org/",
        "Introductions of name articles, used as encyclopedic evidence about how a name is used.",
        "Crowd-edited and English-language only; describes usage, not how an individual pronounces their name.",
    ),
    (
        "demo",
        "Demo fixture",
        "demo_fixture",
        "https://en.wiktionary.org/",
        "A few hand-entered entries so the app works offline. Always labelled as demo data.",
        "Not independently verified and never counted as corroboration.",
    ),
]


def build_retrieval(settings: Settings, client: httpx.AsyncClient) -> RetrievalService:
    providers = []
    if settings.enable_wikidata:
        providers.append(WikidataProvider(client))
    if settings.enable_wikipedia:
        providers.append(WikipediaProvider(client))
    if settings.enable_demo_provider:
        providers.append(DemoProvider())
    return RetrievalService(providers, ttl=settings.cache_ttl_seconds)


def error_response(status: int, code: str, message: str, details=None) -> JSONResponse:
    body: dict = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return JSONResponse(status_code=status, content=body)


def to_response(parsed, assessment, providers: list[str]) -> schemas.AnalyzeResponse:
    terms = [
        schemas.TermOut(
            term=t.term,
            claims=[
                schemas.ClaimOut(
                    claim_type=c.claim_type,
                    label=c.label,
                    disagreement=c.disagreement,
                    values=[
                        schemas.ValueOut(
                            value=g.value,
                            qualifier=g.qualifier,
                            independent_sources=g.independent_sources,
                            evidence=[
                                schemas.EvidenceOut(
                                    source=schemas.SourceOut(
                                        title=e.source.title, url=e.source.url, type=e.source.type
                                    ),
                                    excerpt=e.excerpt,
                                    score=e.score,
                                    retrieved_at=e.retrieved_at,
                                )
                                for e in g.evidence
                            ],
                        )
                        for g in c.values
                    ],
                )
                for c in t.claims
            ],
        )
        for t in assessment.terms
    ]
    return schemas.AnalyzeResponse(
        name=parsed.normalized,
        parts=[schemas.PartOut(text=p.text, is_particle=p.is_particle) for p in parsed.parts],
        scripts=parsed.scripts,
        primary_script=parsed.primary_script,
        notes=parsed.notes,
        ambiguous=parsed.ambiguous,
        status=assessment.status,
        strength=assessment.strength,
        strength_explanation=assessment.explanation,
        terms=terms,
        sources=[schemas.SourceOut(title=s.title, url=s.url, type=s.type) for s in assessment.sources],
        provider_errors=[schemas.ProviderErrorOut(**e) for e in assessment.provider_errors],
        providers_queried=providers,
        input_changed=parsed.raw != parsed.normalized,
    )


def create_app(settings: Settings | None = None, retrieval: RetrievalService | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        Base.metadata.create_all(engine)
        client = httpx.AsyncClient(timeout=settings.http_timeout_seconds, headers={"User-Agent": settings.user_agent})
        if retrieval is None:
            app.state.retrieval = build_retrieval(settings, client)
        else:
            app.state.retrieval = retrieval
        yield
        await client.aclose()

    app = FastAPI(title="NameLens API", version=settings.app_version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["Content-Type", "X-Delete-Token"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Content-Security-Policy", CSP)
        return response

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        details = [{"field": ".".join(str(p) for p in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]
        return error_response(422, "invalid_request", "The request was not valid.", details)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = {404: "not_found", 403: "forbidden", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return error_response(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("unhandled error", exc_info=exc)
        return error_response(500, "internal_error", "Something went wrong on our side. Try again shortly.")

    @app.exception_handler(NameValidationError)
    async def _name(_: Request, exc: NameValidationError):
        return error_response(422, "invalid_name", exc.message, {"reason": exc.code})

    api = "/api/v1"

    @app.post(f"{api}/analyze", response_model=schemas.AnalyzeResponse)
    async def analyze(body: schemas.AnalyzeRequest, request: Request):
        parsed = parse_name(
            body.name,
            max_raw=settings.max_raw_length,
            max_len=settings.max_name_length,
            max_tokens=settings.max_name_tokens,
        )
        assessment = await request.app.state.retrieval.retrieve(parsed)
        return to_response(parsed, assessment, [p.id for p in request.app.state.retrieval.providers])

    @app.get(f"{api}/sources", response_model=list[schemas.SourceInfo])
    def sources():
        enabled = {
            "wikidata": settings.enable_wikidata,
            "wikipedia": settings.enable_wikipedia,
            "demo": settings.enable_demo_provider,
        }
        return [
            schemas.SourceInfo(id=i, name=n, type=t, url=u, enabled=enabled[i], description=d, caveat=c)
            for i, n, t, u, d, c in SOURCE_CATALOGUE
        ]

    @app.post(f"{api}/feedback", response_model=schemas.FeedbackOut, status_code=201)
    def feedback(body: schemas.FeedbackIn, db: Session = Depends(get_db)):
        name = normalize_name(
            body.name,
            max_raw=settings.max_raw_length,
            max_len=settings.max_name_length,
            max_tokens=settings.max_name_tokens,
        )
        token = secrets.token_urlsafe(24)
        row = Feedback(
            name=name,
            useful=body.useful,
            pronunciation_correct=body.pronunciation_correct,
            suggested_pronunciation=body.suggested_pronunciation,
            suggestion=body.suggestion,
            delete_token_hash=hashlib.sha256(token.encode()).hexdigest(),
        )
        db.add(row)
        db.commit()
        return schemas.FeedbackOut(id=row.id, delete_token=token)

    @app.delete(f"{api}/feedback/{{feedback_id}}", status_code=204)
    def delete_feedback(feedback_id: int, x_delete_token: str = Header(default=""), db: Session = Depends(get_db)):
        row = db.get(Feedback, feedback_id)
        supplied = hashlib.sha256(x_delete_token.encode()).hexdigest()
        if row is None or not secrets.compare_digest(row.delete_token_hash, supplied):
            raise HTTPException(status_code=404, detail="Feedback not found or token invalid.")
        db.delete(row)
        db.commit()

    @app.get(f"{api}/health", response_model=schemas.HealthOut)
    def health(request: Request, db: Session = Depends(get_db)):
        try:
            db.execute(text("SELECT 1"))
            database = "ok"
        except Exception:  # noqa: BLE001 - health must never raise
            database = "error"
        providers = [p.id for p in request.app.state.retrieval.providers]
        return schemas.HealthOut(
            status="ok" if database == "ok" else "degraded",
            version=settings.app_version,
            database=database,
            providers=providers,
        )

    dist = Path(settings.web_dist)
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=dist, html=True), name="web")
    return app


app = create_app()
