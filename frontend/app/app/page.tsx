"use client"

import { useState } from "react"
import { LeftPanel } from "@/components/left-panel"
import { MiddlePanel } from "@/components/middle-panel"
import { RightPanel } from "@/components/right-panel"

export type PaperDocument = {
  id: string
  name: string
  size: string
  chunks: number
  uploadedAt: Date
  active: boolean
  file?: File
  objectUrl?: string
}

export type QueryHistory = {
  id: string
  query: string
  timestamp: Date
}

export type Source = {
  page: number
  snippet: string
  relevance: number
}

export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
  sourcesA?: Source[]
  sourcesB?: Source[]
  confidence?: "high" | "medium" | "low"
  isComparison?: boolean
  confidenceReason?: string
  retrievalMs?: number
  rerankMs?: number
  chunksUsed?: number
  cached?: boolean
  originalQuestion?: string
  isDecomposition?: boolean
  decomposition?: DecompositionData
  timestamp: Date
}

export type DecompositionData = {
  contributions: string
  methodology: string
  limitations: string
  assumptions: string
  contributionsSources: Source[]
  methodologySources: Source[]
  limitationsSources: Source[]
  assumptionsSources: Source[]
}

export type RagSettings = {
  k: number
  answerStyle: "concise" | "detailed" | "bullet"
  temperature: number
}

async function callAsk(question: string, docId: string, settings: RagSettings): Promise<{ answer: string; sources?: any[]; confidence?: string; confidence_reason?: string; retrieval_ms?: number; rerank_ms?: number; chunks_used?: number; cached?: boolean }> {
  const res = await fetch("https://LordMorata-scholarlens-backend.hf.space/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, doc_id: docId, k: settings.k, answer_style: settings.answerStyle, temperature: settings.temperature }),
  })
  if (!res.ok) throw new Error(`Server error: ${res.status}`)
  return res.json()
}

async function callCompare(question: string, docIdA: string, docIdB: string, settings: RagSettings): Promise<{ answer: string; sources_a?: any[]; sources_b?: any[]; confidence?: string }> {
  const res = await fetch("https://LordMorata-scholarlens-backend.hf.space/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, doc_id_a: docIdA, doc_id_b: docIdB, k: settings.k, answer_style: settings.answerStyle, temperature: settings.temperature }),
  })
  if (!res.ok) throw new Error(`Compare error: ${res.status}`)
  return res.json()
}

async function callUpload(file: File, docId: string): Promise<{ chunks: number }> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("doc_id", docId)
  const res = await fetch("https://LordMorata-scholarlens-backend.hf.space/upload", { method: "POST", body: formData })
  if (!res.ok) throw new Error("Upload failed")
  return res.json()
}

function toSources(arr: any[]): Source[] {
  return (arr ?? []).map((s: any, i: number) => ({
    page: s.page ?? (s.chunk_id ?? i) + 1,
    snippet: (s.text ?? "").slice(0, 200),
    relevance: s.reranker_score ?? parseFloat((0.94 - i * 0.07).toFixed(2)),
    ...(s.tier && { tier: s.tier }),
    ...(s.reranker_score !== undefined && { reranker_score: s.reranker_score }),
  }))
}

