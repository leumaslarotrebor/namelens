"""Unicode-aware name processing.

Pipeline: validate -> strip control chars -> NFC -> whitespace normalisation ->
tokenise -> script detection -> ambiguity notes.

The parser deliberately does NOT try to decide which token is the given name and
which is the family name: naming conventions differ across cultures, so it
reports what it can observe and flags what it cannot know.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field

# Zero-width joiners are meaningful in Indic and Persian scripts, so keep them.
_KEEP_FORMAT_CHARS = {"\u200c", "\u200d"}
_WHITESPACE_RE = re.compile(r"\s+", re.UNICODE)
_SUSPICIOUS_RE = re.compile(r"(https?://|www\.|@|[<>{}\\|\[\]`])", re.IGNORECASE)

PARTICLES = {
    "de",
    "del",
    "della",
    "di",
    "da",
    "dos",
    "das",
    "do",
    "van",
    "von",
    "der",
    "den",
    "la",
    "le",
    "el",
    "al",
    "bin",
    "ibn",
    "bint",
    "ben",
    "ap",
    "ter",
    "ten",
    "du",
    "y",
    "\u0628\u0646",  # Arabic bin
    "\u0627\u0628\u0646",  # ibn
    "\u0628\u0646\u062a",  # bint
}
_ORDER_SCRIPTS = {"HAN", "HANGUL", "HIRAGANA", "KATAKANA"}


class NameValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class NamePart:
    text: str
    is_particle: bool = False


@dataclass
class ParsedName:
    raw: str
    normalized: str
    parts: list[NamePart]
    scripts: dict[str, int]
    primary_script: str | None
    notes: list[str] = field(default_factory=list)
    ambiguous: bool = False

    @property
    def lookup_terms(self) -> list[str]:
        """Terms worth looking up: whole name plus each non-particle token."""
        terms: list[str] = []
        content = [p.text for p in self.parts if not p.is_particle]
        if len(self.parts) > 1:
            terms.append(self.normalized)
        for token in content:
            for piece in re.split(r"[-\u2010\u2011]", token):
                piece = piece.strip("'\u2019.,")
                if piece and piece not in terms:
                    terms.append(piece)
        return terms[:4] if terms else [self.normalized]


def fold(text: str) -> str:
    """Case- and diacritic-insensitive key used for matching only (never displayed)."""
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    stripped = "".join(c for c in decomposed if not unicodedata.category(c).startswith("M"))
    return unicodedata.normalize("NFC", stripped).replace("\u2019", "'")


def script_of(char: str) -> str | None:
    if not unicodedata.category(char).startswith("L"):
        return None
    try:
        word = unicodedata.name(char).split()[0]
    except ValueError:
        return None
    return "HAN" if word == "CJK" else word


def _clean(raw: str) -> str:
    kept = []
    for ch in raw:
        cat = unicodedata.category(ch)
        if cat == "Cc" and not ch.isspace():
            continue
        if cat == "Cf" and ch not in _KEEP_FORMAT_CHARS:
            continue
        kept.append(ch)
    text = unicodedata.normalize("NFC", "".join(kept))
    return _WHITESPACE_RE.sub(" ", text).strip()


def normalize_name(raw: str, *, max_raw: int = 500, max_len: int = 100, max_tokens: int = 10) -> str:
    if not isinstance(raw, str):
        raise NameValidationError("invalid_type", "Name must be text.")
    if len(raw) > max_raw:
        raise NameValidationError("too_long", f"Selection is longer than {max_raw} characters; select just the name.")
    text = _clean(raw)
    if not text:
        raise NameValidationError("empty", "Enter or select a name.")
    if len(text) > max_len:
        raise NameValidationError("too_long", f"Names longer than {max_len} characters are not supported.")
    if _SUSPICIOUS_RE.search(text):
        raise NameValidationError("not_a_name", "That looks like a URL, email address or markup, not a name.")
    if not any(unicodedata.category(c).startswith("L") for c in text):
        raise NameValidationError("not_a_name", "A name needs at least one letter.")
    if sum(c.isdigit() for c in text) > 2:
        raise NameValidationError("not_a_name", "That contains too many digits to be a name.")
    if len(text.split(" ")) > max_tokens:
        raise NameValidationError("too_many_parts", f"Names with more than {max_tokens} parts are not supported.")
    return text


def parse_name(raw: str, *, max_raw: int = 500, max_len: int = 100, max_tokens: int = 10) -> ParsedName:
    normalized = normalize_name(raw, max_raw=max_raw, max_len=max_len, max_tokens=max_tokens)
    parts = [NamePart(t, fold(t).strip(".") in PARTICLES) for t in normalized.split(" ")]

    counts: Counter[str] = Counter(s for c in normalized if (s := script_of(c)))
    primary = counts.most_common(1)[0][0] if counts else None

    notes: list[str] = []
    ambiguous = False
    content = [p for p in parts if not p.is_particle]

    if len(parts) == 1:
        notes.append(
            "Only one part was given, so it is unclear whether this is a given name, a family name or a full name."
        )
        ambiguous = True
    if len(counts) > 1 and not set(counts) <= {"HAN", "HIRAGANA", "KATAKANA"}:
        notes.append("More than one writing system appears in this name (" + ", ".join(sorted(counts)) + ").")
        ambiguous = True
    if primary in _ORDER_SCRIPTS:
        notes.append("Names in this script are often written family name first, but NameLens does not assume that.")
        if len(parts) == 1 and len(normalized) > 1:
            notes.append("No spaces were found, so the boundary between name parts is unknown.")
            ambiguous = True
    if any(p.is_particle for p in parts):
        notes.append("A particle such as “de”, “van” or “bin” may belong to the family name or be a separate part.")
    if any("-" in p.text for p in parts):
        notes.append("Hyphenated parts are looked up both as a whole and as separate parts.")
    if len(content) >= 3:
        notes.append("Three or more parts: naming conventions differ, so the given/family split is not assumed.")
        ambiguous = True
    if any(unicodedata.normalize("NFD", p.text) != p.text for p in parts) and primary == "LATIN":
        notes.append("Diacritics are preserved in the display and ignored only when matching sources.")

    return ParsedName(
        raw=raw,
        normalized=normalized,
        parts=parts,
        scripts=dict(counts),
        primary_script=primary,
        notes=notes,
        ambiguous=ambiguous,
    )
