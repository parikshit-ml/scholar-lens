"use client"

import { useRef, useState } from "react"

type EvalResult = {
  question: string
  expected_answer: string
  actual_answer: string
  expected_pages: number[]
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

function normaliseDocId(raw: string): string {
  let s = raw.trim().replace(/[\[\]]/g, "")
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
      r.expected_pages.join(";"),
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
    a.download = "scholarlens_eval_results.csv"
    a.click()
  }

  const simColor = (label: string) => label === "correct" ? "#15803D" : label === "partial" ? "#B45309" : "#DC2626"
  const simBg   = (label: string) => label === "correct" ? "rgba(21,128,61,0.1)" : label === "partial" ? "rgba(180,83,9,0.1)" : "rgba(220,38,38,0.1)"

  const displayId = docId ? normaliseDocId(docId) : ""

  return (
    <div style={{ minHeight: "100vh", background: "#F6F1E7", color: "#2C2820", fontFamily: "var(--font-sans)", fontSize: 14 }}>

      {/* ── Nav ── */}
      <nav style={{ height: 48, background: "#EFE8DA", borderBottom: "1px solid #E0D9CA", display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 26, height: 26, background: "#FAF6EC", border: "1px solid #E0D9CA", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2820" }}>ScholarLens</span>
        </a>
        <span style={{ color: "#A39C8C" }}>›</span>
        <span style={{ fontSize: 12, color: "#6B6457", fontWeight: 500 }}>Evaluation Framework</span>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 500, color: "#2C2820", marginBottom: 8, letterSpacing: "-0.02em", fontFamily: "var(--font-serif)" }}>RAG Evaluation Framework</h1>
          <p style={{ fontSize: 15, color: "#6B6457", lineHeight: 1.7, fontFamily: "var(--font-serif)", maxWidth: 680 }}>
            Measure retrieval accuracy, answer correctness, and grounding rate against a benchmark dataset.
            This turns the project from a demo into a measured engineering system.
          </p>
        </div>

        {/* Setup card */}
        <div style={{ background: "#FAF6EC", border: "1px solid #E0D9CA", borderRadius: 10, padding: "24px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#A39C8C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>Setup</div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>

            {/* Doc ID input */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontSize: 12, color: "#6B6457", fontWeight: 500, display: "block", marginBottom: 6 }}>Document ID</label>
              <input
                value={docId}
                onChange={e => setDocId(e.target.value)}
                placeholder="e.g. doc-1777816068874"
                style={{ width: "100%", background: "#FFFDF8", border: "1px solid #E0D9CA", borderRadius: 7, padding: "8px 12px", fontSize: 12, color: "#2C2820", outline: "none", fontFamily: "var(--font-mono)", boxSizing: "border-box" }}
              />
              {docId && displayId !== docId.trim() && (
                <div style={{ fontSize: 10, color: "#15803D", marginTop: 3, fontFamily: "var(--font-mono)" }}>
                  ↳ will be sent as: {displayId}
                </div>
              )}
              <div style={{ fontSize: 10, color: "#A39C8C", marginTop: 4 }}>
                Copy from ScholarLens terminal: <code style={{ color: "#0F6E56", fontFamily: "var(--font-mono)" }}>UPLOAD [doc-xxxxx]</code>
              </div>
            </div>

            {/* JSON upload */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontSize: 12, color: "#6B6457", fontWeight: 500, display: "block", marginBottom: 6 }}>Eval Dataset (JSON)</label>
              <button onClick={() => fileRef.current?.click()}
                style={{ width: "100%", padding: "8px 12px", background: "transparent", border: "1px dashed #D6CDBB", borderRadius: 7, color: dataset.length > 0 ? "#15803D" : "#8A8275", fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 200ms", textAlign: "left" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(15,110,86,0.04)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                {dataset.length > 0 ? `✓ ${fileName} — ${dataset.length} questions loaded` : "Upload eval_dataset.json"}
              </button>
              <input ref={fileRef} type="file" accept=".json" onChange={handleJsonUpload} style={{ display: "none" }} />
            </div>

            {/* Run button */}
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button onClick={handleRun} disabled={running}
                style={{ padding: "8px 24px", background: running ? "#E0D9CA" : "#0F6E56", border: "none", borderRadius: 7, color: running ? "#8A8275" : "white", fontSize: 13, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 200ms", display: "flex", alignItems: "center", gap: 8 }}>
                {running ? (
                  <><div style={{ width: 12, height: 12, border: "1.5px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Running…</>
                ) : "Run Evaluation"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, fontSize: 12, color: "#DC2626" }}>
              {error}
            </div>
          )}

          {/* Running indicator */}
          {running && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, color: "#8A8275", fontFamily: "var(--font-mono)", marginBottom: 6 }}>
                Running evaluation pipeline… this takes 1–2 min for 20 questions
              </div>
              <div style={{ height: 3, background: "#E0D9CA", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "#0F6E56", borderRadius: 2, width: "100%", animation: "shimmer 1.5s infinite" }} />
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
                color: summary.retrieval_accuracy_pct >= 70 ? "#15803D" : summary.retrieval_accuracy_pct >= 50 ? "#B45309" : "#DC2626"
              },
              {
                label: "Answer Similarity",
                value: summary.avg_answer_similarity.toFixed(2),
                sub: `${summary.correct_answers} correct · ${summary.partial_answers} partial · ${summary.wrong_answers} wrong`,
                color: summary.avg_answer_similarity >= 0.75 ? "#15803D" : summary.avg_answer_similarity >= 0.50 ? "#B45309" : "#DC2626"
              },
              {
                label: "Grounding Rate",
                value: `${summary.grounding_rate_pct}%`,
                sub: `${Math.round(summary.grounding_rate * summary.total_questions)}/${summary.total_questions} answers grounded`,
                color: summary.grounding_rate_pct >= 80 ? "#15803D" : summary.grounding_rate_pct >= 60 ? "#B45309" : "#DC2626"
              },
              {
                label: "Questions Tested",
                value: summary.total_questions.toString(),
                sub: "benchmark dataset size",
                color: "#0F6E56"
              },
            ].map(card => (
              <div key={card.label} style={{ flex: 1, minWidth: 200, background: "#FAF6EC", border: "1px solid #E0D9CA", borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#A39C8C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{card.label}</div>
                <div style={{ fontSize: 32, fontWeight: 500, color: card.color, letterSpacing: "-0.02em", marginBottom: 4, fontFamily: "var(--font-mono)" }}>{card.value}</div>
                <div style={{ fontSize: 11, color: "#8A8275" }}>{card.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Export button */}
        {results.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button onClick={exportCSV}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "transparent", border: "1px solid #E0D9CA", borderRadius: 6, color: "#6B6457", fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 200ms" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(15,110,86,0.3)"; (e.currentTarget as HTMLElement).style.color = "#0F6E56" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E0D9CA"; (e.currentTarget as HTMLElement).style.color = "#6B6457" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Export CSV
            </button>
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && (
          <div style={{ background: "#FAF6EC", border: "1px solid #E0D9CA", borderRadius: 10, overflow: "hidden" }}>

            {/* Table header */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 80px 80px 80px", gap: 0, padding: "10px 16px", borderBottom: "1px solid #E0D9CA", fontSize: 10, fontWeight: 600, color: "#A39C8C", letterSpacing: "0.08em", textTransform: "uppercase" }}>
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
                  style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 80px 80px 80px", gap: 0, padding: "12px 16px", borderBottom: "1px solid #E0D9CA", cursor: "pointer", transition: "background 200ms", alignItems: "center", background: expandedRow === i ? "rgba(15,110,86,0.04)" : "transparent" }}
                  onMouseEnter={e => expandedRow !== i && ((e.currentTarget as HTMLElement).style.background = "rgba(44,40,32,0.02)")}
                  onMouseLeave={e => expandedRow !== i && ((e.currentTarget as HTMLElement).style.background = "transparent")}>
                  <div style={{ fontSize: 11, color: "#A39C8C", fontFamily: "var(--font-mono)" }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: "#2C2820", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 12, fontFamily: "var(--font-serif)" }}>{r.question}</div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 14 }}>{r.retrieval_hit ? "✅" : "❌"}</span>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: simColor(r.similarity_label), background: simBg(r.similarity_label), padding: "2px 7px", borderRadius: 4, fontFamily: "var(--font-mono)" }}>
                      {r.similarity.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 14 }}>{r.grounded ? "✅" : "⚠️"}</span>
                  </div>
                  <div style={{ textAlign: "center", fontSize: 10, color: "#8A8275", fontFamily: "var(--font-mono)" }}>
                    {r.retrieved_pages.slice(0, 3).join(",")}
                  </div>
                </div>

                {/* Expanded row */}
                {expandedRow === i && (
                  <div style={{ padding: "16px 56px", background: "#F2EADC", borderBottom: "1px solid #E0D9CA" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#A39C8C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Expected Answer</div>
                        <div style={{ fontSize: 13, color: "#3A352C", lineHeight: 1.7, background: "#FFFDF8", border: "1px solid #E0D9CA", borderRadius: 6, padding: "10px 12px", fontFamily: "var(--font-serif)" }}>{r.expected_answer}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#A39C8C", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Actual Answer</div>
                        <div style={{ fontSize: 13, color: "#3A352C", lineHeight: 1.7, background: "#FFFDF8", border: `1px solid ${simColor(r.similarity_label)}33`, borderRadius: 6, padding: "10px 12px", fontFamily: "var(--font-serif)" }}>{r.actual_answer}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, fontSize: 10, color: "#8A8275", fontFamily: "var(--font-mono)" }}>
                      <span>Expected pages: <span style={{ color: "#0F6E56" }}>[{r.expected_pages.join(", ")}]</span></span>
                      <span>·</span>
                      <span>Retrieved: <span style={{ color: "#0F6E56" }}>[{r.retrieved_pages.join(", ")}]</span></span>
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
        input:focus { border-color: rgba(15,110,86,0.4) !important; }
      `}</style>
    </div>
  )
}