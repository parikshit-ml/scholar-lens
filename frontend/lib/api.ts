// lib/api.ts — ScholarLens frontend API contract
// Single source of truth for all backend communication.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://LordMorata-scholarlens-backend.hf.space";

// ---------- Shared types (mirror the backend response shapes) ----------

export type Tier = "most_relevant" | "supporting" | "low_confidence";
export type Confidence = "high" | "medium" | "low";
export type AnswerStyle = "concise" | "detailed" | "bullet";

export interface Source {
  text: string;
  chunk_id: number;
  page: number;
  reranker_score: number;
  tier: Tier;
}

export interface AskResponse {
  answer: string;
  sources: Source[];
  confidence: Confidence;
  confidence_reason: string;
  cached?: boolean;
  retrieval_ms: number;
  rerank_ms: number;
  chunks_used: number;
}

export interface UploadResponse {
  status: "indexed" | "error";
  chunks: number;
  pages?: number;
  doc_id?: string;
}

export interface SuggestResponse {
  suggestions: string[];
}

export interface CompareSource {
  text: string;
  page: number;
}

export interface CompareResponse {
  answer: string;
  sources_a: CompareSource[];
  sources_b: CompareSource[];
  confidence: Confidence;
}

export interface EvalItem {
  question: string;
  expected_answer: string;
  expected_pages: number[];
}

export interface EvalResultRow {
  question: string;
  expected_answer: string;
  actual_answer: string;
  expected_pages: number[];
  retrieved_pages: number[];
  retrieval_hit: boolean;
  similarity: number;
  similarity_label: "correct" | "partial" | "wrong";
  grounded: boolean;
}

export interface EvalSummary {
  total_questions: number;
  retrieval_accuracy: number;
  retrieval_accuracy_pct: number;
  avg_answer_similarity: number;
  grounding_rate: number;
  grounding_rate_pct: number;
  correct_answers: number;
  partial_answers: number;
  wrong_answers: number;
}

export interface EvalResponse {
  results: EvalResultRow[];
  summary: EvalSummary;
}

// ---------- Internal fetch helper (consistent errors everywhere) ----------

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${endpoint}`, options);
  } catch (e) {
    // Network-level failure: backend down, CORS, DNS, etc.
    throw new ApiError(
      `Cannot reach the ScholarLens backend. Is it running on ${BASE_URL}?`,
      0,
      endpoint,
    );
  }

  if (!res.ok) {
    // Try to surface the backend's error body if there is one.
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ?? body?.error ?? JSON.stringify(body);
    } catch {
      detail = res.statusText;
    }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status, endpoint);
  }

  return res.json() as Promise<T>;
}

// ---------- Public API ----------

export async function uploadPDF(
  file: File,
  docId: string = "default",
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("doc_id", docId);

  return request<UploadResponse>("/upload", {
    method: "POST",
    body: formData,
  });
}

export interface AskOptions {
  docId?: string;
  k?: number;
  answerStyle?: AnswerStyle;
  temperature?: number;
}

export async function askQuestion(
  question: string,
  options: AskOptions = {},
): Promise<AskResponse> {
  return request<AskResponse>("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      doc_id: options.docId ?? "default",
      k: options.k ?? 8,
      answer_style: options.answerStyle ?? "detailed",
      temperature: options.temperature ?? 0.3,
    }),
  });
}

export async function suggestQueries(
  question: string,
  confidenceReason: string,
): Promise<SuggestResponse> {
  return request<SuggestResponse>("/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      confidence_reason: confidenceReason,
    }),
  });
}

export interface CompareOptions {
  k?: number;
  answerStyle?: AnswerStyle;
  temperature?: number;
}

export async function compareDocuments(
  question: string,
  docIdA: string,
  docIdB: string,
  options: CompareOptions = {},
): Promise<CompareResponse> {
  return request<CompareResponse>("/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      doc_id_a: docIdA,
      doc_id_b: docIdB,
      k: options.k ?? 6,
      answer_style: options.answerStyle ?? "detailed",
      temperature: options.temperature ?? 0.3,
    }),
  });
}

export async function evaluate(
  docId: string,
  dataset: EvalItem[],
  k: number = 8,
): Promise<EvalResponse> {
  return request<EvalResponse>("/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id: docId, dataset, k }),
  });
}

export { ApiError };
export { BASE_URL };