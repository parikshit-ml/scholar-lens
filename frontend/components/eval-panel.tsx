"use client"

import { useRef, useState } from "react"

type EvalResult = {
  question: string
  expected_answer: string
  actual_answer: string
  expected_pages: number[]   // ← FIXED: was expected_page: number (wrong type, caused 422)
  retrieved_pages: number[]
  retrieval_hit: boolean
  similarity: number
  similarity_label: "correct" | "partial" | "wrong"
  grounded: boolean
}

type EvalSummary = {
  total_questions: number
  retrieval_accuracy: number
  retrieval_accuracy_pct: number
  avg_answer_similarity: number
  grounding_rate: number
  grounding_rate_pct: number
  correct_answers: number
  partial_answers: number
  wrong_answers: number
}

// Normalises the doc_id the user pastes in.
// Accepts "doc-1234", "1234", "doc-1234]", "1234]" — always returns "doc-1234"
function normaliseDocId(raw: string): string {
  let s = raw.trim().replace(/[\[\]]/g, "")   // strip accidental brackets
  if (!s.startsWith("doc-")) s = `doc-${s}`
  return s
}

export default function EvalPanel() {
  const [docId, setDocId] = useState("")
  const [dataset, setDataset] = useState<any[]>([])
  const [fileName, setFileName] = useState("")
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<EvalResult[]>([])
  const [summary, setSummary] = useState<EvalSummary | null>(null)
  const [error, setError] = useState("")
  const [expandedRow, setExpandedRow] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        setDataset(parsed)
        setError("")
      } catch {
        setError("Invalid JSON file. Check the format.")
      }
    }
    reader.readAsText(f)
  }

  const handleRun = async () => {
    const resolvedId = normaliseDocId(docId)
    if (!resolvedId || resolvedId === "doc-") {
      setError("Enter the Document ID from your ScholarLens session.")
      return
    }
    if (dataset.length === 0) { setError("Upload an eval_dataset.json first."); return }
    setRunning(true); setResults([]); setSummary(null); setError("")

    try {
      const res = await fetch("http://localhost:8005/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: resolvedId, dataset, k: 8 }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setResults(data.results)
      setSummary(data.summary)
    } catch (e: any) {
      setError(e.message || "Evaluation failed. Make sure backend is running on port 8005.")
    } finally {
      setRunning(false)
    }
  }

  const exportCSV = () => {
    const headers = ["Question", "Expected", "Actual", "Expected Pages", "Retrieved Pages", "Retrieval Hit", "Similarity", "Label", "Grounded"]
    const rows = results.map(r => [
      `"${r.question.replace(/"/g, "'")}"`,
      `"${r.expected_answer.replace(/"/g, "'")}"`,
      `"${r.actual_answer.replace(/"/g, "'")}"`,
      r.expected_pages.join(";"),       // ← FIXED: was r.expected_page
      r.retrieved_pages.join(";"),
      r.retrieval_hit ? "YES" : "NO",
      r.similarity,
      r.similarity_label,
      r.grounded ? "YES" : "NO",
    ])
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "scholarlens_eval_results.csv"  // ← RENAMED
    a.click()
  }

  const simColor = (label: string) => label === "correct" ? "#22C55E" : label === "partial" ? "#F59E0B" : "#EF4444"
  const simBg   = (label: string) => label === "correct" ? "rgba(34,197,94,0.1)" : label === "partial" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)"

  // Live-normalise the input so the user sees the corrected value
  const displayId = docId ? normaliseDocId(docId) : ""

  return (
    <div style={{ minHeight: "100vh", background: "#0B0F14", color: "#E6EDF3", fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 14 }}>

      {/* ── Nav ── */}
      <nav style={{ height: 48, background: "#11161C", borderBottom: "1px solid #1F2933", display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 26, height: 26, background: "#161B22", border: "1px solid #1F2933", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="#4F8CFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          {/* RENAMED: PaperRAG → ScholarLens */}
          <span style={{ fontSize: 13, fontWeight: 600, color: "#E6EDF3" }}>ScholarLens</span>
        </a>
        <span style={{ color: "#3D5A80" }}>›</span>
        <span style={{ fontSize: 12, color: "#9BA7B4", fontWeight: 500 }}>Evaluation Framework</span>
        <span style={{ fontSize: 9, color: "#4F8CFF", background: "rgba(79,140,255,0.12)", padding: "2px 6px", borderRadius: 3, fontFamily: "monospace" }}>BETA</span>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#E6EDF3", marginBottom: 8, letterSpacing: "-0.02em" }}>RAG Evaluation Framework</h1>
          <p style={{ fontSize: 13, color: "#5C6B7A", lineHeight: 1.6 }}>
            Measure retrieval accuracy, answer correctness, and grounding rate against a benchmark dataset.
            This turns your project from a demo into a measured engineering system.
          </p>
        </div>

        {/* Setup card */}
        <div style={{ background: "#11161C", border: "1px solid #1F2933", borderRadius: 10, padding: "24px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#5C6B7A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Setup</div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

            {/* Doc ID input */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontSize: 12, color: "#9BA7B4", fontWeight: 500, display: "block", marginBottom: 6 }}>Document ID</label>
              <input
                value={docId}
                onChange={e => setDocId(e.target.value)}
                placeholder="e.g. doc-1777816068874"
                style={{ width: "100%", background: "#161B22", border: "1px solid #1F2933", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#E6EDF3", outline: "none", fontFamily: "monospace", boxSizing: "border-box" }}
              />
              {/* Live preview of normalised value */}
              {docId && displayId !== docId.trim() && (
                <div style={{ fontSize: 10, color: "#22C55E", marginTop: 3, fontFamily: "monospace" }}>
                  ↳ will be sent as: {displayId}
                </div>
              )}
              <div style={{ fontSize: 10, color: "#3D5A80", marginTop: 4 }}>
                {/* RENAMED: PaperRAG → ScholarLens */}
                Copy from ScholarLens terminal: <code style={{ color: "#4F8CFF" }}>UPLOAD [doc-xxxxx]</code>
              </div>
            </div>

            {/* JSON upload */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontSize: 12, color: "#9BA7B4", fontWeight: 500, display: "block", marginBottom: 6 }}>Eval Dataset (JSON)</label>
              <button onClick={() => fileRef.current?.click()}
                style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "1px dashed #1F2933", borderRadius: 7, color: dataset.length > 0 ? "#22C55E" : "#4F8CFF", fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 200ms", textAlign: "left" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(79,140,255,0.05)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                {dataset.length > 0 ? `✓ ${fileName} — ${dataset.length} questions loaded` : "Upload eval_dataset.json"}
              </button>
              <input ref={fileRef} type="file" accept=".json" onChange={handleJsonUpload} style={{ display: "none" }} />
            </div>

            {/* Run button */}
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={handleRun} disabled={running}
                style={{ padding: "8px 24px", background: running ? "#1F2933" : "linear-gradient(135deg,#4F8CFF,#7C5CFF)", border: "none", borderRadius: 7, color: running ? "#5C6B7A" : "white", fontSize: 13, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 200ms", display: "flex", alignItems: "center", gap: 8 }}>
                {running ? (
                  <><div style={{ width: 12, height: 12, border: "1.5px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Running…</>
                ) : "▶ Run Evaluation"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, fontSize: 12, color: "#EF4444" }}>
              {error}
            </div>
          )}

          {/* Running indicator */}
          {running && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "#4F8CFF", fontFamily: "monospace", marginBottom: 6 }}>
                Running evaluation pipeline… this takes 1–2 min for 20 questions
              </div>
              <div style={{ height: 3, background: "#1F2933", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg,#4F8CFF,#7C5CFF)", borderRadius: 2, width: "100%", animation: "shimmer 1.5s infinite" }} />
              </div>
            </div>
          )}
        </div>

        {/* Summary cards */}
        {summary && (
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              {
                label: "Retrieval Accuracy",
                value: `${summary.retrieval_accuracy_pct}%`,
                sub: `${Math.round(summary.retrieval_accuracy * summary.total_questions)}/${summary.total_questions} correct page retrieved`,
                color: summary.retrieval_accuracy_pct >= 70 ? "#22C55E" : summary.retrieval_accuracy_pct >= 50 ? "#F59E0B" : "#EF4444"
              },
              {
                label: "Answer Similarity",
                value: summary.avg_answer_similarity.toFixed(2),
                sub: `${summary.correct_answers} correct · ${summary.partial_answers} partial · ${summary.wrong_answers} wrong`,
                color: summary.avg_answer_similarity >= 0.75 ? "#22C55E" : summary.avg_answer_similarity >= 0.50 ? "#F59E0B" : "#EF4444"
              },
              {
                label: "Grounding Rate",
                value: `${summary.grounding_rate_pct}%`,
                sub: `${Math.round(summary.grounding_rate * summary.total_questions)}/${summary.total_questions} answers grounded`,
                color: summary.grounding_rate_pct >= 80 ? "#22C55E" : summary.grounding_rate_pct >= 60 ? "#F59E0B" : "#EF4444"
              },
              {
                label: "Questions Tested",
                value: summary.total_questions.toString(),
                sub: "benchmark dataset size",
                color: "#4F8CFF"
              },
            ].map(card => (
              <div key={card.label} style={{ flex: 1, minWidth: 200, background: "#11161C", border: "1px solid #1F2933", borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#5C6B7A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{card.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: card.color, letterSpacing: "-0.02em", marginBottom: 4 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: "#3D5A80" }}>{card.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Export button */}
        {results.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={exportCSV}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "transparent", border: "1px solid #1F2933", borderRadius: 6, color: "#9BA7B4", fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 200ms" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(79,140,255,0.3)"; (e.currentTarget as HTMLElement).style.color = "#4F8CFF" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1F2933"; (e.currentTarget as HTMLElement).style.color = "#9BA7B4" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Export CSV
            </button>
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && (
          <div style={{ background: "#11161C", border: "1px solid #1F2933", borderRadius: 10, overflow: "hidden" }}>

            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 80px 80px 80px", gap: 0, padding: "10px 16px", borderBottom: "1px solid #1F2933", fontSize: 10, fontWeight: 600, color: "#5C6B7A", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              <div>#</div>
              <div>Question</div>
              <div style={{ textAlign: "center" }}>Retrieval</div>
              <div style={{ textAlign: "center" }}>Similarity</div>
              <div style={{ textAlign: "center" }}>Grounded</div>
              <div style={{ textAlign: "center" }}>Pages</div>
            </div>

            {results.map((r, i) => (
              <div key={i}>
                <div
                  onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                  style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 80px 80px 80px", gap: 0, padding: "12px 16px", borderBottom: "1px solid #1F2933", cursor: "pointer", transition: "background 200ms", alignItems: "center", background: expandedRow === i ? "rgba(79,140,255,0.04)" : "transparent" }}
                  onMouseEnter={e => expandedRow !== i && ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => expandedRow !== i && ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                  <div style={{ fontSize: 11, color: "#3D5A80", fontFamily: "monospace" }}>{i + 1}</div>
                  <div style={{ fontSize: 12, color: "#E6EDF3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12 }}>{r.question}</div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 14 }}>{r.retrieval_hit ? "✅" : "❌"}</span>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: simColor(r.similarity_label), background: simBg(r.similarity_label), padding: "2px 7px", borderRadius: 4, fontFamily: "monospace" }}>
                      {r.similarity.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 14 }}>{r.grounded ? "✅" : "⚠️"}</span>
                  </div>
                  <div style={{ textAlign: "center", fontSize: 10, color: "#5C6B7A", fontFamily: "monospace" }}>
                    {r.retrieved_pages.slice(0, 3).join(",")}
                  </div>
                </div>

                {/* Expanded row */}
                {expandedRow === i && (
                  <div style={{ padding: "16px 56px", background: "#0F1419", borderBottom: "1px solid #1F2933" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#5C6B7A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Expected Answer</div>
                        <div style={{ fontSize: 12, color: "#9BA7B4", lineHeight: 1.6, background: "#161B22", border: "1px solid #1F2933", borderRadius: 6, padding: "10px 12px" }}>{r.expected_answer}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#5C6B7A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Actual Answer</div>
                        <div style={{ fontSize: 12, color: "#9BA7B4", lineHeight: 1.6, background: "#161B22", border: `1px solid ${simColor(r.similarity_label)}33`, borderRadius: 6, padding: "10px 12px" }}>{r.actual_answer}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, fontSize: 10, color: "#5C6B7A", fontFamily: "monospace" }}>
                      {/* FIXED: was r.expected_page, now r.expected_pages */}
                      <span>Expected pages: <span style={{ color: "#4F8CFF" }}>[{r.expected_pages.join(", ")}]</span></span>
                      <span>·</span>
                      <span>Retrieved: <span style={{ color: "#4F8CFF" }}>[{r.retrieved_pages.join(", ")}]</span></span>
                      <span>·</span>
                      <span>Similarity: <span style={{ color: simColor(r.similarity_label) }}>{r.similarity.toFixed(3)} ({r.similarity_label})</span></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }
        input:focus { border-color: rgba(79,140,255,0.4) !important; }
      `}</style>
    </div>
  )
}