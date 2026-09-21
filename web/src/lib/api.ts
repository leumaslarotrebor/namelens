import type { AnalyzeResponse, FeedbackInput, FeedbackReceipt, SourceInfo } from "./types";

const BASE: string = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  constructor(message: string, public code: string, public status = 0) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Could not reach the NameLens server. Check your connection and try again.", "network");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(e?.message ?? "The server returned an unexpected response.", e?.code ?? "http_error", res.status);
  }
  return body as T;
}

export const analyzeName = (name: string, signal?: AbortSignal) =>
  request<AnalyzeResponse>("/analyze", { method: "POST", body: JSON.stringify({ name }), signal });

export const getSources = () => request<SourceInfo[]>("/sources");

export const sendFeedback = (input: FeedbackInput) =>
  request<FeedbackReceipt>("/feedback", { method: "POST", body: JSON.stringify(input) });

export const deleteFeedback = (r: FeedbackReceipt) =>
  request<void>(`/feedback/${r.id}`, { method: "DELETE", headers: { "X-Delete-Token": r.delete_token } });
