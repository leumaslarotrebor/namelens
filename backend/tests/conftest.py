import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.config import Settings  # noqa: E402
from app.db import Base, engine  # noqa: E402
from app.main import create_app  # noqa: E402
from app.retrieval.base import Evidence, ProviderResult, SourceRef  # noqa: E402
from app.retrieval.service import RetrievalService  # noqa: E402

WIKIDATA = SourceRef("wikidata", "Wikidata Q1", "https://www.wikidata.org/wiki/Q1", "structured_database")
WIKIPEDIA = SourceRef("wikipedia", "Wikipedia: García", "https://en.wikipedia.org/wiki/Garc%C3%ADa", "encyclopedia")


class FakeProvider:
    def __init__(self, id="fake", evidence=None, error=None, boom=False):
        self.id, self.evidence, self.error, self.boom, self.calls = id, evidence or [], error, boom, 0

    async def lookup(self, parsed):
        self.calls += 1
        if self.boom:
            raise RuntimeError("boom")
        return ProviderResult(self.id, list(self.evidence), self.error)


def ev(claim_type, value, term="García", source=WIKIDATA, qualifier=None):
    return Evidence(claim_type, value, term, source, "excerpt", qualifier)


@pytest.fixture(autouse=True)
def _fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


@pytest.fixture
def make_client():
    clients = []

    def _make(*providers):
        app = create_app(Settings(), retrieval=RetrievalService(list(providers)))
        c = TestClient(app)
        c.__enter__()
        clients.append(c)
        return c

    yield _make
    for c in clients:
        c.__exit__(None, None, None)
