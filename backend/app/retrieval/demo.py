"""Offline demo provider.

A tiny hand-entered dataset so the app works without network access. Every item
is labelled "demo_fixture" in the UI and never counts as an independent source.
The entries are pointers to public references, not authoritative data.
"""

from __future__ import annotations

from app.nameproc import ParsedName, fold
from app.retrieval.base import Evidence, ProviderResult, SourceRef

_NOTE = "Hand-entered demo data; check the linked reference."

# term (folded) -> list of (claim_type, value, qualifier, page title)
_DATA: dict[str, list[tuple[str, str, str | None]]] = {
    "garcia": [
        ("name_kind", "family name", None),
        ("language", "Spanish", None),
        ("pronunciation", "/ɡaɾˈθi.a/", "Spain"),
        ("pronunciation", "/ɡaɾˈsi.a/", "Latin America"),
    ],
    "siobhan": [
        ("name_kind", "given name", None),
        ("language", "Irish", None),
        ("pronunciation", "/ʃɪˈvɔːn/", None),
    ],
    "niamh": [
        ("name_kind", "given name", None),
        ("language", "Irish", None),
        ("pronunciation", "/niːv/", None),
    ],
    "aoife": [
        ("name_kind", "given name", None),
        ("language", "Irish", None),
        ("pronunciation", "/ˈiːfə/", None),
    ],
}
_TITLES = {"garcia": "García", "siobhan": "Siobhán", "niamh": "Niamh", "aoife": "Aoife"}


class DemoProvider:
    id = "demo"

    async def lookup(self, parsed: ParsedName) -> ProviderResult:
        out: list[Evidence] = []
        for term in parsed.lookup_terms:
            key = fold(term)
            for claim_type, value, qualifier in _DATA.get(key, []):
                title = _TITLES[key]
                source = SourceRef(
                    id="demo",
                    title=f"Wiktionary: {title} (demo fixture)",
                    url=f"https://en.wiktionary.org/wiki/{title}",
                    type="demo_fixture",
                )
                out.append(Evidence(claim_type, value, term, source, _NOTE, qualifier))
        return ProviderResult(self.id, out)