export default function Page() {
  const [documents, setDocuments] = useState<PaperDocument[]>([])
  const [activeDoc, setActiveDoc] = useState<PaperDocument | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isThinking, setIsThinking] = useState(false)
  const [thinkingStage, setThinkingStage] = useState("")
  const [evidenceSources, setEvidenceSources] = useState<Source[]>([])
  const [highlightPage, setHighlightPage] = useState<number | null>(null)
  const [ragSettings, setRagSettings] = useState<RagSettings>({ k: 8, answerStyle: "detailed", temperature: 0.3 })
  const [compareMode, setCompareMode] = useState(false)
  const [compareDocA, setCompareDocA] = useState<PaperDocument | null>(null)
  const [compareDocB, setCompareDocB] = useState<PaperDocument | null>(null)
  const [hoveredSourcePage, setHoveredSourcePage] = useState<number | null>(null)

  const handleUpload = async (file: File) => {
    setIsUploading(true); setUploadProgress(0)
    const docId = `doc-${Date.now()}`
    const iv = setInterval(() => setUploadProgress(p => p >= 85 ? p : p + 11), 160)
    try {
      const result = await callUpload(file, docId)
      clearInterval(iv); setUploadProgress(100)
      const objectUrl = URL.createObjectURL(file)
      const doc: PaperDocument = {
        id: docId, name: file.name.replace(".pdf", ""),
        size: `${(file.size / 1024).toFixed(0)} KB`,
        chunks: result.chunks, uploadedAt: new Date(), active: true, file, objectUrl,
      }
      setDocuments(prev => prev.map(d => ({ ...d, active: false })).concat(doc))
      setActiveDoc(doc)
      setMessages([{ id: `sys-${Date.now()}`, role: "assistant", content: `**${doc.name}** indexed successfully.\n\n${result.chunks} passages extracted and ready for semantic retrieval. Ask anything about this document.`, timestamp: new Date() }])
      setEvidenceSources([]); setHighlightPage(null)
    } catch { clearInterval(iv) }
    finally { setTimeout(() => { setIsUploading(false); setUploadProgress(0) }, 700) }
  }

  const handleSend = async (text: string) => {
    if (compareMode) { await handleCompare(text); return }
    if (!activeDoc) return
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: "user", content: text, timestamp: new Date() }])
    setQueryHistory(prev => [{ id: `q-${Date.now()}`, query: text, timestamp: new Date() }, ...prev.slice(0, 9)])
    setIsThinking(true); setThinkingStage("Searching relevant sections…")
    const t1 = setTimeout(() => setThinkingStage("Ranking passages by relevance…"), 800)
    const t2 = setTimeout(() => setThinkingStage("Synthesizing answer…"), 1700)
    try {
      const data = await callAsk(text, activeDoc.id, ragSettings)
      const sources = toSources(data.sources ?? [])
      setEvidenceSources(sources)
      const confidence: "high" | "medium" | "low" = (data.confidence as any) ?? (sources.length >= 3 ? "high" : sources.length >= 1 ? "medium" : "low")
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`, role: "assistant",
        content: data.answer ?? "No answer.",
        sources, confidence,
        confidenceReason: data.confidence_reason ?? "",
        retrievalMs: data.retrieval_ms ?? 0,
        rerankMs: data.rerank_ms ?? 0,
        chunksUsed: data.chunks_used ?? sources.length,
        cached: data.cached ?? false,
        originalQuestion: text,
        timestamp: new Date()
      }])
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "Failed to retrieve answer. Ensure the backend is running on port 8005.", timestamp: new Date() }])
    } finally { clearTimeout(t1); clearTimeout(t2); setIsThinking(false); setThinkingStage("") }
  }

  const handleCompare = async (text: string) => {
    if (!compareDocA || !compareDocB) return
    setMessages(prev => [...prev, { id: `u-${Date.now()}`, role: "user", content: text, timestamp: new Date() }])
    setQueryHistory(prev => [{ id: `q-${Date.now()}`, query: text, timestamp: new Date() }, ...prev.slice(0, 9)])
    setIsThinking(true); setThinkingStage("Searching Document A…")
    const t1 = setTimeout(() => setThinkingStage("Searching Document B…"), 700)
    const t2 = setTimeout(() => setThinkingStage("Comparing and synthesizing…"), 1500)
    try {
      const data = await callCompare(text, compareDocA.id, compareDocB.id, ragSettings)
      setMessages(prev => [...prev, {
        id: `cmp-${Date.now()}`, role: "assistant",
        content: data.answer ?? "No comparison returned.",
        sourcesA: toSources(data.sources_a ?? []),
        sourcesB: toSources(data.sources_b ?? []),
        isComparison: true,
        confidence: (data.confidence as any) ?? "medium",
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "Comparison failed. Ensure both documents are indexed.", timestamp: new Date() }])
    } finally { clearTimeout(t1); clearTimeout(t2); setIsThinking(false); setThinkingStage("") }
  }

  const handleDecompose = async () => {
    if (!activeDoc || isThinking) return
    setIsThinking(true)
    setThinkingStage("Decomposing paper structure…")
    const queries = {
      contributions: "What are the main contributions and novel ideas introduced in this paper?",
      methodology: "What methodology, methods, techniques, and system architecture are used in this paper?",
      limitations: "What are the limitations, weaknesses, or future work mentioned in this paper?",
      assumptions: "What assumptions does this paper make about the problem, data, or environment?",
    }
    const conciseSettings: RagSettings = { ...ragSettings, answerStyle: "bullet", k: 6 }
    try {
      const [contribData, methodData, limData, assumeData] = await Promise.all([
        callAsk(queries.contributions, activeDoc.id, conciseSettings),
        callAsk(queries.methodology, activeDoc.id, conciseSettings),
        callAsk(queries.limitations, activeDoc.id, conciseSettings),
        callAsk(queries.assumptions, activeDoc.id, conciseSettings),
      ])
      const decomposition: DecompositionData = {
        contributions: contribData.answer ?? "Not found.",
        methodology: methodData.answer ?? "Not found.",
        limitations: limData.answer ?? "Not found.",
        assumptions: assumeData.answer ?? "Not found.",
        contributionsSources: toSources(contribData.sources ?? []),
        methodologySources: toSources(methodData.sources ?? []),
        limitationsSources: toSources(limData.sources ?? []),
        assumptionsSources: toSources(assumeData.sources ?? []),
      }
      setEvidenceSources(decomposition.contributionsSources)
      setMessages(prev => [...prev, {
        id: `decomp-${Date.now()}`,
        role: "assistant",
        content: "",
        isDecomposition: true,
        decomposition,
        confidence: "high",
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: "Decomposition failed. Ensure the backend is running.", timestamp: new Date() }])
    } finally {
      setIsThinking(false); setThinkingStage("")
    }
  }

  const handleNewSession = () => {
    setMessages([]); setQueryHistory([]); setEvidenceSources([])
    setDocuments(prev => prev.map(d => ({ ...d, active: false }))); setActiveDoc(null)
    setHighlightPage(null); setCompareMode(false); setCompareDocA(null); setCompareDocB(null)
  }

  const handleSelectDoc = (doc: PaperDocument) => {
    if (compareMode) {
      if (!compareDocA || (compareDocA && compareDocB)) { setCompareDocA(doc); setCompareDocB(null) }
      else if (compareDocA && doc.id !== compareDocA.id) { setCompareDocB(doc) }
      return
    }
    setDocuments(prev => prev.map(d => ({ ...d, active: d.id === doc.id }))); setActiveDoc(doc)
    setHighlightPage(null)
  }

  const handlePageJump = (page: number) => {
    setHighlightPage(page); setTimeout(() => setHighlightPage(null), 2800)
  }

  const handleToggleCompare = () => {
    if (compareMode) {
      setCompareMode(false); setCompareDocA(null); setCompareDocB(null)
      if (activeDoc) setDocuments(prev => prev.map(d => ({ ...d, active: d.id === activeDoc.id })))
    } else {
      setCompareMode(true); setCompareDocA(activeDoc); setCompareDocB(null)
    }
  }

  return (
<div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#F6F1E7", fontFamily: "var(--font-sans)" }}>
      {/* ── Top navbar ── */}
      <nav style={{ height: 48, minHeight: 48, background: "#EFE8DA", borderBottom: "1px solid #E0D9CA", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", zIndex: 50 }}>

        {/* Left: logo + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "#FAF6EC ", border: "1px solid #E0D9CA", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="#0F6E56" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {/* RENAMED: PaperRAG → ScholarLens */}
<span style={{ fontSize: 16, fontWeight: 500, color: "#2C2820", letterSpacing: "-0.01em", fontFamily: "var(--font-serif)" }}>ScholarLens</span>        </div>

        {/* Centre: active doc / compare status */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", gap: 12, alignItems: "center" }}>
          {compareMode ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
<span style={{ color: "#0F6E56", fontWeight: 600, background: "rgba(15,110,86,0.1)", border: "1px solid rgba(15,110,86,0.2)", padding: "3px 10px", borderRadius: 5 }}>⇄ Compare Mode</span>              <span style={{ color: compareDocA ? "#15803D" : "#8A8275" }}>A: {compareDocA?.name ?? "—"}</span>
              <span style={{ color: "#0F6E56" }}>vs</span>
              <span style={{ color: compareDocB ? "#15803D" : "#8A8275" }}>B: {compareDocB?.name ?? "—"}</span>
            </div>
          ) : activeDoc ? (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#6B6457" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#15803D", boxShadow: "0 0 6px #15803D" }} />
              {activeDoc.name}.pdf
            </div>
          ) : null}
        </div>

        {/* Right: status indicator */}
        <div style={{ fontSize: 12, color: "#8A8275", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: activeDoc ? "#15803D" : "#8A8275" }} />
          {compareMode ? "Comparison active" : activeDoc ? "Document ready" : "No document loaded"}
        </div>
      </nav>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <LeftPanel documents={documents} queryHistory={queryHistory} activeDoc={activeDoc} onNewSession={handleNewSession} onSelectDoc={handleSelectDoc} onUpload={handleUpload} isUploading={isUploading} uploadProgress={uploadProgress} compareMode={compareMode} compareDocA={compareDocA} compareDocB={compareDocB} onToggleCompare={handleToggleCompare} />
        <MiddlePanel activeDoc={activeDoc} evidenceSources={evidenceSources} highlightPage={highlightPage} onPageJump={handlePageJump} ragSettings={ragSettings} onRagSettingsChange={setRagSettings} compareMode={compareMode} compareDocA={compareDocA} compareDocB={compareDocB} hoveredSourcePage={hoveredSourcePage} />
        <RightPanel messages={messages} isThinking={isThinking} thinkingStage={thinkingStage} activeDoc={activeDoc} onSend={handleSend} onUpload={handleUpload} onPageJump={handlePageJump} compareMode={compareMode} compareDocA={compareDocA} compareDocB={compareDocB} onDecompose={handleDecompose} onSourceHover={setHoveredSourcePage} />
      </div>
    </div>
  )
}