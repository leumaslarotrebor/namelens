from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol

from app.nameproc import ParsedName

SOURCE_WEIGHTS = {"structured_database": 0.8, "encyclopedia": 0.7, "demo_fixture": 0.4}


@dataclass(frozen=True)
class SourceRef:
    id: str  # provider id, used to count independent sources
    title: str
    url: str
    type: str  # structured_database | encyclopedia | demo_fixture


@dataclass
class Evidence:
    claim_type: str  # name_kind | language | pronunciation | audio | description
    value: str
    term: str  # which part of the name this is about
    source: SourceRef
    excerpt: str
    qualifier: str | None = None  # e.g. a region: pronunciations that differ by region are not a conflict
    match: float = 1.0  # 1.0 = exact term match
    retrieved_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat(timespec="seconds"))

    @property
    def score(self) -> float:
        return round(SOURCE_WEIGHTS.get(self.source.type, 0.3) * self.match, 3)


@dataclass
class ProviderResult:
    provider: str
    evidence: list[Evidence] = field(default_factory=list)
    error: str | None = None


class Provider(Protocol):
    id: str

    async def lookup(self, parsed: ParsedName) -> ProviderResult: ...
