import httpx
import pytest

from app.nameproc import parse_name
from app.retrieval.demo import DemoProvider
from app.retrieval.service import RetrievalService
from app.retrieval.wikidata import WikidataProvider
from app.retrieval.wikipedia import WikipediaProvider
from tests.conftest import WIKIDATA, WIKIPEDIA, FakeProvider, ev


async def run(providers, name="García"):
    return await RetrievalService(providers).retrieve(parse_name(name))


async def test_no_evidence_is_insufficient_not_invented():
    a = await run([FakeProvider()])
    assert a.status == "insufficient" and a.strength == "none"
    assert a.explanation.startswith("Insufficient reliable information found.")
    assert a.terms == [] and a.sources == []


async def test_single_source_is_low_strength():
    a = await run([FakeProvider(evidence=[ev("name_kind", "family name")])])
    assert a.status == "ok" and a.strength == "low"


async def test_two_independent_agreeing_sources_is_moderate():
    a = await run(
        [
            FakeProvider("a", [ev("name_kind", "family name", source=WIKIDATA)]),
            FakeProvider("b", [ev("name_kind", "family name", source=WIKIPEDIA)]),
        ]
    )
    assert a.strength == "moderate"
    group = a.terms[0].claims[0].values[0]
    assert group.independent_sources == 2


async def test_disagreement_is_surfaced_and_caps_strength():
    a = await run(
        [
            FakeProvider("a", [ev("name_kind", "family name", source=WIKIDATA)]),
            FakeProvider("b", [ev("name_kind", "given name", source=WIKIPEDIA)]),
        ]
    )
    claim = a.terms[0].claims[0]
    assert claim.disagreement and len(claim.values) == 2
    assert a.strength == "low"


async def test_regional_pronunciations_are_not_a_disagreement():
    a = await run(
        [
            FakeProvider(
                evidence=[
                    ev("pronunciation", "/a/", qualifier="Spain"),
                    ev("pronunciation", "/b/", qualifier="Latin America"),
                ]
            )
        ]
    )
    assert not a.terms[0].claims[0].disagreement


async def test_different_terms_are_not_compared_against_each_other():
    a = await run(
        [
            FakeProvider(
                evidence=[ev("name_kind", "given name", term="Maria"), ev("name_kind", "family name", term="García")]
            )
        ],
        "Maria García",
    )
    assert [t.term for t in a.terms] == ["Maria", "García"]
    assert not any(c.disagreement for t in a.terms for c in t.claims)


async def test_demo_only_is_labelled_low_and_never_corroborated():
    a = await run([DemoProvider()], "Siobhán")
    assert a.strength == "low" and "demo" in a.explanation.lower()
    assert all(s.type == "demo_fixture" for s in a.sources)


async def test_provider_error_reported_and_not_cached():
    p = FakeProvider(error="Wikidata unavailable (ConnectError).")
    svc = RetrievalService([p])
    parsed = parse_name("García")
    a = await svc.retrieve(parsed)
    assert a.provider_errors and a.status == "insufficient" and "could not be reached" in a.explanation
    await svc.retrieve(parsed)
    assert p.calls == 2


async def test_crashing_provider_does_not_break_others_and_success_is_cached():
    good, bad = FakeProvider("good", [ev("language", "Spanish")]), FakeProvider("bad", boom=True)
    svc = RetrievalService([good, bad])
    a = await svc.retrieve(parse_name("García"))
    assert a.status == "ok" and a.provider_errors[0]["provider"] == "bad"
    svc2 = RetrievalService([FakeProvider("g", [ev("language", "Spanish")])])
    await svc2.retrieve(parse_name("García"))
    await svc2.retrieve(parse_name("GARCIA"))  # same folded key
    assert svc2.providers[0].calls == 1


def wikidata_transport(entity_claims, description="Spanish surname", label="García"):
    def handler(request: httpx.Request) -> httpx.Response:
        q = dict(request.url.params)
        if q["action"] == "wbsearchentities":
            return httpx.Response(
                200,
                json={
                    "search": [
                        {"id": "Q1", "label": label, "description": description},
                        {"id": "Q2", "label": label, "description": "Wikimedia disambiguation page"},
                    ]
                },
            )
        if q["action"] == "wbgetentities" and q.get("props") == "labels":
            return httpx.Response(200, json={"entities": {"Q1321": {"labels": {"en": {"value": "Spanish"}}}}})
        if q["action"] == "wbgetentities":
            assert q["ids"] == "Q1"  # disambiguation page filtered out before the second call
            return httpx.Response(
                200,
                json={"entities": {"Q1": {"claims": entity_claims, "descriptions": {"en": {"value": description}}}}},
            )
        return httpx.Response(400)

    return httpx.MockTransport(handler)


