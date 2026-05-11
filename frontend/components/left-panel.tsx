"use client"

import { useRef, useState } from "react"
import type { PaperDocument, QueryHistory } from "@/app/page"

interface LeftPanelProps {
  documents: PaperDocument[]
  queryHistory: QueryHistory[]
  activeDoc: PaperDocument | null
  onNewSession: () => void
  onSelectDoc: (doc: PaperDocument) => void
  onUpload: (file: File) => void
  isUploading: boolean
  uploadProgress: number
  compareMode: boolean
  compareDocA: PaperDocument | null
  compareDocB: PaperDocument | null
  onToggleCompare: () => void
}

export function LeftPanel({ documents, queryHistory, activeDoc, onNewSession, onSelectDoc, onUpload, isUploading, uploadProgress, compareMode, compareDocA, compareDocB, onToggleCompare }: LeftPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [hoveredDoc, setHoveredDoc] = useState<string | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) { onUpload(f); e.target.value = "" }
  }

  const getDocState = (doc: PaperDocument) => {
    if (compareMode) {
      if (compareDocA?.id === doc.id) return "A"
      if (compareDocB?.id === doc.id) return "B"
      return "none"
    }
    return doc.active ? "active" : "none"
  }

  return (
    <aside style={{ width: 240, minWidth: 240, background: "#11161C", borderRight: "1px solid #1F2933", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* New Session */}
      <div style={{ padding: "14px 12px 8px" }}>
        <button onClick={onNewSession}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "transparent", border: "1px solid #1F2933", borderRadius: 7, color: "#9BA7B4", fontSize: 13, cursor: "pointer", transition: "all 200ms", fontFamily: "inherit" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#4F8CFF"; (e.currentTarget as HTMLElement).style.color = "#E6EDF3" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1F2933"; (e.currentTarget as HTMLElement).style.color = "#9BA7B4" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          New Session
        </button>

        {/* Compare Mode Toggle — only show when 2+ docs */}
        {documents.length >= 2 && (
          <button onClick={onToggleCompare}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", marginTop: 6, background: compareMode ? "rgba(79,140,255,0.12)" : "transparent", border: `1px solid ${compareMode ? "rgba(79,140,255,0.4)" : "#1F2933"}`, borderRadius: 7, color: compareMode ? "#4F8CFF" : "#9BA7B4", fontSize: 12, cursor: "pointer", transition: "all 200ms", fontFamily: "inherit", fontWeight: compareMode ? 600 : 400 }}
            onMouseEnter={e => !compareMode && ((e.currentTarget as HTMLElement).style.borderColor = "#374151")}
            onMouseLeave={e => !compareMode && ((e.currentTarget as HTMLElement).style.borderColor = "#1F2933")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {compareMode ? "Exit Compare" : "Compare Docs"}
          </button>
        )}

        {/* Compare instructions */}
        {compareMode && (
          <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(79,140,255,0.06)", border: "1px solid rgba(79,140,255,0.15)", borderRadius: 6 }}>
            <div style={{ fontSize: 10, color: "#4F8CFF", fontWeight: 600, marginBottom: 4 }}>SELECT TWO DOCUMENTS</div>
            <div style={{ fontSize: 10, color: "#5C6B7A", lineHeight: 1.5 }}>
              {!compareDocA ? "Click a doc to set as A" : !compareDocB ? `A: ${compareDocA.name} · click another for B` : `A: ${compareDocA.name} · B: ${compareDocB.name}`}
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ padding: "6px 12px 4px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#5C6B7A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Documents</div>

          {/* Upload button */}
          <button onClick={() => fileRef.current?.click()} disabled={isUploading}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: isUploading ? "rgba(79,140,255,0.08)" : "transparent", border: "1px dashed #1F2933", borderRadius: 7, color: "#4F8CFF", fontSize: 12, cursor: isUploading ? "not-allowed" : "pointer", transition: "all 200ms", marginBottom: 6, fontFamily: "inherit" }}
            onMouseEnter={e => !isUploading && ((e.currentTarget as HTMLElement).style.background = "rgba(79,140,255,0.08)")}
            onMouseLeave={e => !isUploading && ((e.currentTarget as HTMLElement).style.background = "transparent")}>
            {isUploading ? (
              <><div style={{ width: 14, height: 14, border: "1.5px solid rgba(79,140,255,0.3)", borderTopColor: "#4F8CFF", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} /><span>{uploadProgress}%</span></>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Upload PDF</>
            )}
          </button>

          {isUploading && (
            <div style={{ height: 2, background: "#1F2933", borderRadius: 1, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#4F8CFF", borderRadius: 1, width: `${uploadProgress}%`, transition: "width 200ms" }} />
            </div>
          )}

          {documents.length === 0 ? (
            <div style={{ padding: "12px 4px", color: "#5C6B7A", fontSize: 12, textAlign: "center", lineHeight: 1.5 }}>No documents yet.<br />Upload a PDF to begin.</div>
          ) : (
            documents.map(doc => {
              const state = getDocState(doc)
              const isA = state === "A"
              const isB = state === "B"
              const isActive = state === "active"
              const highlighted = isA || isB || isActive

              return (
                <div key={doc.id} onClick={() => onSelectDoc(doc)}
                  onMouseEnter={() => setHoveredDoc(doc.id)}
                  onMouseLeave={() => setHoveredDoc(null)}
                  style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 7, cursor: "pointer", background: isA ? "rgba(79,140,255,0.12)" : isB ? "rgba(124,92,255,0.12)" : isActive ? "rgba(79,140,255,0.1)" : hoveredDoc === doc.id ? "rgba(255,255,255,0.03)" : "transparent", border: isA ? "1px solid rgba(79,140,255,0.3)" : isB ? "1px solid rgba(124,92,255,0.3)" : isActive ? "1px solid rgba(79,140,255,0.2)" : "1px solid transparent", marginBottom: 2, transition: "all 200ms" }}>
                  <svg width="14" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={isA ? "#4F8CFF" : isB ? "#7C5CFF" : isActive ? "#4F8CFF" : "#5C6B7A"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke={isA ? "#4F8CFF" : isB ? "#7C5CFF" : isActive ? "#4F8CFF" : "#5C6B7A"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: highlighted ? "#E6EDF3" : "#9BA7B4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                    <div style={{ fontSize: 10, color: "#5C6B7A", marginTop: 1 }}>{doc.size} · {doc.chunks} passages</div>
                  </div>
                  {/* State badge */}
                  {isA && <span style={{ fontSize: 9, fontWeight: 700, color: "#4F8CFF", background: "rgba(79,140,255,0.2)", padding: "2px 6px", borderRadius: 3, flexShrink: 0 }}>A</span>}
                  {isB && <span style={{ fontSize: 9, fontWeight: 700, color: "#7C5CFF", background: "rgba(124,92,255,0.2)", padding: "2px 6px", borderRadius: 3, flexShrink: 0 }}>B</span>}
                  {isActive && !compareMode && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#4F8CFF", flexShrink: 0, marginTop: 5 }} />}
                </div>
              )
            })
          )}
        </div>

        {queryHistory.length > 0 && (
          <div style={{ padding: "12px 12px 6px", borderTop: "1px solid #1F2933", marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#5C6B7A", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Recent Queries</div>
            {queryHistory.map(q => (
              <div key={q.id} style={{ padding: "6px 8px", borderRadius: 5, marginBottom: 2, fontSize: 11, color: "#5C6B7A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.4 }} title={q.query}>
                <span style={{ color: "#3D5A80", marginRight: 5 }}>›</span>{q.query}
              </div>
            ))}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} style={{ display: "none" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </aside>
  )
}