from pydantic import BaseModel, Field, model_validator


class AnalyzeRequest(BaseModel):
    name: str = Field(min_length=1, max_length=500, description="Selected or typed name")


class SourceOut(BaseModel):
    title: str
    url: str
    type: str


class EvidenceOut(BaseModel):
    source: SourceOut
    excerpt: str
    score: float
    retrieved_at: str


class ValueOut(BaseModel):
    value: str
    qualifier: str | None
    independent_sources: int
    evidence: list[EvidenceOut]


class ClaimOut(BaseModel):
    claim_type: str
    label: str
    disagreement: bool
    values: list[ValueOut]


class TermOut(BaseModel):
    term: str
    claims: list[ClaimOut]


class PartOut(BaseModel):
    text: str
    is_particle: bool


class ProviderErrorOut(BaseModel):
    provider: str
    message: str


class AnalyzeResponse(BaseModel):
    name: str
    parts: list[PartOut]
    scripts: dict[str, int]
    primary_script: str | None
    notes: list[str]
    ambiguous: bool
    status: str
    strength: str
    strength_explanation: str
    terms: list[TermOut]
    sources: list[SourceOut]
    provider_errors: list[ProviderErrorOut]
    providers_queried: list[str]
    input_changed: bool


class FeedbackIn(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    useful: bool | None = None
    pronunciation_correct: bool | None = None
    suggested_pronunciation: str | None = Field(default=None, max_length=200)
    suggestion: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _something_given(self):
        for attr in ("suggested_pronunciation", "suggestion"):
            v = getattr(self, attr)
            if v is not None:
                setattr(self, attr, v.strip() or None)
        if all(
            getattr(self, a) is None
            for a in ("useful", "pronunciation_correct", "suggested_pronunciation", "suggestion")
        ):
            raise ValueError("Provide at least one feedback field.")
        return self


class FeedbackOut(BaseModel):
    id: int
    delete_token: str


class SourceInfo(BaseModel):
    id: str
    name: str
    type: str
    url: str
    enabled: bool
    description: str
    caveat: str


class HealthOut(BaseModel):
    status: str
    version: str
    database: str
    providers: list[str]
