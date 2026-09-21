import type { AnalyzeResponse } from "../lib/types";

const wikidata = { title: "Wikidata Q1: García", url: "https://www.wikidata.org/wiki/Q1", type: "structured_database" as const };
const wikipedia = { title: "Wikipedia: García", url: "https://en.wikipedia.org/wiki/Garc%C3%ADa", type: "encyclopedia" as const };
const demo = { title: "Wiktionary: García (demo fixture)", url: "https://en.wiktionary.org/wiki/García", type: "demo_fixture" as const };
const at = "2026-09-20T10:00:00+00:00";

export const okResult: AnalyzeResponse = {
  name: "García",
  parts: [{ text: "García", is_particle: false }],
  scripts: { LATIN: 6 },
  primary_script: "LATIN",
  notes: ["Only one part was given, so it is unclear whether it is a given name, a family name or a full name."],
  ambiguous: true,
  status: "ok",
  strength: "moderate",
  strength_explanation: "At least one claim is stated by two independent sources that agree.",
  terms: [{
    term: "García",
    claims: [
      { claim_type: "name_kind", label: "Kind of name", disagreement: false, values: [{
        value: "family name", qualifier: null, independent_sources: 2,
        evidence: [
          { source: wikidata, excerpt: "Wikidata item description: “Spanish surname”.", score: 0.8, retrieved_at: at },
          { source: wikipedia, excerpt: "García is a Spanish surname.", score: 0.7, retrieved_at: at },
        ] }] },
      { claim_type: "pronunciation", label: "Possible pronunciation (IPA)", disagreement: false, values: [{
        value: "/ɡaɾˈθi.a/", qualifier: "Spain", independent_sources: 1,
        evidence: [{ source: demo, excerpt: "Hand-entered demo data; check the linked reference.", score: 0.4, retrieved_at: at }] }] },
    ],
  }],
  sources: [wikidata, wikipedia, demo],
  provider_errors: [],
  providers_queried: ["wikidata", "wikipedia", "demo"],
  input_changed: false,
};

export const insufficient: AnalyzeResponse = {
  ...okResult, name: "Zzyzx", parts: [{ text: "Zzyzx", is_particle: false }], notes: [], ambiguous: false,
  status: "insufficient", strength: "none", strength_explanation: "Insufficient reliable information found.",
  terms: [], sources: [],
};

export const disagreeing: AnalyzeResponse = {
  ...okResult, strength: "low",
  strength_explanation: "Sources give different values, or the name has more than one use. Treat this as uncertain.",
  terms: [{ term: "García", claims: [{ claim_type: "name_kind", label: "Kind of name", disagreement: true, values: [
    { value: "family name", qualifier: null, independent_sources: 1, evidence: [{ source: wikidata, excerpt: "a", score: 0.8, retrieved_at: at }] },
    { value: "given name", qualifier: null, independent_sources: 1, evidence: [{ source: wikipedia, excerpt: "b", score: 0.7, retrieved_at: at }] },
  ] }] }],
};
