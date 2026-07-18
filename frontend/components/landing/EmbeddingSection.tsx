"use client"

import { useRef } from "react"
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion"
import EmbeddingSpace from "./EmbeddingSpace"

const ink2 = "#101018"
const teal = "#2DD4A7"
const text = "#ECE8DF"
const muted = "#8A8678"
const line = "rgba(255,255,255,0.08)"
const serif = "var(--font-serif)"
const mono = "var(--font-mono)"

type Step = { n: string; title: string; desc: string; metric: string; start: number; end: number }

const STEPS: Step[] = [
  { n: "01", title: "Hybrid retrieval", desc: "FAISS dense vectors + BM25 keyword, fused with Reciprocal Rank Fusion", metric: "~240ms", start: 0.05, end: 0.3 },
  { n: "02", title: "Semantic chunking", desc: "Heading-aware segmentation with automatic fallback to fixed windows", metric: "adaptive", start: 0.3, end: 0.5 },
  { n: "03", title: "Cross-encoder re-ranking", desc: "An ms-marco cross-encoder re-scores every candidate passage", metric: "~110ms", start: 0.5, end: 0.75 },
  { n: "04", title: "Grounded synthesis", desc: "Composed only from top-tier evidence — every claim cited to a page", metric: "page-level", start: 0.75, end: 1.0 },
]

const sectionLabel: React.CSSProperties = { fontFamily: mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: teal, marginBottom: 16 }
const h2: React.CSSProperties = { fontFamily: serif, fontWeight: 400, fontSize: "clamp(28px,4.5vw,46px)", lineHeight: 1.15, letterSpacing: "-0.01em", maxWidth: "18ch", marginBottom: 20 }
const lead: React.CSSProperties = { fontSize: 17, color: muted, maxWidth: "54ch", marginBottom: 0, lineHeight: 1.6 }

export default function EmbeddingSection() {
  const reduceMotion = useReducedMotion()
  const sectionRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] })

  const headingOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0])
  const sceneDim = useTransform(scrollYProgress, [0.88, 1], [1, 0.25])
  const payoffOpacity = useTransform(scrollYProgress, [0.88, 1], [0, 1])
  const payoffScale = useTransform(scrollYProgress, [0.88, 1], [0.92, 1])

  if (reduceMotion) {
    return (
      <section id="pipeline" style={{ padding: "120px 32px", minHeight: "85vh", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 1080, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={sectionLabel}>The pipeline</div>
        <h2 style={h2}>Four steps from question to grounded answer.</h2>
        <p style={{ ...lead, marginBottom: 48 }}>No black box. Each answer is the visible result of retrieval, re-ranking, and synthesis — and the techniques are named, not hidden.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {STEPS.map((step) => (
            <div key={step.n} style={{ display: "flex", alignItems: "center", gap: 20, padding: "22px 26px", background: ink2, border: "1px solid " + line, borderRadius: 14 }}>
              <span style={{ fontFamily: mono, fontSize: 13, color: teal, minWidth: 28 }}>{step.n}</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 19, marginBottom: 4 }}>{step.title}</h3>
                <span style={{ fontSize: 14, color: muted }}>{step.desc}</span>
              </div>
              <span style={{ fontFamily: mono, fontSize: 13, color: teal, background: "rgba(45,212,167,0.08)", border: "1px solid rgba(45,212,167,0.2)", padding: "5px 12px", borderRadius: 7, whiteSpace: "nowrap" }}>{step.metric}</span>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div id="pipeline" ref={sectionRef} style={{ height: "400vh", position: "relative" }}>
      <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
        <motion.div style={{ position: "absolute", inset: 0, opacity: sceneDim }}>
          <EmbeddingSpace progress={scrollYProgress} />
        </motion.div>

        <motion.div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "120px 32px 0", maxWidth: 640, zIndex: 2, opacity: headingOpacity, pointerEvents: "none" }}>
          <div style={sectionLabel}>The pipeline</div>
          <h2 style={h2}>Four steps from question to grounded answer.</h2>
          <p style={lead}>No black box. Each answer is the visible result of retrieval, re-ranking, and synthesis — and the techniques are named, not hidden.</p>
        </motion.div>

        {STEPS.map((step) => (
          <Waypoint key={step.n} step={step} scrollYProgress={scrollYProgress} />
        ))}

        <motion.div
          style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", alignItems: "center", justifyContent: "center", opacity: payoffOpacity, pointerEvents: "none", padding: 24 }}
        >
          <motion.div
            style={{
              scale: payoffScale,
              background: "#F6F1E7",
              border: "1px solid #E0D9CA",
              borderRadius: 14,
              maxWidth: 560,
              padding: 28,
              color: "#2C2820",
            }}
          >
            <p style={{ fontFamily: serif, fontSize: 15, lineHeight: 1.7, marginBottom: 18, fontStyle: "italic" }}>
              &ldquo;…the fused ranking assigns each candidate passage a reciprocal-rank score, favoring evidence retrieved consistently across both the dense and sparse pipelines…&rdquo;
            </p>
            <span
              style={{
                fontFamily: mono,
                fontSize: 12,
                color: teal,
                background: "rgba(45,212,167,0.1)",
                border: "1px solid rgba(45,212,167,0.3)",
                padding: "5px 12px",
                borderRadius: 7,
              }}
            >
              p. 3 · §2.1 · score 0.91
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

function Waypoint({ step, scrollYProgress }: { step: Step; scrollYProgress: MotionValue<number> }) {
  const keyframes = [step.start, step.start + 0.05, step.end - 0.05, step.end]
  const opacity = useTransform(scrollYProgress, keyframes, [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, keyframes, [20, 0, 0, -20])

  return (
    <div
      className="absolute inset-x-4 bottom-6 lg:inset-x-auto lg:bottom-auto lg:right-10 lg:top-1/2 lg:-translate-y-1/2 lg:w-[400px]"
      style={{ zIndex: 2, pointerEvents: "none" }}
    >
      <motion.div
        style={{
          opacity,
          y,
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: "22px 26px",
          background: ink2,
          border: "1px solid " + line,
          borderRadius: 14,
        }}
      >
        <span style={{ fontFamily: mono, fontSize: 13, color: teal, minWidth: 28 }}>{step.n}</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 19, marginBottom: 4, color: text }}>{step.title}</h3>
          <span style={{ fontSize: 14, color: muted }}>{step.desc}</span>
        </div>
        <span style={{ fontFamily: mono, fontSize: 13, color: teal, background: "rgba(45,212,167,0.08)", border: "1px solid rgba(45,212,167,0.2)", padding: "5px 12px", borderRadius: 7, whiteSpace: "nowrap" }}>{step.metric}</span>
      </motion.div>
    </div>
  )
}