def stmt(value):
    return {"mainsnak": {"datavalue": {"value": value}}}


async def test_wikidata_provider_maps_statements_to_evidence():
    claims = {
        "P31": [stmt({"id": "Q101352"})],
        "P407": [stmt({"id": "Q1321"})],
        "P898": [stmt("ɡaɾˈsia")],
        "P443": [stmt("Es-García.ogg")],
    }
    async with httpx.AsyncClient(transport=wikidata_transport(claims)) as c:
        res = await WikidataProvider(c).lookup(parse_name("García"))
    got = {(e.claim_type, e.value) for e in res.evidence}
    assert ("name_kind", "family name") in got and ("language", "Spanish") in got
    assert ("pronunciation", "/ɡaɾˈsia/") in got
    assert any(e.claim_type == "audio" and e.value.endswith("Es-Garc%C3%ADa.ogg") for e in res.evidence)
    assert all(e.source.url == "https://www.wikidata.org/wiki/Q1" for e in res.evidence)


async def test_wikidata_ignores_items_that_are_not_name_classes():
    async with httpx.AsyncClient(transport=wikidata_transport({"P31": [stmt({"id": "Q5"})]})) as c:
        res = await WikidataProvider(c).lookup(parse_name("García"))
    assert res.evidence == [] and res.error is None


async def test_wikidata_network_failure_becomes_provider_error():
    def boom(_):
        raise httpx.ConnectError("no network")

    async with httpx.AsyncClient(transport=httpx.MockTransport(boom)) as c:
        res = await WikidataProvider(c).lookup(parse_name("García"))
    assert res.evidence == [] and "unavailable" in res.error


async def test_wikidata_http_500_becomes_provider_error():
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(500))) as c:
        res = await WikidataProvider(c).lookup(parse_name("García"))
    assert res.error


async def test_wikipedia_provider_classifies_surname_and_given_name_articles():
    def handler(request):
        return httpx.Response(
            200,
            json={
                "query": {
                    "pages": {
                        "1": {
                            "title": "García",
                            "fullurl": "https://en.wikipedia.org/wiki/Garc%C3%ADa",
                            "extract": "García is a Spanish surname.",
                        },
                        "2": {"title": "Garcia (band)", "fullurl": "x", "extract": "A surname band."},
                    }
                }
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as c:
        res = await WikipediaProvider(c).lookup(parse_name("García"))
    assert [(e.claim_type, e.value) for e in res.evidence] == [("name_kind", "family name")]
    assert res.evidence[0].source.type == "encyclopedia"


@pytest.mark.parametrize("name", ["Siobhán", "siobhan", "SIOBHAN"])
async def test_demo_provider_matches_regardless_of_case_and_accents(name):
    res = await DemoProvider().lookup(parse_name(name))
    assert any(e.claim_type == "pronunciation" for e in res.evidence)


async def test_demo_provider_returns_nothing_for_unknown_name():
    res = await DemoProvider().lookup(parse_name("Zzyzx Qwerty"))
    assert res.evidence == []


async def test_duplicate_source_records_are_deduplicated():
    a = await run([FakeProvider(evidence=[ev("name_kind", "family name"), ev("name_kind", "family name")])])
    group = a.terms[0].claims[0].values[0]
    assert len(group.evidence) == 1 and len(a.sources) == 1


async def test_higher_weighted_source_ranks_first_and_sources_are_ordered_by_score():
    from app.retrieval.base import SourceRef

    demo = SourceRef("demo", "Demo", "https://demo.example/x", "demo_fixture")
    a = await run(
        [
            FakeProvider("a", [ev("pronunciation", "/x/", source=demo)]),
            FakeProvider("b", [ev("pronunciation", "/y/", source=WIKIDATA)]),
        ]
    )
    values = a.terms[0].claims[0].values
    assert [v.value for v in values] == ["/y/", "/x/"] and a.sources[0].url == WIKIDATA.url
