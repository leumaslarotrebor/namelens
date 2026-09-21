import pytest

from app.nameproc import NameValidationError, fold, normalize_name, parse_name


def test_nfc_normalisation_makes_composed_and_decomposed_equal():
    assert normalize_name("Jose\u0301") == normalize_name("José") == "José"


def test_whitespace_collapsed_including_unicode_spaces():
    assert normalize_name("  Maria\u00a0 \u3000García \n") == "Maria García"


def test_control_and_bidi_characters_removed():
    assert normalize_name("Ma\x00ria\u202e García") == "Maria García"


def test_zero_width_joiner_kept_for_indic_and_persian_scripts():
    assert "\u200c" in normalize_name("می\u200cخواهم")


@pytest.mark.parametrize("raw", ["", "   ", "\x00\x01"])
def test_empty_rejected(raw):
    with pytest.raises(NameValidationError) as e:
        normalize_name(raw)
    assert e.value.code == "empty"


def test_very_long_input_rejected_before_processing():
    with pytest.raises(NameValidationError) as e:
        normalize_name("a" * 501)
    assert e.value.code == "too_long"


def test_long_after_normalisation_rejected():
    with pytest.raises(NameValidationError):
        normalize_name("a" * 101)


@pytest.mark.parametrize("raw", ["https://example.com", "me@example.com", "<script>alert(1)</script>", "12345", "!!!"])
def test_non_names_rejected(raw):
    with pytest.raises(NameValidationError) as e:
        normalize_name(raw)
    assert e.value.code == "not_a_name"


def test_too_many_parts_rejected():
    with pytest.raises(NameValidationError) as e:
        normalize_name(" ".join(["ab"] * 11))
    assert e.value.code == "too_many_parts"


def test_non_string_rejected():
    with pytest.raises(NameValidationError):
        normalize_name(123)  # type: ignore[arg-type]


def test_apostrophes_and_hyphens_preserved_and_split_for_lookup():
    p = parse_name("Jean-Luc O’Brien")
    assert p.normalized == "Jean-Luc O’Brien"
    assert "Jean" in p.lookup_terms and "Luc" in p.lookup_terms and "O’Brien" in p.lookup_terms


def test_fold_ignores_case_and_diacritics_only_for_matching():
    assert fold("GARCÍA") == fold("garcia") == "garcia"
    assert fold("O’Brien") == "o'brien"


def test_single_token_is_ambiguous():
    p = parse_name("García")
    assert p.ambiguous and any("Only one part" in n for n in p.notes)


def test_particles_detected_and_not_looked_up_alone():
    p = parse_name("Ludwig van Beethoven")
    assert [x.is_particle for x in p.parts] == [False, True, False]
    assert "van" not in p.lookup_terms


def test_three_part_name_flagged_not_split():
    p = parse_name("Gabriel García Márquez")
    assert p.ambiguous and any("not assumed" in n for n in p.notes)


def test_cjk_without_spaces_flags_unknown_boundary():
    p = parse_name("山田太郎")
    assert p.primary_script == "HAN" and p.ambiguous
    assert any("boundary" in n for n in p.notes)


def test_cjk_with_space_is_two_parts_and_no_assumed_order():
    p = parse_name("山田 太郎")
    assert len(p.parts) == 2
    assert any("does not assume" in n for n in p.notes)


def test_japanese_mixed_han_kana_is_not_flagged_as_mixed_script():
    p = parse_name("さくら 田中")
    assert not any("More than one writing system" in n for n in p.notes)


@pytest.mark.parametrize(
    "name,script",
    [
        ("Иван Петров", "CYRILLIC"),
        ("محمد بن سلمان", "ARABIC"),
        ("Γιώργος", "GREEK"),
        ("김민수", "HANGUL"),
        ("Maria García", "LATIN"),
    ],
)
def test_script_detection(name, script):
    assert parse_name(name).primary_script == script


def test_mixed_script_flagged():
    p = parse_name("Anna Иванова")
    assert p.ambiguous and any("More than one writing system" in n for n in p.notes)


@pytest.mark.parametrize(
    "name,script",
    [
        ("சுப்பிரமணியன்", "TAMIL"),
        ("प्रिया शर्मा", "DEVANAGARI"),
        ("さくら", "HIRAGANA"),
        ("サクラ", "KATAKANA"),
        ("Γιώργος Παπαδόπουλος", "GREEK"),
        ("יוסי כהן", "HEBREW"),
    ],
)
def test_more_scripts_detected(name, script):
    p = parse_name(name)
    assert p.primary_script == script and p.normalized == name


def test_rtl_name_kept_in_logical_order_with_particle():
    p = parse_name("محمد بن سلمان")
    assert [x.text for x in p.parts] == ["محمد", "بن", "سلمان"] and p.parts[1].is_particle


def test_combining_marks_do_not_break_tamil_or_devanagari():
    assert normalize_name("  प्रिया   शर्मा ") == "प्रिया शर्मा"


def test_tamil_and_devanagari_lookup_terms_are_not_split_inside_words():
    assert parse_name("சுப்பிரமணியன்").lookup_terms == ["சுப்பிரமணியன்"]
