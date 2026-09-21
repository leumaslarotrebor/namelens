"""Wikidata provider (public API, no key).

Looks up each term as a Wikidata item, keeps only items that are instances of a
name class (family name, given name, ...), and turns statements into evidence.
"""

from __future__ import annotations

import asyncio
from urllib.parse import quote

import httpx

from app.nameproc import ParsedName, fold
from app.retrieval.base import Evidence, ProviderResult, SourceRef

API = "https://www.wikidata.org/w/api.php"
NAME_CLASSES = {
    "Q101352": "family name",
    "Q202444": "given name",
    "Q11879590": "given name",
    "Q12308941": "given name",
    "Q3409032": "given name",
}


class WikidataProvider:
    id = "wikidata"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def _get(self, params: dict) -> dict:
        r = await self.client.get(API, params={**params, "format": "json"})
        r.raise_for_status()
        return r.json()

    async def lookup(self, parsed: ParsedName) -> ProviderResult:
        try:
            batches = await asyncio.gather(*(self._term(t) for t in parsed.lookup_terms[:3]))
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            return ProviderResult(self.id, error=f"Wikidata unavailable ({type(exc).__name__}).")
        return ProviderResult(self.id, [e for batch in batches for e in batch])

    async def _term(self, term: str) -> list[Evidence]:
        found = await self._get(
            {
                "action": "wbsearchentities",
                "search": term,
                "language": "en",
                "uselang": "en",
                "type": "item",
                "limit": 7,
            }
        )
        candidates = [
            r
            for r in found.get("search", [])
            if "name" in (r.get("description") or "").lower() and fold(r.get("label", "")) == fold(term)
        ]
        if not candidates:
            return []
        ids = "|".join(c["id"] for c in candidates)
        data = await self._get(
            {"action": "wbgetentities", "ids": ids, "props": "claims|descriptions", "languages": "en"}
        )
        entities = data.get("entities", {})

        # Resolve language labels in one extra call.
        lang_ids: set[str] = set()
        for ent in entities.values():
            for stmt in ent.get("claims", {}).get("P407", []):
                qid = _entity_id(stmt)
                if qid:
                    lang_ids.add(qid)
        lang_labels: dict[str, str] = {}
        if lang_ids:
            lab = await self._get(
                {"action": "wbgetentities", "ids": "|".join(sorted(lang_ids)), "props": "labels", "languages": "en"}
            )
            lang_labels = {
                k: v.get("labels", {}).get("en", {}).get("value", k) for k, v in lab.get("entities", {}).items()
            }

        out: list[Evidence] = []
        for qid, ent in entities.items():
            claims = ent.get("claims", {})
            kinds = [NAME_CLASSES[q] for s in claims.get("P31", []) if (q := _entity_id(s)) in NAME_CLASSES]
            if not kinds:
                continue
            desc = ent.get("descriptions", {}).get("en", {}).get("value", "Wikidata item")
            src = SourceRef(
                "wikidata", f"Wikidata {qid}: {term}", f"https://www.wikidata.org/wiki/{qid}", "structured_database"
            )
            excerpt = f"Wikidata item description: “{desc}”."
            for kind in dict.fromkeys(kinds):
                out.append(Evidence("name_kind", kind, term, src, excerpt))
            for s in claims.get("P407", []):
                lq = _entity_id(s)
                if lq:
                    out.append(Evidence("language", lang_labels.get(lq, lq), term, src, excerpt))
            for s in claims.get("P898", []):
                val = s.get("mainsnak", {}).get("datavalue", {}).get("value")
                if isinstance(val, str):
                    out.append(
                        Evidence(
                            "pronunciation",
                            f"/{val.strip('/[]')}/",
                            term,
                            src,
                            "IPA transcription statement (P898) on the Wikidata item.",
                        )
                    )
            for s in claims.get("P443", []):
                val = s.get("mainsnak", {}).get("datavalue", {}).get("value")
                if isinstance(val, str):
                    url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + quote(val.replace(" ", "_"))
                    out.append(
                        Evidence("audio", url, term, src, "Pronunciation audio (P443) linked from the Wikidata item.")
                    )
        return out


def _entity_id(statement: dict) -> str | None:
    value = statement.get("mainsnak", {}).get("datavalue", {}).get("value")
    return value.get("id") if isinstance(value, dict) else None
