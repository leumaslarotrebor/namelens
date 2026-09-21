from tests.conftest import WIKIDATA, WIKIPEDIA, FakeProvider, ev


def analyze(client, name):
    return client.post("/api/v1/analyze", json={"name": name})


def test_analyze_returns_claims_with_sources_and_evidence(make_client):
    c = make_client(
        FakeProvider("a", [ev("name_kind", "family name", source=WIKIDATA)]),
        FakeProvider("b", [ev("name_kind", "family name", source=WIKIPEDIA)]),
    )
    r = analyze(c, "  García ")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "García" and body["strength"] == "moderate"
    value = body["terms"][0]["claims"][0]["values"][0]
    assert value["value"] == "family name" and len(value["evidence"]) == 2
    assert {s["url"] for s in body["sources"]} == {WIKIDATA.url, WIKIPEDIA.url}


def test_analyze_no_results_says_insufficient(make_client):
    body = analyze(make_client(FakeProvider()), "Zzyzx").json()
    assert body["status"] == "insufficient" and body["terms"] == [] and body["sources"] == []
    assert body["strength_explanation"].startswith("Insufficient reliable information found.")


def test_analyze_reports_provider_failure_without_failing_request(make_client):
    body = analyze(make_client(FakeProvider(error="Wikidata unavailable (ConnectError).")), "García").json()
    assert body["provider_errors"][0]["message"].startswith("Wikidata unavailable")


def test_analyze_survives_crashing_provider(make_client):
    r = analyze(make_client(FakeProvider(boom=True)), "García")
    assert r.status_code == 200 and r.json()["provider_errors"]


def test_analyze_ambiguous_name_flagged(make_client):
    body = analyze(make_client(FakeProvider()), "山田太郎").json()
    assert body["ambiguous"] and body["primary_script"] == "HAN"


def test_analyze_unicode_roundtrip(make_client):
    assert analyze(make_client(FakeProvider()), "Nguyễn Thị Minh Khai").json()["name"] == "Nguyễn Thị Minh Khai"


def test_analyze_empty_name_structured_422(make_client):
    r = analyze(make_client(FakeProvider()), "   ")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_name" and r.json()["error"]["details"]["reason"] == "empty"


def test_analyze_missing_field_structured_422(make_client):
    r = make_client(FakeProvider()).post("/api/v1/analyze", json={})
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_request"


def test_analyze_very_long_input_rejected(make_client):
    assert analyze(make_client(FakeProvider()), "a" * 5000).status_code == 422


def test_analyze_rejects_url(make_client):
    r = analyze(make_client(FakeProvider()), "https://evil.example")
    assert r.status_code == 422 and r.json()["error"]["details"]["reason"] == "not_a_name"


def test_unknown_route_uses_error_envelope(make_client):
    r = make_client(FakeProvider()).get("/api/v1/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_sources_lists_catalogue_with_caveats(make_client):
    body = make_client(FakeProvider()).get("/api/v1/sources").json()
    assert {s["id"] for s in body} == {"wikidata", "wikipedia", "demo"}
    assert all(s["caveat"] for s in body)


def test_health(make_client):
    body = make_client(FakeProvider("fake")).get("/api/v1/health").json()
    assert body == {"status": "ok", "version": "0.1.0", "database": "ok", "providers": ["fake"]}


def test_feedback_create_and_delete_with_token(make_client):
    c = make_client(FakeProvider())
    r = c.post(
        "/api/v1/feedback",
        json={
            "name": "Siobhán",
            "useful": True,
            "pronunciation_correct": False,
            "suggested_pronunciation": "shi-VAWN",
            "suggestion": " Irish ",
        },
    )
    assert r.status_code == 201
    fid, token = r.json()["id"], r.json()["delete_token"]
    assert c.delete(f"/api/v1/feedback/{fid}", headers={"X-Delete-Token": "wrong"}).status_code == 404
    assert c.delete(f"/api/v1/feedback/{fid}", headers={"X-Delete-Token": token}).status_code == 204
    assert c.delete(f"/api/v1/feedback/{fid}", headers={"X-Delete-Token": token}).status_code == 404


def test_feedback_stores_only_submitted_fields(make_client):
    from app.db import SessionLocal
    from app.models import Feedback

    c = make_client(FakeProvider())
    c.post("/api/v1/feedback", json={"name": " Siobhán  ", "suggestion": " x "}, headers={"User-Agent": "secret-agent"})
    with SessionLocal() as s:
        row = s.query(Feedback).one()
    assert (row.name, row.suggestion, row.useful) == ("Siobhán", "x", None)
    assert not any("agent" in col.name or "ip" == col.name for col in Feedback.__table__.columns)


def test_feedback_requires_some_content(make_client):
    r = make_client(FakeProvider()).post("/api/v1/feedback", json={"name": "García"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_request"


def test_feedback_rejects_overlong_suggestion_and_bad_name(make_client):
    c = make_client(FakeProvider())
    assert c.post("/api/v1/feedback", json={"name": "García", "suggestion": "x" * 501}).status_code == 422
    assert c.post("/api/v1/feedback", json={"name": "<b>", "useful": True}).status_code == 422


def test_analyze_reports_queried_providers_and_whether_input_was_normalised(make_client):
    c = make_client(FakeProvider("alpha"), FakeProvider("beta"))
    body = analyze(c, "Jose\u0301  Garcia").json()
    assert body["providers_queried"] == ["alpha", "beta"] and body["input_changed"] is True
    assert analyze(c, "José Garcia").json()["input_changed"] is False


def test_analyze_non_latin_scripts_round_trip(make_client):
    c = make_client(FakeProvider())
    for name, script in [
        ("சுப்பிரமணியன்", "TAMIL"),
        ("प्रिया शर्मा", "DEVANAGARI"),
        ("محمد بن سلمان", "ARABIC"),
        ("Иван Петров", "CYRILLIC"),
        ("김민수", "HANGUL"),
    ]:
        body = analyze(c, name).json()
        assert body["name"] == name and body["primary_script"] == script


def test_analyze_end_to_end_with_real_demo_provider_and_failing_network():
    """Real providers with an unreachable network: external providers degrade gracefully."""
    import httpx
    from fastapi.testclient import TestClient

    from app.config import Settings
    from app.main import build_retrieval, create_app

    def boom(_):
        raise httpx.ConnectError("offline")

    client = httpx.AsyncClient(transport=httpx.MockTransport(boom))
    app = create_app(Settings(), retrieval=build_retrieval(Settings(), client))
    with TestClient(app) as c:
        body = c.post("/api/v1/analyze", json={"name": "Siobhán"}).json()
    assert {e["provider"] for e in body["provider_errors"]} == {"wikidata", "wikipedia"}
    assert body["status"] == "ok" and body["strength"] == "low"
    assert all(s["type"] == "demo_fixture" for s in body["sources"])


def test_security_headers_are_set(make_client):
    r = make_client(FakeProvider()).get("/api/v1/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in r.headers["content-security-policy"]
    assert "script-src 'self'" in r.headers["content-security-policy"]
