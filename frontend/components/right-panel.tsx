"use client"

import { useEffect, useRef, useState } from "react"
import type { Message, PaperDocument, Source, DecompositionData } from "@/app/app/page"

interface RightPanelProps {
  messages: Message[]
  isThinking: boolean
  thinkingStage: string
  activeDoc: PaperDocument | null
  onSend: (text: string) => void
  onUpload: (file: File) => void
  onPageJump: (page: number) => void
  onSourceHover: (page: number | null) => void
  compareMode: boolean
  compareDocA: PaperDocument | null
  compareDocB: PaperDocument | null
  onDecompose: () => void
}

export function RightPanel({ messages, isThinking, thinkingStage, activeDoc, onSend, onUpload, onPageJump, onSourceHover, compareMode, compareDocA, compareDocB, onDecompose }: RightPanelProps) {
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, isThinking])

  const handleSend = () => {
    const t = input.trim()
    const canSendNormal = !compareMode && !!activeDoc && !isThinking
    const canSendCompare = compareMode && !!compareDocA && !!compareDocB && !isThinking
    if (!t || (!canSendNormal && !canSendCompare)) return
    onSend(t); setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
  }

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = "" } }

  const canSend = compareMode ? !!compareDocA && !!compareDocB && !!input.trim() && !isThinking : !!activeDoc && !!input.trim() && !isThinking
  const isReady = compareMode ? (!!compareDocA && !!compareDocB) : !!activeDoc

  return (
    <aside style={{ width: 360, minWidth: 360, background: "#EFE8DA", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* ── Header ── */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #E0D9CA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 22, height: 22, background: compareMode ? "rgba(17,133,106,0.12)" : "rgba(15,110,86,0.1)", border: `1px solid ${compareMode ? "rgba(17,133,106,0.25)" : "rgba(15,110,86,0.2)"}`, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {compareMode ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="#11856A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2C2820" }}>{compareMode ? "Compare" : "ScholarLens"}</span>
        </div>
        <span style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)" }}>{compareMode ? "Dual RAG" : "ScholarLens · GPT-4o-mini"}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
        {messages.length === 0 && !isThinking ? (
          <EmptyState activeDoc={activeDoc} onSend={onSend} compareMode={compareMode} compareDocA={compareDocA} compareDocB={compareDocB} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} onPageJump={onPageJump} onSend={onSend} onSourceHover={onSourceHover} />
            ))}
            {isThinking && <ThinkingIndicator stage={thinkingStage} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {!compareMode && activeDoc && (
        <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
          <button onClick={onDecompose} disabled={isThinking}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", background: isThinking ? "transparent" : "rgba(15,110,86,0.06)", border: "1px solid rgba(15,110,86,0.2)", borderRadius: 7, color: isThinking ? "#0F6E56" : "#0F6E56", fontSize: 11, cursor: isThinking ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 200ms", fontWeight: 600 }}
            onMouseEnter={e => { if (!isThinking) { (e.currentTarget as HTMLElement).style.background = "rgba(15,110,86,0.12)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(15,110,86,0.4)" } }}
            onMouseLeave={e => { if (!isThinking) { (e.currentTarget as HTMLElement).style.background = "rgba(15,110,86,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(15,110,86,0.2)" } }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></svg>
            Decompose Paper
            <span style={{ fontSize: 9, color: "#A39C8C", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>4 parallel queries</span>
          </button>
          <button onClick={() => onSend("Extract the key contributions of this paper. List: (1) Main method or approach, (2) Key results and metrics, (3) Improvements over prior work, (4) Limitations mentioned.")}
            disabled={isThinking}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", background: "transparent", border: "1px solid #E0D9CA", borderRadius: 7, color: "#8A8275", fontSize: 11, cursor: isThinking ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 200ms", fontWeight: 500 }}
            onMouseEnter={e => { if (!isThinking) { (e.currentTarget as HTMLElement).style.borderColor = "rgba(15,110,86,0.3)"; (e.currentTarget as HTMLElement).style.color = "#6B6457" } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E0D9CA"; (e.currentTarget as HTMLElement).style.color = "#8A8275" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="#B45309" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Extract Key Contributions
          </button>
        </div>
      )}

      {compareMode && compareDocA && compareDocB && (
        <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {["What are the main contributions of each document?", "How do their methodologies differ?", "Which document has stronger results?"].map(q => (
            <button key={q} onClick={() => onSend(q)} disabled={isThinking}
              style={{ width: "100%", textAlign: "left", padding: "6px 10px", background: "transparent", border: "1px solid #E0D9CA", borderRadius: 6, color: "#8A8275", fontSize: 11, cursor: isThinking ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 200ms" }}
              onMouseEnter={e => { if (!isThinking) { (e.currentTarget as HTMLElement).style.borderColor = "rgba(17,133,106,0.3)"; (e.currentTarget as HTMLElement).style.color = "#6B6457" } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E0D9CA"; (e.currentTarget as HTMLElement).style.color = "#8A8275" }}>
              ⇄ {q}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: "10px 12px 12px", borderTop: "1px solid #E0D9CA" }}>
        {!isReady && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, padding: "6px 10px", background: "rgba(180,83,9,0.07)", border: "1px solid rgba(180,83,9,0.18)", borderRadius: 6 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#B45309" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#B45309" strokeWidth="2" strokeLinecap="round"/></svg>
            <span style={{ fontSize: 11, color: "#B45309" }}>{compareMode ? "Select both documents A and B to compare" : "Upload a PDF to enable ScholarLens"}</span>
          </div>
        )}
        <div style={{ background: "#FAF6EC", border: `1px solid ${isReady ? "#D6CDBB" : "#E0D9CA"}`, borderRadius: 10, overflow: "hidden" }}>
          <textarea ref={textareaRef} value={input}
            onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px" }}
            onKeyDown={handleKey} disabled={!isReady || isThinking}
            placeholder={compareMode ? compareDocA && compareDocB ? "Ask a comparison question…" : "Select both documents first…" : activeDoc ? "Ask ScholarLens about this paper…" : "Load a document first…"}
            rows={1} style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", padding: "12px 14px 4px", fontSize: 13, color: "#2C2820", lineHeight: 1.5, fontFamily: "inherit", maxHeight: 120, display: "block" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 10px 10px" }}>
            <IconBtn onClick={() => fileRef.current?.click()} title="Upload PDF">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </IconBtn>
            <button onClick={handleSend} disabled={!canSend}
              style={{ width: 30, height: 30, borderRadius: 7, background: canSend ? (compareMode ? "#11856A" : "#0F6E56") : "#E0D9CA", border: "none", cursor: canSend ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 200ms", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><line x1="22" y1="2" x2="11" y2="13" stroke={canSend ? "white" : "#8A8275"} strokeWidth="2" strokeLinecap="round"/><polygon points="22 2 15 22 11 13 2 9 22 2" stroke={canSend ? "white" : "#8A8275"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
            </button>
          </div>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: "none" }} />
    </aside>
  )
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 26, height: 26, borderRadius: 5, background: "transparent", border: "1px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#8A8275", transition: "all 200ms" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#E0D9CA"; (e.currentTarget as HTMLElement).style.color = "#6B6457" }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#8A8275" }}>
      {children}
    </button>
  )
}

function MetricsStrip({ retrievalMs, rerankMs, chunksUsed, confidence, cached }: {
  retrievalMs: number; rerankMs: number; chunksUsed: number; confidence: string; cached?: boolean
}) {
  const confColor = confidence === "high" ? "#15803D" : confidence === "medium" ? "#B45309" : "#DC2626"
  const metrics = [
    { label: "Retrieval", value: cached ? "0ms" : `${retrievalMs}ms` },
    { label: "Re-ranking", value: cached ? "0ms" : `${rerankMs}ms` },
    { label: "Chunks", value: `${chunksUsed}` },
    { label: "Confidence", value: confidence, color: confColor },
  ]
  return (
    <div style={{ display: "flex", gap: 0, background: "#F6F1E7", border: "1px solid #E0D9CA", borderRadius: 7, overflow: "hidden", marginTop: 4 }}>
      {metrics.map((m, i) => (
        <div key={m.label} style={{ flex: 1, padding: "7px 6px", borderRight: i < metrics.length - 1 ? "1px solid #E0D9CA" : "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 9, color: "#A39C8C", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{m.label}</span>
          <span style={{ fontSize: 15, fontWeight: 500, color: (m as any).color ?? "#2C2820", fontFamily: "var(--font-mono)", letterSpacing: "-0.01em" }}>{m.value}</span>
        </div>
      ))}
      {cached && (
        <div style={{ padding: "5px 8px", display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 8, color: "#0F6E56", background: "rgba(15,110,86,0.1)", border: "1px solid rgba(15,110,86,0.2)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>CACHED</span>
        </div>
      )}
    </div>
  )
}

function LowConfidenceBanner({ confidenceReason, chunksUsed, originalQuestion, onSend }: {
  confidenceReason: string; chunksUsed: number; originalQuestion: string; onSend: (q: string) => void
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)

  const fetchSuggestions = async () => {
    if (fetched || loading) return
    setLoading(true)
    try {
      const res = await fetch("http://localhost:8005/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: originalQuestion, confidence_reason: confidenceReason }),
      })
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
    } catch {
      setSuggestions([
        `What methodology is used to address: ${originalQuestion}`,
        `What are the main contributions related to: ${originalQuestion}`,
        `What does the paper conclude about: ${originalQuestion}`,
      ])
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.18)", borderRadius: 6, marginBottom: 4 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke="#B45309" strokeWidth="2" strokeLinecap="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="#B45309" strokeWidth="2" strokeLinecap="round"/></svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#B45309", marginBottom: 2 }}>Weak retrieval detected</div>
        <div style={{ fontSize: 11, color: "#6B6457", lineHeight: 1.5, marginBottom: 6 }}>{confidenceReason}</div>
        <div style={{ color: "#8A8275", fontSize: 10, fontFamily: "var(--font-mono)", marginBottom: 8 }}>
          {getSmartSuggestion(confidenceReason, chunksUsed)}
        </div>
        {!fetched ? (
          <button onClick={fetchSuggestions} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", background: "rgba(15,110,86,0.08)", border: "1px solid rgba(15,110,86,0.2)", borderRadius: 5, fontSize: 10, color: loading ? "#0F6E56" : "#0F6E56", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 200ms" }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "rgba(15,110,86,0.15)" }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "rgba(15,110,86,0.08)" }}>
            {loading ? (
              <><div style={{ width: 8, height: 8, border: "1.5px solid #0F6E56", borderTopColor: "#0F6E56", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />Generating suggestions…<style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style></>
            ) : <>Suggest better queries</>}
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 10, color: "#8A8275", marginBottom: 4 }}>Try asking instead:</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {suggestions.map((q, i) => (
                <button key={i} onClick={() => onSend(q)}
                  style={{ textAlign: "left", padding: "5px 9px", background: "rgba(15,110,86,0.06)", border: "1px solid rgba(15,110,86,0.15)", borderRadius: 5, fontSize: 10, color: "#0F6E56", cursor: "pointer", fontFamily: "inherit", transition: "all 200ms", lineHeight: 1.4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(15,110,86,0.12)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(15,110,86,0.3)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(15,110,86,0.06)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(15,110,86,0.15)" }}>
                  ↗ {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MarkdownContent({ content, onSourceHover, sources }: { content: string; onSourceHover?: (page: number | null) => void; sources?: Source[] }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^#{1,4}\s/.test(line)) {
      const text = line.replace(/^#{1,4}\s/, '')
      elements.push(<div key={i} style={{ fontSize: 16, fontWeight: 500, color: "#2C2820", marginTop: i > 0 ? 16 : 0, marginBottom: 6, fontFamily: "var(--font-serif)" }}>{renderInline(text, onSourceHover, sources)}</div>)
    }
    else if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
      elements.push(<div key={i} style={{ fontSize: 14, fontWeight: 500, color: "#2C2820", marginTop: i > 0 ? 12 : 0, marginBottom: 4, letterSpacing: "0.01em", fontFamily: "var(--font-serif)" }}>{line.slice(2, -2)}</div>)
    }
    else if (line.startsWith('- ') || line.startsWith('• ')) {
      const text = line.slice(2)
      elements.push(<div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}><span style={{ color: "#0F6E56", flexShrink: 0, marginTop: 2 }}>•</span><span style={{ fontSize: 14, color: "#3A352C", lineHeight: 1.7, fontFamily: "var(--font-serif)" }}>{renderInline(text, onSourceHover)}</span></div>)
    }
    else if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s(.*)/)
      if (match) elements.push(<div key={i} style={{ display: "flex", gap: 8, marginBottom: 5 }}><span style={{ color: "#0F6E56", flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: 12, marginTop: 3, fontWeight: 500 }}>{match[1]}.</span><span style={{ fontSize: 14, color: "#3A352C", lineHeight: 1.7, fontFamily: "var(--font-serif)" }}>{renderInline(match[2], onSourceHover)}</span></div>)
    }
    else if (line.trim() === '') {
      elements.push(<div key={i} style={{ height: 8 }} />)
    }
    else {
      elements.push(<p key={i} style={{ fontSize: 15, color: "#2C2820", lineHeight: 1.75, margin: "0 0 10px 0", fontWeight: 400, fontFamily: "var(--font-serif)" }}>{renderInline(line, onSourceHover)}</p>)
    }
    i++
  }
  return <div>{elements}</div>
}

function CitationBadge({ part, pageNum, snippet, onSourceHover }: { part: string; pageNum: number; snippet?: string; onSourceHover?: (page: number | null) => void }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: "relative", display: "inline-block", margin: "0 2px" }}
      onMouseEnter={() => { setShow(true); onSourceHover?.(pageNum) }}
      onMouseLeave={() => { setShow(false); onSourceHover?.(null) }}>
      <span style={{ fontSize: 10, color: show ? "#fff" : "#0F6E56", background: show ? "#0F6E56" : "rgba(15,110,86,0.1)", border: `1px solid ${show ? "#0F6E56" : "rgba(15,110,86,0.3)"}`, borderRadius: 4, padding: "2px 6px", fontFamily: "var(--font-mono)", cursor: "pointer", transition: "all 150ms", display: "inline-block", fontWeight: 600 }}>
        {part}
      </span>
      {show && snippet && (
        <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, background: "#FAF6EC", border: "1px solid #D6CDBB", borderRadius: 8, padding: "8px 10px", width: 240, zIndex: 200, pointerEvents: "none" }}>
          <div style={{ fontSize: 9, color: "#A39C8C", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Page {pageNum} · Source snippet</div>
          <p style={{ fontSize: 11, color: "#6B6457", lineHeight: 1.6, margin: 0, fontStyle: "italic", fontFamily: "var(--font-serif)" }}>"{snippet}{(snippet?.length ?? 0) >= 120 ? "…" : ""}"</p>
          <div style={{ position: "absolute", top: "100%", left: 10, width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #D6CDBB" }} />
        </div>
      )}
    </span>
  )
}

function renderInline(text: string, onSourceHover?: (page: number | null) => void, sources?: Source[]): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\(Page \d+\))/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: "#2C2820", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    if (/^\(Page \d+\)$/.test(part)) {
      const pageNum = parseInt(part.match(/\d+/)?.[0] ?? "0")
      const matchedSource = sources?.find(s => s.page === pageNum)
      const snippet = matchedSource?.snippet?.slice(0, 120)
      return <CitationBadge key={i} part={part} pageNum={pageNum} snippet={snippet} onSourceHover={onSourceHover} />
    }
    return part
  })
}

function EvidenceTabs({ sources, onPageJump, onSourceHover }: { sources: Source[]; onPageJump: (p: number) => void; onSourceHover: (page: number | null) => void }) {
  const [activeTab, setActiveTab] = useState<"most_relevant" | "supporting" | "low_confidence">("most_relevant")
  const mostRelevant = sources.filter((s: any) => s.tier === "most_relevant")
  const supporting = sources.filter((s: any) => s.tier === "supporting")
  const lowConf = sources.filter((s: any) => s.tier === "low_confidence")
  const tabs = [
    { key: "most_relevant" as const, label: "Most Relevant", count: mostRelevant.length, color: "#15803D" },
    { key: "supporting" as const, label: "Supporting", count: supporting.length, color: "#0F6E56" },
    { key: "low_confidence" as const, label: "Low Confidence", count: lowConf.length, color: "#B45309" },
  ].filter(t => t.count > 0)
  if (tabs.length === 0) return null
  const currentSources = activeTab === "most_relevant" ? mostRelevant : activeTab === "supporting" ? supporting : lowConf
  return (
    <div style={{ marginTop: 8, background: "#EFE8DA", border: "1px solid #E0D9CA", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #E0D9CA" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ flex: 1, padding: "6px 4px", background: activeTab === tab.key ? "#FAF6EC" : "transparent", border: "none", borderBottom: activeTab === tab.key ? `2px solid ${tab.color}` : "2px solid transparent", color: activeTab === tab.key ? tab.color : "#8A8275", fontSize: 10, fontWeight: activeTab === tab.key ? 600 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 200ms", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            {tab.label}
            <span style={{ background: activeTab === tab.key ? `${tab.color}22` : "#E0D9CA", color: activeTab === tab.key ? tab.color : "#8A8275", borderRadius: 3, padding: "0 4px", fontSize: 9, fontFamily: "var(--font-mono)" }}>{tab.count}</span>
          </button>
        ))}
      </div>
      <div style={{ padding: "8px 10px", display: "flex", flexWrap: "wrap", gap: 4 }}>
        {currentSources.map((src, i) => {
          const score = (src as any).reranker_score ?? src.relevance ?? 0.5
          const color = tabs.find(t => t.key === activeTab)?.color ?? "#0F6E56"
          return (
            <button key={i} onClick={() => onPageJump(src.page)} onMouseEnter={() => onSourceHover(src.page)} onMouseLeave={() => onSourceHover(null)}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "#FAF6EC", border: `1px solid ${color}22`, borderRadius: 5, fontSize: 11, color: "#6B6457", cursor: "pointer", fontFamily: "inherit", transition: "all 200ms" }}
              onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}55`; (e.currentTarget as HTMLElement).style.color = color }}
              onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}22`; (e.currentTarget as HTMLElement).style.color = "#6B6457" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Page {src.page}
              <span style={{ color: "#A39C8C", fontFamily: "var(--font-mono)", fontSize: 9 }}>{score > 0 ? `${Math.round(score * 100)}%` : "—"}</span>→
            </button>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ activeDoc, onSend, compareMode, compareDocA, compareDocB }: { activeDoc: PaperDocument | null; onSend: (t: string) => void; compareMode: boolean; compareDocA: PaperDocument | null; compareDocB: PaperDocument | null }) {
  const suggestions = compareMode
    ? ["What are the main contributions of each document?", "How do their methodologies differ?", "Which document has stronger results?", "What do both documents agree on?"]
    : ["What is the main contribution of this paper?", "Summarize the methodology used.", "What are the key findings?", "What limitations are mentioned?"]
  const isReady = compareMode ? (!!compareDocA && !!compareDocB) : !!activeDoc
  return (
    <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 40, height: 40, background: compareMode ? "rgba(17,133,106,0.08)" : "rgba(15,110,86,0.08)", border: `1px solid ${compareMode ? "rgba(17,133,106,0.15)" : "rgba(15,110,86,0.15)"}`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
          {compareMode ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="#11856A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="#0F6E56" strokeWidth="1.8"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round"/></svg>}
        </div>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#2C2820", marginBottom: 4, fontFamily: "var(--font-serif)" }}>
          {compareMode ? compareDocA && compareDocB ? "Ready to compare" : "Select two documents" : activeDoc ? "Ready to analyze" : "No document loaded"}
        </div>
        <div style={{ fontSize: 12, color: "#8A8275", lineHeight: 1.6 }}>
          {compareMode ? compareDocA && compareDocB ? `Comparing "${compareDocA.name}" vs "${compareDocB.name}"` : "Choose documents A and B from the left panel" : activeDoc ? `Ask ScholarLens anything about "${activeDoc.name}"` : "Upload a PDF to begin"}
        </div>
      </div>
      {isReady && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#8A8275", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Suggested queries</div>
          {suggestions.map(s => (
            <div key={s} onClick={() => onSend(s)}
              style={{ padding: "9px 12px", background: "#FAF6EC", border: "1px solid #E0D9CA", borderRadius: 6, marginBottom: 5, fontSize: 13, color: "#3A352C", cursor: "pointer", transition: "all 200ms", lineHeight: 1.4, fontFamily: "var(--font-serif)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = compareMode ? "rgba(17,133,106,0.3)" : "rgba(15,110,86,0.3)"; (e.currentTarget as HTMLElement).style.color = "#2C2820" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E0D9CA"; (e.currentTarget as HTMLElement).style.color = "#3A352C" }}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ThinkingIndicator({ stage }: { stage: string }) {
  return (
    <div style={{ margin: "4px 16px", padding: "10px 12px", background: "rgba(15,110,86,0.06)", border: "1px solid rgba(15,110,86,0.15)", borderRadius: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ display: "flex", gap: 3 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#0F6E56", animation: "bounce 0.9s infinite", animationDelay: `${i * 0.15}s` }} />)}
        </div>
        <span style={{ fontSize: 12, color: "#0F6E56", fontFamily: "var(--font-mono)" }}>{stage}</span>
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }`}</style>
    </div>
  )
}

function getChunkReason(rank: number, score: number, tier: string): string {
  if (rank === 0 && score > 0.8) return "Highest semantic + keyword match — top result after re-ranking"
  if (rank === 0) return "Best available match — selected as primary source"
  if (tier === "most_relevant") return "Strong query alignment — ranked highly by cross-encoder"
  if (tier === "supporting" && score > 0.5) return "Moderate relevance — included to support primary source"
  if (tier === "supporting") return "Partial keyword overlap — included for broader context"
  return "Low semantic match — included as fallback context"
}

function getSmartSuggestion(reason: string, chunksUsed: number): string {
  if (reason.includes("distance")) {
    const match = reason.match(/distance ([\d.]+)/)
    const dist = match ? parseFloat(match[1]) : 999
    if (dist > 2.0) return "The question may not match this document's content. Try rephrasing using terms from the paper itself."
    if (dist > 1.5) return "Try increasing Retrieval Depth to 10, or rephrase with more specific keywords."
  }
  if (reason.includes("No candidates")) return "No passages were retrieved. Try uploading the document again or increasing Retrieval Depth."
  if (chunksUsed <= 1) return "Very few passages matched. Try switching Answer Style to Bullets and increasing Retrieval Depth."
  return "Try rephrasing your question or asking about a specific section like methodology, results, or limitations."
}

function MessageBubble({ message, onPageJump, onSend, onSourceHover }: { message: Message; onPageJump: (p: number) => void; onSend: (t: string) => void; onSourceHover: (page: number | null) => void }) {
  const isUser = message.role === "user"
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState<null | "up" | "down">(null)
  const [showExplain, setShowExplain] = useState(false)
  const copy = () => { navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 16px" }}>
        <div style={{ maxWidth: "82%", background: "#E8E0D0", border: "1px solid #D6CDBB", borderRadius: "10px 10px 3px 10px", padding: "10px 14px", fontSize: 13, color: "#2C2820", lineHeight: 1.6 }}>
          {message.content}
        </div>
      </div>
    )
  }

  if (message.isDecomposition && message.decomposition) {
    return <DecompositionCard decomposition={message.decomposition} onPageJump={onPageJump} />
  }

  if (message.isComparison) {
    return (
      <div style={{ padding: "6px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <div style={{ width: 20, height: 20, background: "rgba(17,133,106,0.15)", border: "1px solid rgba(17,133,106,0.3)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="#11856A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#11856A" }}>Comparison Result</span>
          {message.confidence && <ConfidenceBadge level={message.confidence} reason={(message as any).confidenceReason} />}
        </div>
        <div style={{ background: "#FCFAF4", border: "1px solid #EAE2D2", borderRadius: 8, padding: "16px 18px", marginBottom: 2 }}>
          <MarkdownContent content={message.content} onSourceHover={onSourceHover} sources={message.sources} />
        </div>
        {((message.sourcesA?.length ?? 0) > 0 || (message.sourcesB?.length ?? 0) > 0) && (
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            {message.sourcesA && message.sourcesA.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#0F6E56", fontWeight: 600, marginBottom: 4 }}>DOC A</div>
                {message.sourcesA.map((src, i) => (
                  <button key={i} onClick={() => onPageJump(src.page)} onMouseEnter={() => onSourceHover(src.page)} onMouseLeave={() => onSourceHover(null)}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "#FAF6EC", border: "1px solid #E0D9CA", borderRadius: 5, fontSize: 11, color: "#6B6457", cursor: "pointer", fontFamily: "inherit", marginBottom: 3, width: "100%", transition: "all 200ms" }}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(15,110,86,0.3)"; (e.currentTarget as HTMLElement).style.color = "#0F6E56" }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E0D9CA"; (e.currentTarget as HTMLElement).style.color = "#6B6457" }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Page {src.page}
                  </button>
                ))}
              </div>
            )}
            {message.sourcesB && message.sourcesB.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#11856A", fontWeight: 600, marginBottom: 4 }}>DOC B</div>
                {message.sourcesB.map((src, i) => (
                  <button key={i} onClick={() => onPageJump(src.page)} onMouseEnter={() => onSourceHover(src.page)} onMouseLeave={() => onSourceHover(null)}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "#FAF6EC", border: "1px solid #E0D9CA", borderRadius: 5, fontSize: 11, color: "#6B6457", cursor: "pointer", fontFamily: "inherit", marginBottom: 3, width: "100%", transition: "all 200ms" }}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(17,133,106,0.3)"; (e.currentTarget as HTMLElement).style.color = "#11856A" }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E0D9CA"; (e.currentTarget as HTMLElement).style.color = "#6B6457" }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Page {src.page}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
          <ActionBtn onClick={copy} title="Copy">{copied ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2"/></svg>}</ActionBtn>
          <ActionBtn onClick={() => setLiked(liked === "up" ? null : "up")} title="Good" active={liked === "up"}><svg width="11" height="11" viewBox="0 0 24 24" fill={liked === "up" ? "#15803D" : "none"}><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" stroke="currentColor" strokeWidth="2"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" stroke="currentColor" strokeWidth="2"/></svg></ActionBtn>
          <ActionBtn onClick={() => setLiked(liked === "down" ? null : "down")} title="Bad" active={liked === "down"}><svg width="11" height="11" viewBox="0 0 24 24" fill={liked === "down" ? "#DC2626" : "none"}><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" stroke="currentColor" strokeWidth="2"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" stroke="currentColor" strokeWidth="2"/></svg></ActionBtn>
        </div>
      </div>
    )
  }

  const isLowConfidence = message.confidence === "low"
  const isMediumConfidence = message.confidence === "medium"
  const confidenceReason = (message as any).confidenceReason ?? ""
  const retrievalMs = (message as any).retrievalMs ?? 0
  const rerankMs = (message as any).rerankMs ?? 0
  const chunksUsed = (message as any).chunksUsed ?? (message.sources?.length ?? 0)
  const cached = (message as any).cached ?? false
  const originalQuestion = (message as any).originalQuestion ?? ""

  return (
    <div style={{ padding: "6px 16px 4px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <div style={{ width: 20, height: 20, background: "rgba(15,110,86,0.1)", border: "1px solid rgba(15,110,86,0.2)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#0F6E56" }}>ScholarLens</span>
        {message.confidence && <ConfidenceBadge level={message.confidence} reason={confidenceReason} />}
      </div>

      {isLowConfidence && (
        <LowConfidenceBanner
          confidenceReason={confidenceReason}
          chunksUsed={chunksUsed}
          originalQuestion={originalQuestion}
          onSend={onSend}
        />
      )}

      {isMediumConfidence && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 10px", background: "rgba(180,83,9,0.06)", border: "1px solid rgba(180,83,9,0.16)", borderRadius: 6, marginBottom: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" stroke="#B45309" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="#B45309" strokeWidth="2" strokeLinecap="round"/></svg>
          <div style={{ fontSize: 11, color: "#B45309", lineHeight: 1.5 }}>{confidenceReason || "Partial match — verify against the document."}</div>
        </div>
      )}

      <div style={{ background: "#FCFAF4", border: "1px solid #EAE2D2", borderRadius: 8, padding: "16px 18px", marginBottom: 2 }}>
        <MarkdownContent content={message.content} onSourceHover={onSourceHover} sources={message.sources} />
      </div>

      {message.sources && message.sources.length > 0 && (
        <div style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)", padding: "4px 2px", letterSpacing: "0.01em" }}>
          Answer generated using{" "}
          <span style={{ color: "#6B6457" }}>{chunksUsed}</span>{" "}
          <span style={{ color: message.confidence === "high" ? "#15803D" : message.confidence === "medium" ? "#B45309" : "#DC2626" }}>
            {message.confidence === "high" ? "high" : message.confidence === "medium" ? "medium" : "low"}-relevance
          </span>{" "}
          chunk{chunksUsed !== 1 ? "s" : ""}{" "}
          <span>(pages {message.sources.map(s => s.page).join(", ")})</span>{" "}
          after re-ranking
          {message.confidence === "low" && (
            <span style={{ color: "#B45309", display: "block", marginTop: 2 }}>
              Result may be incomplete due to lack of strong evidence.
            </span>
          )}
        </div>
      )}

      {message.confidence && (
        <MetricsStrip retrievalMs={retrievalMs} rerankMs={rerankMs} chunksUsed={chunksUsed} confidence={message.confidence} cached={cached} />
      )}

      {message.sources && message.sources.length > 0 && (
        <EvidenceTabs sources={message.sources} onPageJump={onPageJump} onSourceHover={onSourceHover} />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 2 }}>
        <ActionBtn onClick={copy} title="Copy">{copied ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}</ActionBtn>
        <ActionBtn onClick={() => setLiked(liked === "up" ? null : "up")} title="Good" active={liked === "up"}><svg width="11" height="11" viewBox="0 0 24 24" fill={liked === "up" ? "#15803D" : "none"}><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></ActionBtn>
        <ActionBtn onClick={() => setLiked(liked === "down" ? null : "down")} title="Bad" active={liked === "down"}><svg width="11" height="11" viewBox="0 0 24 24" fill={liked === "down" ? "#DC2626" : "none"}><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></ActionBtn>
        {message.sources && message.sources.length > 0 && (
          <ActionBtn onClick={() => setShowExplain(v => !v)} title="Why this answer?" active={showExplain}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </ActionBtn>
        )}
      </div>

      {showExplain && message.sources && message.sources.length > 0 && (
        <div style={{ background: "#FAF6EC", border: "1px solid #E0D9CA", borderRadius: 8, padding: "12px 14px", marginTop: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#8A8275", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Why These Sources?</div>
          {message.sources.map((src, i) => {
            const score = (src as any).reranker_score ?? src.relevance ?? 0.5
            return (
              <div key={i} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: i < (message.sources?.length ?? 0) - 1 ? "1px solid #E0D9CA" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <button onClick={() => onPageJump(src.page)} onMouseEnter={() => onSourceHover(src.page)} onMouseLeave={() => onSourceHover(null)}
                    style={{ fontSize: 10, color: "#0F6E56", background: "rgba(15,110,86,0.08)", border: "1px solid rgba(15,110,86,0.2)", borderRadius: 4, padding: "2px 7px", cursor: "pointer", fontFamily: "var(--font-mono)" }}
                    onMouseOver={e => (e.currentTarget as HTMLElement).style.background = "rgba(15,110,86,0.15)"}
                    onMouseOut={e => (e.currentTarget as HTMLElement).style.background = "rgba(15,110,86,0.08)"}>
                    Page {src.page} ↑
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <div style={{ width: 36, height: 2, background: "#E0D9CA", borderRadius: 1 }}>
                      <div style={{ height: "100%", width: `${score * 100}%`, background: "#0F6E56", borderRadius: 1 }} />
                    </div>
                    <span style={{ fontSize: 10, color: "#8A8275", fontFamily: "var(--font-mono)" }}>{score > 0 ? `${Math.round(score * 100)}%` : "—"}</span>
                  </div>
                  {(src as any).tier && (
                    <span style={{ fontSize: 9, color: (src as any).tier === "most_relevant" ? "#15803D" : (src as any).tier === "supporting" ? "#0F6E56" : "#B45309", fontFamily: "var(--font-mono)", background: "rgba(44,40,32,0.06)", padding: "1px 5px", borderRadius: 3 }}>
                      {(src as any).tier?.replace("_", " ")}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: "#6B6457", fontFamily: "var(--font-mono)", marginBottom: 5, background: "rgba(15,110,86,0.05)", border: "1px solid rgba(15,110,86,0.1)", borderRadius: 4, padding: "3px 7px" }}>
                  → {getChunkReason(i, (src as any).reranker_score ?? src.relevance ?? 0, (src as any).tier ?? "")}
                </div>
                <p style={{ fontSize: 11, color: "#8A8275", lineHeight: 1.6, margin: 0, fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
                  "{src.snippet?.slice(0, 140)}{(src.snippet?.length ?? 0) > 140 ? "…" : ""}"
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DecompositionCard({ decomposition, onPageJump }: { decomposition: DecompositionData; onPageJump: (p: number) => void }) {
  const [activeTab, setActiveTab] = useState<"contributions" | "methodology" | "limitations" | "assumptions">("contributions")
  const [copied, setCopied] = useState(false)
  const sections = [
    { key: "contributions" as const, label: "Contributions", icon: "🎯", color: "#0F6E56", bg: "rgba(15,110,86,0.06)", content: decomposition.contributions, sources: decomposition.contributionsSources, description: "Novel ideas and main claims" },
    { key: "methodology" as const, label: "Methods", icon: "⚙️", color: "#11856A", bg: "rgba(17,133,106,0.06)", content: decomposition.methodology, sources: decomposition.methodologySources, description: "Techniques and architecture" },
    { key: "limitations" as const, label: "Limitations", icon: "⚠️", color: "#B45309", bg: "rgba(180,83,9,0.06)", content: decomposition.limitations, sources: decomposition.limitationsSources, description: "Weaknesses and future work" },
    { key: "assumptions" as const, label: "Assumptions", icon: "💡", color: "#15803D", bg: "rgba(21,128,61,0.06)", content: decomposition.assumptions, sources: decomposition.assumptionsSources, description: "Problem and data assumptions" },
  ]
  const active = sections.find(s => s.key === activeTab)!
  const totalSources = sections.reduce((acc, s) => acc + s.sources.length, 0)
  const generatedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const copyReport = () => {
    const text = sections.map(s => `## ${s.icon} ${s.label}\n${s.description}\n\n${s.content}\n\nSources: Pages ${s.sources.map(p => p.page).join(", ") || "—"}`).join("\n\n---\n\n")
    navigator.clipboard.writeText(`# ScholarLens Research Brief\n\n${text}`)
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div style={{ margin: "6px 16px 8px", background: "#EFE8DA", border: "1px solid #E0D9CA", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ background: "#F2EADC", borderBottom: "1px solid #E0D9CA", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>ScholarLens · Research Brief</span>
              <span style={{ fontSize: 9, color: "#A39C8C", background: "#FAF6EC", border: "1px solid #E0D9CA", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--font-mono)" }}>4 parallel queries</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#2C2820", letterSpacing: "-0.01em", fontFamily: "var(--font-serif)" }}>ScholarLens Breakdown</div>
          </div>
          <button onClick={copyReport}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", background: copied ? "rgba(21,128,61,0.1)" : "#FAF6EC", border: `1px solid ${copied ? "rgba(21,128,61,0.3)" : "#E0D9CA"}`, borderRadius: 6, fontSize: 10, color: copied ? "#15803D" : "#8A8275", cursor: "pointer", fontFamily: "inherit", transition: "all 200ms", flexShrink: 0 }}
            onMouseEnter={e => { if (!copied) { (e.currentTarget as HTMLElement).style.borderColor = "rgba(15,110,86,0.3)"; (e.currentTarget as HTMLElement).style.color = "#6B6457" } }}
            onMouseLeave={e => { if (!copied) { (e.currentTarget as HTMLElement).style.borderColor = "#E0D9CA"; (e.currentTarget as HTMLElement).style.color = "#8A8275" } }}>
            {copied ? <><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#15803D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied!</> : <><svg width="10" height="10" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Copy report</>}
          </button>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[{ label: "Sections", value: "4" }, { label: "Sources", value: String(totalSources) }, { label: "Generated", value: generatedAt }].map(stat => (
            <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#2C2820", fontFamily: "var(--font-mono)" }}>{stat.value}</span>
              <span style={{ fontSize: 10, color: "#A39C8C" }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, borderBottom: "1px solid #E0D9CA" }}>
        {sections.map((section, i) => (
          <button key={section.key} onClick={() => setActiveTab(section.key)}
            style={{ padding: "10px 6px 8px", background: activeTab === section.key ? section.bg : "transparent", border: "none", borderRight: i < 3 ? "1px solid #E0D9CA" : "none", borderBottom: activeTab === section.key ? `2px solid ${section.color}` : "2px solid transparent", cursor: "pointer", fontFamily: "inherit", transition: "all 150ms", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
            onMouseEnter={e => { if (activeTab !== section.key) (e.currentTarget as HTMLElement).style.background = "rgba(44,40,32,0.03)" }}
            onMouseLeave={e => { if (activeTab !== section.key) (e.currentTarget as HTMLElement).style.background = "transparent" }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{section.icon}</span>
            <span style={{ fontSize: 9, fontWeight: activeTab === section.key ? 700 : 500, color: activeTab === section.key ? section.color : "#8A8275", letterSpacing: "0.04em", textTransform: "uppercase" }}>{section.label}</span>
            {section.sources.length > 0 && (
              <span style={{ fontSize: 8, color: activeTab === section.key ? section.color : "#A39C8C", fontFamily: "var(--font-mono)", background: activeTab === section.key ? `${section.color}15` : "#FAF6EC", padding: "1px 4px", borderRadius: 2 }}>{section.sources.length}p</span>
            )}
          </button>
        ))}
      </div>
      <div>
        <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #E0D9CA" }}>
          <span style={{ fontSize: 14 }}>{active.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: active.color }}>{active.label}</div>
            <div style={{ fontSize: 10, color: "#A39C8C" }}>{active.description}</div>
          </div>
          {active.sources.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {active.sources.map((src, i) => (
                <button key={i} onClick={() => onPageJump(src.page)}
                  style={{ padding: "2px 7px", background: "#F6F1E7", border: `1px solid ${active.color}25`, borderRadius: 4, fontSize: 9, color: "#8A8275", cursor: "pointer", fontFamily: "var(--font-mono)", transition: "all 150ms" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${active.color}60`; (e.currentTarget as HTMLElement).style.color = active.color }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${active.color}25`; (e.currentTarget as HTMLElement).style.color = "#8A8275" }}>
                  p.{src.page}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: "12px 16px 14px", maxHeight: 280, overflowY: "auto" }}>
          <MarkdownContent content={active.content} />
        </div>
      </div>
      <div style={{ borderTop: "1px solid #E0D9CA", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "#A39C8C", fontFamily: "var(--font-mono)" }}>ScholarLens · Hybrid RAG · {totalSources} passages</span>
        <div style={{ display: "flex", gap: 6 }}>
          {sections.map(s => (
            <button key={s.key} onClick={() => setActiveTab(s.key)}
              style={{ width: 6, height: 6, borderRadius: "50%", background: activeTab === s.key ? s.color : "#E0D9CA", border: `1px solid ${activeTab === s.key ? s.color : "#D6CDBB"}`, cursor: "pointer", padding: 0, transition: "all 150ms" }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ConfidenceBadge({ level, reason }: { level: "high" | "medium" | "low"; reason?: string }) {
  const [show, setShow] = useState(false)
  const config = {
    high: { color: "#15803D", bg: "rgba(21,128,61,0.1)", border: "rgba(21,128,61,0.2)", label: "High confidence" },
    medium: { color: "#B45309", bg: "rgba(180,83,9,0.1)", border: "rgba(180,83,9,0.2)", label: "Medium confidence" },
    low: { color: "#B45309", bg: "rgba(180,83,9,0.08)", border: "rgba(180,83,9,0.18)", label: "Low confidence" }
  }
  const c = config[level]
  return (
    <div style={{ position: "relative", display: "inline-flex" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span style={{ fontSize: 9, color: c.color, background: c.bg, border: `1px solid ${c.border}`, padding: "2px 6px", borderRadius: 3, fontFamily: "var(--font-mono)", fontWeight: 600, letterSpacing: "0.05em", cursor: reason ? "help" : "default" }}>
        {c.label.toUpperCase()}
      </span>
      {reason && show && (
        <div style={{ position: "absolute", bottom: "calc(100% + 5px)", left: 0, background: "#FAF6EC", border: "1px solid #D6CDBB", borderRadius: 6, padding: "6px 9px", fontSize: 11, color: "#6B6457", lineHeight: 1.5, width: 200, zIndex: 100, whiteSpace: "normal" }}>
          {reason}
          <div style={{ position: "absolute", top: "100%", left: 10, width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #D6CDBB" }} />
        </div>
      )}
    </div>
  )
}

function ActionBtn({ onClick, title, children, active }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 24, height: 24, borderRadius: 4, background: "transparent", border: "1px solid transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: active ? "#0F6E56" : "#8A8275", transition: "all 200ms" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FAF6EC"; (e.currentTarget as HTMLElement).style.color = "#6B6457" }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = active ? "#0F6E56" : "#8A8275" }}>
      {children}
    </button>
  )
}