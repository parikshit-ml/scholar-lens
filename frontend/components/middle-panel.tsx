"use client"

import { useState, useEffect, useRef } from "react"
import type { PaperDocument, Source, RagSettings } from "@/app/app/page"

interface MiddlePanelProps {
  activeDoc: PaperDocument | null
  evidenceSources: Source[]
  highlightPage: number | null
  jumpNonce: number
  hoveredSourcePage: number | null   // NEW — from right panel hover
  onPageJump: (page: number) => void
  ragSettings: RagSettings
  onRagSettingsChange: (s: RagSettings) => void
  compareMode: boolean
  compareDocA: PaperDocument | null
  compareDocB: PaperDocument | null
}

export function MiddlePanel({ activeDoc, evidenceSources, highlightPage, jumpNonce, hoveredSourcePage, onPageJump, ragSettings, onRagSettingsChange, compareMode, compareDocA, compareDocB }: MiddlePanelProps) {
  const [showEvidence, setShowEvidence] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const iframeWrapperRef = useRef<HTMLDivElement>(null)
  const iframeRefA = useRef<HTMLIFrameElement>(null)
  const iframeRefB = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!highlightPage || !iframe || !activeDoc?.objectUrl) return

    // PRIMARY: navigate the already-loaded PDF in place — same-origin blob
    // iframes allow this, and Chrome/Edge's built-in viewer jumps to the
    // fragment without reloading the whole document.
    let jumped = false
    try {
      iframe.contentWindow?.location.replace(`${activeDoc.objectUrl}#page=${highlightPage}`)
      jumped = true
    } catch {
      jumped = false
    }

    // FALLBACK: some viewers/origins reject the in-place navigation above —
    // reload with a changing dummy param so the src string is never identical
    // to the last jump (a bare "#page=N" is a no-op on a repeat jump).
    if (!jumped) {
      iframe.src = `${activeDoc.objectUrl}#page=${highlightPage}&jump=${Date.now()}`
    }

    iframeWrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [highlightPage, jumpNonce, activeDoc?.objectUrl])

  // Auto-scroll evidence card into view when hovered from right panel
  const cardRefs = useRef<{ [page: number]: HTMLDivElement | null }>({})
  useEffect(() => {
    if (hoveredSourcePage && cardRefs.current[hoveredSourcePage]) {
      cardRefs.current[hoveredSourcePage]?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [hoveredSourcePage])

  return (
    <main style={{ flex: 1, display: "flex", flexDirection: "column", background: "#EFE8DA", overflow: "hidden", borderLeft: "1px solid #E0D9CA", borderRight: "1px solid #E0D9CA" }}>
      {/* Top bar */}
      <div style={{ height: 44, minHeight: 44, background: "#EFE8DA", borderBottom: "1px solid #E0D9CA", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#8A8275" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke="#8A8275" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {compareMode ? (
            <span style={{ fontSize: 13, color: "#A39C8C", fontWeight: 500 }}>
              {compareDocA && compareDocB ? `${compareDocA.name} vs ${compareDocB.name}` : "Select two documents to compare"}
            </span>
          ) : (
            <>
              <span style={{ fontSize: 13, color: "#6B6457", fontWeight: 500 }}>{activeDoc ? `${activeDoc.name}.pdf` : "No document loaded"}</span>
              {activeDoc && <span style={{ fontSize: 10, color: "#8A8275", background: "#FAF6EC ", padding: "2px 6px", borderRadius: 4, fontFamily: "var(--font-mono)" }}>{activeDoc.chunks} passages</span>}
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {compareMode && compareDocA && compareDocB && (
            <span style={{ fontSize: 10, color: "#A39C8C", background: "rgba(79,140,255,0.1)", border: "1px solid rgba(79,140,255,0.2)", padding: "3px 8px", borderRadius: 4, fontFamily: "var(--font-mono)" }}>⇄ Compare Mode</span>
          )}
          {!compareMode && evidenceSources.length > 0 && (
            <button onClick={() => setShowEvidence(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", background: showEvidence ? "rgba(79,140,255,0.12)" : "transparent", border: `1px solid ${showEvidence ? "rgba(79,140,255,0.3)" : "#E0D9CA"}`, borderRadius: 5, color: showEvidence ? "#0F6E56" : "#8A8275", fontSize: 11, cursor: "pointer", transition: "all 200ms", fontWeight: 500 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Evidence ({evidenceSources.length})
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {compareMode ? (
          <CompareSplitView docA={compareDocA} docB={compareDocB} iframeRefA={iframeRefA} iframeRefB={iframeRefB} />
        ) : !activeDoc ? (
          <EmptyState />
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Doc info card */}
            <div style={{ background: "#EFE8DA", border: "1px solid #E0D9CA", borderRadius: 10, padding: "20px 24px", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#2C2820", marginBottom: 4, letterSpacing: "-0.01em" }}>{activeDoc.name}</div>
                  <div style={{ fontSize: 12, color: "#8A8275" }}>Indexed {activeDoc.uploadedAt.toLocaleDateString()} · {activeDoc.size} · {activeDoc.chunks} passages</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", padding: "4px 10px", borderRadius: 5 }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#15803D" }} />
                  <span style={{ fontSize: 11, color: "#15803D", fontWeight: 500 }}>Indexed</span>
                </div>
              </div>
            </div>

            <RagModeBar settings={ragSettings} onChange={onRagSettingsChange} />

            {/* Evidence cards — react to both click highlight AND hover from right panel */}
            {showEvidence && evidenceSources.length > 0 && (
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#8A8275", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Retrieved Evidence Passages</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {evidenceSources.map((src, i) => {
                    const isClickHighlighted = highlightPage === src.page
                    const isHoverHighlighted = hoveredSourcePage === src.page
                    const isHighlighted = isClickHighlighted || isHoverHighlighted
                    return (
                      <div key={i} ref={el => { cardRefs.current[src.page] = el }}>
                        <EvidenceCard
                          source={src} index={i} onPageJump={onPageJump}
                          isHighlighted={isClickHighlighted}
                          isHovered={isHoverHighlighted}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* PDF iframe */}
            <div ref={iframeWrapperRef} style={{ background: "#EFE8DA", border: "1px solid #E0D9CA", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #E0D9CA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#8A8275", letterSpacing: "0.08em", textTransform: "uppercase" }}>Document</span>
                {(highlightPage || hoveredSourcePage) && (
                  <span style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)", background: "rgba(79,140,255,0.08)", border: "1px solid rgba(79,140,255,0.2)", padding: "2px 8px", borderRadius: 4 }}>
                    {highlightPage ? `↑ Jumped to page ${highlightPage}` : `◎ Hovering page ${hoveredSourcePage}`}
                  </span>
                )}
              </div>
              <iframe ref={iframeRef} src={activeDoc.objectUrl} style={{ width: "100%", height: "700px", border: "none", display: "block", background: "#EFE8DA" }} title={`${activeDoc.name}.pdf`} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function CompareSplitView({ docA, docB, iframeRefA, iframeRefB }: { docA: PaperDocument | null; docB: PaperDocument | null; iframeRefA: React.MutableRefObject<HTMLIFrameElement | null>; iframeRefB: React.MutableRefObject<HTMLIFrameElement | null> }) {
  if (!docA && !docB) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, padding: 40 }}>
        <div style={{ fontSize: 14, color: "#8A8275", fontWeight: 500 }}>Select two documents from the left panel</div>
        <div style={{ fontSize: 12, color: "#A39C8C" }}>Click a document to set as A, then another as B</div>
      </div>
    )
  }
  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #E0D9CA", overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#EFE8DA", borderBottom: "1px solid #E0D9CA", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#A39C8C", background: "rgba(79,140,255,0.15)", padding: "2px 8px", borderRadius: 4 }}>A</span>
          <span style={{ fontSize: 12, color: "#6B6457", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docA?.name ?? "—"}</span>
          {docA && <span style={{ fontSize: 10, color: "#8A8275", fontFamily: "var(--font-mono)", marginLeft: "auto", flexShrink: 0 }}>{docA.chunks} passages</span>}
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          {docA?.objectUrl ? <iframe ref={iframeRefA} src={docA.objectUrl} style={{ width: "100%", height: "100%", border: "none", display: "block" }} title="Document A" /> : <DocPlaceholder label="Select Document A" />}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#EFE8DA", borderBottom: "1px solid #E0D9CA", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#11856A", background: "rgba(124,92,255,0.15)", padding: "2px 8px", borderRadius: 4 }}>B</span>
          <span style={{ fontSize: 12, color: "#6B6457", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{docB?.name ?? "—"}</span>
          {docB && <span style={{ fontSize: 10, color: "#8A8275", fontFamily: "var(--font-mono)", marginLeft: "auto", flexShrink: 0 }}>{docB.chunks} passages</span>}
        </div>
        <div style={{ flex: 1, overflow: "hidden" }}>
          {docB?.objectUrl ? <iframe ref={iframeRefB} src={docB.objectUrl} style={{ width: "100%", height: "100%", border: "none", display: "block" }} title="Document B" /> : <DocPlaceholder label="Select Document B" />}
        </div>
      </div>
    </div>
  )
}

function DocPlaceholder({ label }: { label: string }) {
  return (
    <div style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#EFE8DA" }}>
      <span style={{ fontSize: 12, color: "#A39C8C" }}>{label}</span>
    </div>
  )
}

function RagModeBar({ settings, onChange }: { settings: RagSettings; onChange: (s: RagSettings) => void }) {
  const styles: Array<"concise" | "detailed" | "bullet"> = ["concise", "detailed", "bullet"]
  const styleLabels = { concise: "Concise", detailed: "Detailed", bullet: "Bullets" }
  return (
    <div style={{ background: "#EFE8DA", border: "1px solid #E0D9CA", borderRadius: 10, padding: "16px 20px", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="#0F6E56" strokeWidth="2"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#6B6457", letterSpacing: "0.06em", textTransform: "uppercase" }}>RAG Mode Controls</span>
        <span style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)", marginLeft: "auto" }}>affects next query</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6B6457", fontWeight: 500 }}>Retrieval Depth</span>
              <InfoTip text={`Search Breadth: ${settings.k <= 3 ? "Narrow" : settings.k <= 6 ? "Medium" : "Broad"} — Higher values increase recall but may introduce noise. Lower values are more precise.`} />
            </div>
          <span style={{ fontSize: 30, fontWeight: 500, color: "#A39C8C", fontFamily: "var(--font-mono)", lineHeight: 1, letterSpacing: "-0.02em" }}>{settings.k}</span>          </div>
          <input type="range" min={1} max={10} step={1} value={settings.k} onChange={e => onChange({ ...settings, k: parseInt(e.target.value) })} style={{ width: "100%", accentColor: "#A39C8C", cursor: "pointer", height: 4 }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)" }}>1 — precise</span>
            <span style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)" }}>10 — broad</span>
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6B6457", fontWeight: 500 }}>Creativity</span>
              <InfoTip text="Lower values stay close to source text. Higher values allow more interpretation and synthesis." />
            </div><span style={{ fontSize: 30, fontWeight: 500, color: "#A39C8C", fontFamily: "var(--font-mono)", lineHeight: 1, letterSpacing: "-0.02em" }}>{settings.temperature.toFixed(1)}</span>
            
          </div>
          <input type="range" min={0} max={1} step={0.1} value={settings.temperature} onChange={e => onChange({ ...settings, temperature: parseFloat(e.target.value) })} style={{ width: "100%", accentColor: "#11856A", cursor: "pointer", height: 4 }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
            <span style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)" }}>0.0 — strict</span>
            <span style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)" }}>1.0 — creative</span>
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#6B6457", fontWeight: 500 }}>Answer Style</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {styles.map(s => (
              <button key={s} onClick={() => onChange({ ...settings, answerStyle: s })}
                style={{ flex: 1, padding: "6px 0", background: settings.answerStyle === s ? "rgba(79,140,255,0.15)" : "#FAF6EC ", border: `1px solid ${settings.answerStyle === s ? "rgba(79,140,255,0.4)" : "#E0D9CA"}`, borderRadius: 6, fontSize: 11, fontWeight: settings.answerStyle === s ? 600 : 400, color: settings.answerStyle === s ? "#0F6E56" : "#8A8275", cursor: "pointer", transition: "all 200ms", fontFamily: "inherit" }}>
                {styleLabels[s]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ background: "#FAF6EC ", border: "1px solid #E0D9CA", borderRadius: 6, padding: "8px 12px" }}>
          <span style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)" }}>
            Top <span style={{ color: "#A39C8C" }}>{settings.k}</span> passages · <span style={{ color: "#11856A" }}>{settings.answerStyle}</span> · temp <span style={{ color: "#15803D" }}>{settings.temperature.toFixed(1)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
      <div style={{ width: 64, height: 64, background: "#FAF6EC ", border: "1px solid #E0D9CA", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><polyline points="14 2 14 8 20 8" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><line x1="16" y1="13" x2="8" y2="13" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round"/><line x1="16" y1="17" x2="8" y2="17" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round"/></svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "#8A8275", marginBottom: 6 }}>Document viewer</div>
        <div style={{ fontSize: 12, color: "#A39C8C", lineHeight: 1.6, maxWidth: 260 }}>Upload a PDF from the left panel to begin analysis.</div>
      </div>
    </div>
  )
}

// EvidenceCard now reacts to both click highlight AND hover from right panel
function EvidenceCard({ source, index, onPageJump, isHighlighted, isHovered }: { source: Source; index: number; onPageJump: (p: number) => void; isHighlighted: boolean; isHovered: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const colors = ["#0F6E56", "#11856A", "#15803D"]
  const color = colors[index % colors.length]
  const score = source.relevance ?? 0.9

  // isHovered = hovering citation in right panel → amber pulse glow
  // isHighlighted = clicked page jump → blue glow
  const glowColor = isHighlighted ? "rgba(79,140,255,0.4)" : isHovered ? "rgba(245,158,11,0.5)" : color + "22"
  const bgColor = isHighlighted ? "rgba(79,140,255,0.08)" : isHovered ? "rgba(245,158,11,0.06)" : "#FAF6EC "
  const borderLeftColor = isHovered ? "#B45309" : color

  return (
    <div
      style={{
        background: bgColor,
        borderTop: `1px solid ${glowColor}`,
        borderRight: `1px solid ${glowColor}`,
        borderBottom: `1px solid ${glowColor}`,
        borderLeft: `3px solid ${borderLeftColor}`,
        borderRadius: "0 8px 8px 0",
        padding: "12px 14px",
        cursor: "pointer",
        transition: "all 200ms",
        boxShadow: isHovered ? `0 0 12px rgba(245,158,11,0.15)` : isHighlighted ? `0 0 12px rgba(79,140,255,0.15)` : "none",
      }}
      onClick={() => { setExpanded(v => !v); onPageJump(source.page) }}
      onMouseEnter={e => !isHighlighted && !isHovered && ((e.currentTarget as HTMLElement).style.background = "#EFE8DA")}
      onMouseLeave={e => !isHighlighted && !isHovered && ((e.currentTarget as HTMLElement).style.background = "#FAF6EC ")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: expanded ? 8 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#8A8275", fontFamily: "var(--font-mono)" }}>Page {source.page}</span>
          {isHovered && (
            <span style={{ fontSize: 10, color: "#B45309", fontFamily: "var(--font-mono)", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", padding: "1px 5px", borderRadius: 3 }}>
              ◎ referenced
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 40, height: 3, background: "#E0D9CA", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${score * 100}%`, background: isHovered ? "#B45309" : color, borderRadius: 2 }} />
            </div>
          <span style={{ fontSize: 10, color, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{score > 0 ? `${Math.round(score * 100)}%` : "—"}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#A39C8C", fontFamily: "var(--font-mono)" }}>↑ jump</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 200ms" }}><path d="M6 9l6 6 6-6" stroke="#8A8275" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      {expanded && <p style={{ fontSize: 11, color: "#6B6457", lineHeight: 1.6, margin: 0, fontFamily: "var(--font-mono)" }}>{source.snippet || "No preview available."}</p>}
      {!expanded && <p style={{ fontSize: 11, color: "#8A8275", lineHeight: 1.5, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{source.snippet || "Click to expand…"}</p>}
    </div>
  )
}

function InfoTip({ text }: { text: string }) {
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <span className="infotip-trigger" style={{ width: 14, height: 14, borderRadius: "50%", background: "#E0D9CA", border: "1px solid #D6CDBB", color: "#8A8275", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "help", fontWeight: 700, flexShrink: 0 }}>i</span>
      <div className="infotip-box" style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", background: "#FAF6EC ", border: "1px solid #D6CDBB", borderRadius: 6, padding: "7px 10px", fontSize: 11, color: "#6B6457", lineHeight: 1.5, width: 220, zIndex: 100, pointerEvents: "none", opacity: 0, transition: "opacity 150ms" }}>
        {text}
        <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #D6CDBB" }} />
      </div>
      <style>{`div:has(.infotip-trigger:hover) .infotip-box { opacity: 1 !important; }`}</style>
    </div>
  )
}