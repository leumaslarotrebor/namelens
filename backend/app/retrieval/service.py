"""Retrieval service: fan out to providers, rank, group by claim, assess evidence."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict
from dataclasses import dataclass, field

from app.nameproc import ParsedName, fold
from app.retrieval.base import Evidence, Provider, SourceRef

CLAIM_LABELS = {
    "name_kind": "Kind of name",
    "language": "Language / origin",
    "pronunciation": "Possible pronunciation (IPA)",
    "audio": "Pronunciation audio",
}
CLAIM_ORDER = list(CLAIM_LABELS)
REAL_SOURCE_TYPES = {"structured_database", "encyclopedia"}


@dataclass
class ValueGroup:
    value: str
    qualifier: str | None
    evidence: list[Evidence]

    @property
    def independent_sources(self) -> int:
        return len({e.source.id for e in self.evidence})

    @property
    def score(self) -> float:
        return round(max(e.score for e in self.evidence) + 0.1 * (self.independent_sources - 1), 3)


@dataclass
class ClaimGroup:
    claim_type: str
    label: str
    values: list[ValueGroup]
    disagreement: bool


@dataclass
class TermResult:
    term: str
    claims: list[ClaimGroup]


@dataclass
class Assessment:
    status: str  # ok | insufficient
    strength: str  # none | low | moderate
    explanation: str
    terms: list[TermResult] = field(default_factory=list)
    sources: list[SourceRef] = field(default_factory=list)
    provider_errors: list[dict] = field(default_factory=list)


def _claims_for(items_all: list[Evidence]) -> list[ClaimGroup]:
    claims: list[ClaimGroup] = []
    for ctype in CLAIM_ORDER:
        items = [e for e in items_all if e.claim_type == ctype]
        if not items:
            continue
        buckets: dict[tuple[str, str | None], list[Evidence]] = defaultdict(list)
        for e in items:
            bucket = buckets[(e.value, e.qualifier)]
            if not any(x.source.url == e.source.url for x in bucket):  # de-duplicate repeated source records
                bucket.append(e)
        values = sorted((ValueGroup(v, q, evs) for (v, q), evs in buckets.items()), key=lambda g: -g.score)
        # Regional variants are not a conflict; different values for the same qualifier are.
        per_qualifier: dict[str | None, set[str]] = defaultdict(set)
        for g in values:
            per_qualifier[g.qualifier].add(g.value)
        disagreement = ctype != "audio" and any(len(v) > 1 for v in per_qualifier.values())
        claims.append(ClaimGroup(ctype, CLAIM_LABELS[ctype], values, disagreement))
    return claims


def assess(evidence: list[Evidence], errors: list[dict], term_order: list[str] | None = None) -> Assessment:
    if not evidence:
        msg = "Insufficient reliable information found."
        if errors:
            msg += " Some sources could not be reached, so this may be incomplete."
        return Assessment("insufficient", "none", msg, provider_errors=errors)

    order = list(term_order or [])
    for e in evidence:
        if e.term not in order:
            order.append(e.term)
    terms = [
        TermResult(t, _claims_for([e for e in evidence if e.term == t]))
        for t in order
        if any(e.term == t for e in evidence)
    ]

    seen: dict[str, SourceRef] = {}
    for e in sorted(evidence, key=lambda e: -e.score):
        seen.setdefault(e.source.url, e.source)

    all_claims = [c for t in terms for c in t.claims]
    real = [e for e in evidence if e.source.type in REAL_SOURCE_TYPES]
    corroborated = any(
        not c.disagreement
        and c.claim_type != "audio"
        and any(len({e.source.id for e in g.evidence if e.source.type in REAL_SOURCE_TYPES}) >= 2 for g in c.values)
        for c in all_claims
    )
    conflicting = any(c.disagreement for c in all_claims)
    if corroborated and not conflicting:
        strength, why = "moderate", "At least one claim is stated by two independent sources that agree."
    elif not real:
        strength, why = "low", "Only demo fixture data was found; it is hand-entered and not independently verified."
    elif conflicting:
        strength, why = (
            "low",
            "Sources give different values, or the name has more than one use. Treat this as uncertain.",
        )
    else:
        strength, why = "low", "Each claim comes from a single source. Check the linked source before relying on it."
    return Assessment("ok", strength, why, terms, list(seen.values()), errors)


class RetrievalService:
    def __init__(self, providers: list[Provider], ttl: int = 3600, max_entries: int = 512):
        self.providers = providers
        self.ttl = ttl
        self.max_entries = max_entries
        self._cache: dict[str, tuple[float, Assessment]] = {}

    async def retrieve(self, parsed: ParsedName) -> Assessment:
        key = fold(parsed.normalized)
        hit = self._cache.get(key)
        if hit and time.monotonic() - hit[0] < self.ttl:
            return hit[1]
        results = await asyncio.gather(*(p.lookup(parsed) for p in self.providers), return_exceptions=True)
        evidence: list[Evidence] = []
        errors: list[dict] = []
        for provider, res in zip(self.providers, results, strict=True):
            if isinstance(res, Exception):
                errors.append({"provider": provider.id, "message": f"{provider.id} failed unexpectedly."})
                continue
            evidence.extend(res.evidence)
            if res.error:
                errors.append({"provider": res.provider, "message": res.error})
        assessment = assess(evidence, errors, parsed.lookup_terms)
        if not errors:  # never cache partial failures
            if len(self._cache) >= self.max_entries:
                self._cache.pop(next(iter(self._cache)))
            self._cache[key] = (time.monotonic(), assessment)
        return assessment
