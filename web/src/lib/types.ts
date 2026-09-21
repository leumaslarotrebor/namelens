export type SourceType = "structured_database" | "encyclopedia" | "demo_fixture";

export interface Source { title: string; url: string; type: SourceType }
export interface Evidence { source: Source; excerpt: string; score: number; retrieved_at: string }
export interface ClaimValue { value: string; qualifier: string | null; independent_sources: number; evidence: Evidence[] }
export interface Claim { claim_type: string; label: string; disagreement: boolean; values: ClaimValue[] }
export interface TermResult { term: string; claims: Claim[] }
export interface NamePart { text: string; is_particle: boolean }
export interface ProviderError { provider: string; message: string }

export interface AnalyzeResponse {
  name: string;
  parts: NamePart[];
  scripts: Record<string, number>;
  primary_script: string | null;
  notes: string[];
  ambiguous: boolean;
  status: "ok" | "insufficient";
  strength: "none" | "low" | "moderate";
  strength_explanation: string;
  terms: TermResult[];
  sources: Source[];
  provider_errors: ProviderError[];
  providers_queried: string[];
  input_changed: boolean;
}

export interface SourceInfo {
  id: string; name: string; type: SourceType; url: string; enabled: boolean; description: string; caveat: string;
}

export interface FeedbackInput {
  name: string;
  useful?: boolean | null;
  pronunciation_correct?: boolean | null;
  suggested_pronunciation?: string | null;
  suggestion?: string | null;
}
export interface FeedbackReceipt { id: number; delete_token: string }
