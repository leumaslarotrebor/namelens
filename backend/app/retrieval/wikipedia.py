"""Wikipedia provider: name-article introductions as encyclopedic evidence."""

from __future__ import annotations

import asyncio
import re

import httpx

from app.nameproc import ParsedName, fold
from app.retrieval.base import Evidence, ProviderResult, SourceRef

API = "https://en.wikipedia.org/w/api.php"
_SURNAME_RE = re.compile(r"\b(surname|family name|last name)\b", re.IGNORECASE)
_GIVEN_RE = re.compile(r"\b(given name|first name|forename)\b", re.IGNORECASE)


class WikipediaProvider:
    id = "wikipedia"

    def __init__(self, client: httpx.AsyncClient):
        self.client = client

    async def lookup(self, parsed: ParsedName) -> ProviderResult:
        try:
            batches = await asyncio.gather(*(self._term(t) for t in parsed.lookup_terms[:3]))
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            return ProviderResult(self.id, error=f"Wikipedia unavailable ({type(exc).__name__}).")
        return ProviderResult(self.id, [e for batch in batches for e in batch])

    async def _term(self, term: str) -> list[Evidence]:
        r = await self.client.get(
            API,
            params={
                "action": "query",
                "generator": "search",
                "gsrsearch": f"intitle:{term} name",
                "gsrlimit": 5,
                "prop": "extracts|info",
                "exintro": 1,
                "explaintext": 1,
                "exsentences": 2,
                "inprop": "url",
                "format": "json",
            },
        )
        r.raise_for_status()
        pages = r.json().get("query", {}).get("pages", {}).values()
        out: list[Evidence] = []
        for page in pages:
            title, extract = page.get("title", ""), (page.get("extract") or "").strip()
            m = re.fullmatch(r"(.+?)(?:\s*\((surname|given name|name|family name)\))?", title)
            if not m or fold(m.group(1)) != fold(term) or not extract:
                continue
            head = extract[:240]
            src = SourceRef("wikipedia", f"Wikipedia: {title}", page.get("fullurl", ""), "encyclopedia")
            if _SURNAME_RE.search(head):
                out.append(Evidence("name_kind", "family name", term, src, head))
            elif _GIVEN_RE.search(head):
                out.append(Evidence("name_kind", "given name", term, src, head))
        return out
