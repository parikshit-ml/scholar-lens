"use client"

import { useRef, useEffect, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { motion, useScroll, useTransform, useInView, animate, useReducedMotion } from "framer-motion"

const EmbeddingSection = dynamic(() => import("@/components/landing/EmbeddingSection"), {
  ssr: false,
  loading: () => <div style={{ height: "70vh", background: "#101018", borderRadius: 14 }} />,
})

const ink = "#0A0A0F"
const ink2 = "#101018"
const teal = "#2DD4A7"
const text = "#ECE8DF"
const muted = "#8A8678"
const line = "rgba(255,255,255,0.08)"
const serif = "var(--font-serif)"
const sans = "var(--font-sans)"
const mono = "var(--font-mono)"

function useCountUp(target: number, decimals = 0) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const reduceMotion = !!useReducedMotion()
  useEffect(() => {
    if (!inView) return
    if (reduceMotion) { setVal(target); return }
    const controls = animate(0, target, { duration: 1.4, ease: [0.2, 0.7, 0.2, 1], onUpdate: v => setVal(v) })
    return () => controls.stop()
  }, [inView, target, reduceMotion])
  return { ref, display: decimals ? val.toFixed(decimals) : Math.round(val).toString(), inView, reduceMotion }
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: 0.9, delay, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  )
}

export default function Landing() {
  const { scrollYProgress } = useScroll()
  const finaleRef = useRef<HTMLElement>(null)
  const { scrollYProgress: finaleProgress } = useScroll({ target: finaleRef, offset: ["start end", "end end"] })
  const warmOpacity = useTransform(finaleProgress, [0, 1], [0, 0.07])
  const peekY = useTransform(finaleProgress, [0.3, 1], [60, 0])
  const peekOpacity = useTransform(finaleProgress, [0.3, 1], [0, 1])

  return (
    <div style={{ background: ink, color: text, fontFamily: sans, overflowX: "clip", position: "relative" }}>
      <motion.div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, background: teal, transformOrigin: "0%", scaleX: scrollYProgress, zIndex: 100 }} />
       <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>        <Bloom size={540} color="#1D9E75" top={-160} left={-100} delay={0} op={0.18} />
        <Bloom size={420} color="#0F6E56" bottom={-140} right={-80} delay={-7} op={0.16} />
        <Bloom size={360} color="#2DD4A7" top="40%" left="55%" delay={-13} op={0.1} />
      </div>

      <Nav />

      <header style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "80px 32px 0", position: "relative", zIndex: 1 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: teal, marginBottom: 28 }}>
          Hybrid RAG · Citation-grounded
        </motion.div>
        <h1 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(40px,7vw,82px)", lineHeight: 1.05, letterSpacing: "-0.02em", maxWidth: "15ch", marginBottom: 28 }}>
          {["Answers", "you", "can", "trace"].map((w, i) => <Word key={i} delay={0.3 + i * 0.1}>{w}</Word>)}
          {["to", "the", "page."].map((w, i) => <Word key={i + 10} delay={0.7 + i * 0.1} accent>{w}</Word>)}
        </h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1 }} style={{ fontSize: 18, color: muted, maxWidth: "54ch", marginBottom: 40, lineHeight: 1.6 }}>
          ScholarLens reads dense research the way a scholar does — retrieving, re-ranking, and weighing evidence, with every claim traced back to its exact source.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1.15 }} style={{ display: "flex", gap: 14 }}>
          <Link href="/app" style={btnPrimary}>Open ScholarLens</Link>
          <a href="#pipeline" style={btnGhost}>See how it works</a>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} style={{ position: "absolute", bottom: 36, fontFamily: mono, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: muted }}>
          Scroll
          <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} style={{ width: 1, height: 34, background: "linear-gradient(" + teal + ", transparent)", margin: "12px auto 0" }} />
        </motion.div>
      </header>

      <EmbeddingSection />

      <Section id="eval">
        <Reveal><div style={sectionLabel}>The proof</div></Reveal>
        <Reveal delay={0.08}><h2 style={{ ...h2, maxWidth: "20ch" }}>Most RAG demos ask for your trust. <span style={{ fontStyle: "italic", color: teal }}>ScholarLens measures itself.</span></h2></Reveal>
        <Reveal delay={0.16}><p style={lead}>A built-in evaluation framework scores every answer against a benchmark dataset — retrieval accuracy, answer similarity, and a second model verifying the answer is faithful to its sources.</p></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginTop: 16 }}>
          <EvalCard label="Retrieval accuracy" value={93.3} decimals={1} suffix="%" sub="correct page retrieved" variant="ring" delay={0} />
          <EvalCard label="Grounding rate" value={81.7} decimals={1} suffix="%" sub="49 of 60 answers verified against source passages" variant="ticks" highlight delay={0.12} />
          <EvalCard label="Answer similarity" value={0.74} decimals={2} sub="cosine vs. expected answers" variant="similarity" delay={0.24} />
        </div>
         <Reveal delay={0.2}><p style={{ fontFamily: mono, fontSize: 12, color: muted, marginTop: 20 }}>Measured across 60 questions on 5 ML papers · automated LLM-assisted evaluation</p></Reveal>
      </Section>

      <Section id="details">
        <Reveal><div style={sectionLabel}>The details</div></Reveal>
        <Reveal delay={0.08}><h2 style={h2}>The small things you can&apos;t fake.</h2></Reveal>
        <Reveal delay={0.16}><p style={lead}>Confidence is computed from real embedding distance — measured, not guessed. Latency is surfaced per query. Every passage shows its relevance.</p></Reveal>
        <Reveal delay={0.18}><p style={{ fontFamily: mono, fontSize: 12, color: muted, marginBottom: 24 }}>Figures below are illustrative examples of the live interface</p></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginTop: 8 }}>
          <ConfidenceCard />
          <LatencyCard />
          <BarsCard />
        </div>
      </Section>

      <Section id="more">
        <Reveal><div style={sectionLabel}>Beyond Q&amp;A</div></Reveal>
        <Reveal delay={0.08}><h2 style={h2}>A system, not a demo.</h2></Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 24 }}>
          {[
            ["Multi-document comparison", "Ask one question across two papers, answered side by side"],
            ["Paper decomposition", "Four parallel queries split a paper into contributions, methods, limitations, assumptions"],
            ["Dynamic query suggestions", "When confidence is low, it proposes better-targeted questions"],
            ["Query caching", "Repeated questions return instantly from a TTL cache"],
          ].map(([t, d], i) => (
            <Reveal key={i} delay={i * 0.06}>
              <div style={{ background: ink2, border: "1px solid " + line, borderRadius: 14, padding: "22px 24px", height: "100%" }}>
                <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 18, marginBottom: 6 }}>{t}</h3>
                <p style={{ fontSize: 14, color: muted, lineHeight: 1.6 }}>{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <section ref={finaleRef} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", position: "relative", padding: "0 32px", zIndex: 1 }}>
        <motion.div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 60%, rgba(246,241,231,1), transparent 60%)", opacity: warmOpacity, pointerEvents: "none", willChange: "opacity" }} />        <Reveal><h2 style={{ fontFamily: serif, fontWeight: 400, fontSize: "clamp(32px,5vw,56px)", lineHeight: 1.1, letterSpacing: "-0.02em", maxWidth: "16ch", marginBottom: 24 }}>Stop skimming. <span style={{ fontStyle: "italic", color: teal }}>Start understanding.</span></h2></Reveal>
        <Reveal delay={0.1}><p style={{ fontSize: 17, color: muted, maxWidth: "48ch", marginBottom: 40 }}>Open ScholarLens and ask your first question. The cream reading room is waiting.</p></Reveal>
        <Reveal delay={0.2}><Link href="/app" style={{ ...btnPrimary, fontSize: 17, padding: "18px 40px" }}>Open ScholarLens →</Link></Reveal>
        <motion.div style={{ y: peekY, opacity: peekOpacity, marginTop: 64, width: "100%", maxWidth: 760, height: 120, borderRadius: "18px 18px 0 0", background: "linear-gradient(#F6F1E7,#EFE8DA)", border: "1px solid #E0D9CA", borderBottom: "none", position: "relative", overflow: "hidden" }}>
          <span style={{ position: "absolute", top: 20, left: 24, fontFamily: serif, fontSize: 16, color: "#2C2820" }}>ScholarLens</span>
          <span style={{ position: "absolute", top: 54, left: 24, fontSize: 13, color: "#8A8275" }}>Ask anything about this paper…</span>
        </motion.div>
      </section>

      <footer style={{ padding: "40px 0", borderTop: "1px solid " + line, textAlign: "center", fontFamily: mono, fontSize: 12, color: muted, position: "relative", zIndex: 1 }}>
        ScholarLens · Hybrid RAG · FastAPI + Next.js
      </footer>
    </div>
  )
}

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])
  return (
    <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", backdropFilter: "blur(8px)", background: "rgba(10,10,15,0.4)", borderBottom: "1px solid " + (scrolled ? line : "transparent"), transition: "border-color .4s" }}>
      <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 500, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: teal, boxShadow: "0 0 12px " + teal }} />
        ScholarLens
      </div>
      <Link href="/app" style={{ fontSize: 13, color: text, border: "1px solid " + line, padding: "8px 16px", borderRadius: 8, textDecoration: "none" }}>Open app →</Link>
    </nav>
  )
}

function Word({ children, delay, accent }: { children: React.ReactNode; delay: number; accent?: boolean }) {
  return (
    <motion.span initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay, ease: [0.2, 0.7, 0.2, 1] }} style={{ display: "inline-block", marginRight: "0.25em", fontStyle: accent ? "italic" : "normal", color: accent ? teal : "inherit" }}>
      {children}
    </motion.span>
  )
}

function Bloom({ size, color, top, left, right, bottom, delay, op }: any) {
  return (
    <motion.span animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.12, 1] }} transition={{ duration: 22, repeat: Infinity, delay, ease: "easeInOut" }} style={{ position: "absolute", width: size, height: size, borderRadius: "50%", filter: "blur(60px)", background: color, opacity: op, top, left, right, bottom, willChange: "transform", transform: "translateZ(0)" }} />
  )
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ padding: "120px 32px", minHeight: "85vh", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 1080, margin: "0 auto", position: "relative", zIndex: 1 }}>
      {children}
    </section>
  )
}

function PipeStep({ n, title, desc, metric, delay }: { n: string; title: string; desc: string; metric: string; delay: number }) {
  return (
    <Reveal delay={delay}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "22px 26px", background: ink2, border: "1px solid " + line, borderRadius: 14 }}>
        <span style={{ fontFamily: mono, fontSize: 13, color: teal, minWidth: 28 }}>{n}</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: 19, marginBottom: 4 }}>{title}</h3>
          <span style={{ fontSize: 14, color: muted }}>{desc}</span>
        </div>
        <span style={{ fontFamily: mono, fontSize: 13, color: teal, background: "rgba(45,212,167,0.08)", border: "1px solid rgba(45,212,167,0.2)", padding: "5px 12px", borderRadius: 7, whiteSpace: "nowrap" }}>{metric}</span>
      </div>
    </Reveal>
  )
}

function EvalCard({ label, value, suffix = "", decimals = 0, sub, highlight, variant, delay = 0 }: { label: string; value: number; suffix?: string; decimals?: number; sub: string; highlight?: boolean; variant?: "ring" | "ticks" | "similarity"; delay?: number }) {
  const { ref, display, inView, reduceMotion } = useCountUp(value, decimals)
  return (
    <Reveal delay={delay}>
      <div ref={ref} style={{ background: ink2, border: "1px solid " + (highlight ? "rgba(45,212,167,0.35)" : line), borderRadius: 16, padding: "28px 26px" }}>
        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: muted, marginBottom: 16 }}>{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {variant === "ring" && <AccuracyRing inView={inView} reduceMotion={reduceMotion} />}
          <div style={{ fontFamily: mono, fontSize: 46, fontWeight: 500, color: highlight ? teal : text, letterSpacing: "-0.02em", lineHeight: 1 }}>{display}{suffix}</div>
        </div>
        {variant === "ticks" && <GroundingTicks inView={inView} reduceMotion={reduceMotion} />}
        {variant === "similarity" && <SimilarityTrack inView={inView} reduceMotion={reduceMotion} />}
        <div style={{ fontSize: variant === "ticks" ? 12 : 13, color: muted, marginTop: 10 }}>{sub}</div>
      </div>
    </Reveal>
  )
}

function AccuracyRing({ inView, reduceMotion }: { inView: boolean; reduceMotion: boolean }) {
  const size = 72
  const strokeWidth = 6
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  const targetOffset = c * 0.067
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} fill="none" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={teal}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={c}
        strokeLinecap="round"
        initial={{ strokeDashoffset: reduceMotion ? targetOffset : c }}
        animate={inView ? { strokeDashoffset: targetOffset } : {}}
        transition={{ duration: reduceMotion ? 0 : 1.4, ease: [0.2, 0.7, 0.2, 1] }}
      />
    </svg>
  )
}

function GroundingTicks({ inView, reduceMotion }: { inView: boolean; reduceMotion: boolean }) {
  const total = 60
  const filled = 49
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 16 }}>
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ background: i < filled && reduceMotion ? teal : "rgba(255,255,255,0.07)" }}
          animate={inView && i < filled ? { background: teal } : {}}
          transition={{ duration: reduceMotion ? 0 : 0.3, delay: reduceMotion ? 0 : i * 0.016 }}
          style={{ flex: 1, height: 14, borderRadius: 2 }}
        />
      ))}
    </div>
  )
}

function SimilarityTrack({ inView, reduceMotion }: { inView: boolean; reduceMotion: boolean }) {
  const pct = 74
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ position: "relative", height: 6, background: "rgba(255,255,255,0.07)", borderRadius: 3 }}>
        <motion.div
          initial={{ width: reduceMotion ? pct + "%" : 0 }}
          animate={inView ? { width: pct + "%" } : {}}
          transition={{ duration: reduceMotion ? 0 : 1.2, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ height: "100%", background: teal, borderRadius: 3 }}
        />
        <motion.div
          initial={{ left: reduceMotion ? pct + "%" : "0%" }}
          animate={inView ? { left: pct + "%" } : {}}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 14 }}
          style={{ position: "absolute", top: "50%", width: 14, height: 14, marginTop: -7, marginLeft: -7, borderRadius: "50%", background: teal, boxShadow: "0 0 8px " + teal }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span style={{ fontFamily: mono, fontSize: 11, color: muted }}>0 · unrelated</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: muted }}>0.5 · paraphrase</span>
        <span style={{ fontFamily: mono, fontSize: 11, color: muted }}>1.0 · verbatim</span>
      </div>
    </div>
  )
}

function ConfidenceCard() {
  const { ref, display } = useCountUp(86)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  return (
    <Reveal>
      <div ref={ref} style={{ background: ink2, border: "1px solid " + line, borderRadius: 14, padding: 24 }}>
        <div style={detailLabel}>Retrieval confidence</div>
        <div style={{ fontFamily: mono, fontSize: 34, fontWeight: 500, color: teal, lineHeight: 1 }}>{display}%</div>
        <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden", margin: "14px 0 10px" }}>
          <motion.div initial={{ width: 0 }} animate={inView ? { width: "86%" } : {}} transition={{ duration: 1.2, ease: [0.2, 0.7, 0.2, 1] }} style={{ height: "100%", background: teal, borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 13, color: muted }}>measured from embedding distance, not guessed</div>
      </div>
    </Reveal>
  )
}

function LatencyCard() {
  const { ref, display } = useCountUp(350)
  return (
    <Reveal delay={0.08}>
      <div ref={ref} style={{ background: ink2, border: "1px solid " + line, borderRadius: 14, padding: 24 }}>
        <div style={detailLabel}>Latency, surfaced</div>
        <div style={{ fontFamily: mono, fontSize: 34, fontWeight: 500, color: text, lineHeight: 1 }}>{display}ms</div>
        <div style={{ fontSize: 13, color: muted, marginTop: 14 }}>retrieval + re-ranking, shown per query</div>
      </div>
    </Reveal>
  )
}

function BarsCard() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  const bars: Array<readonly [string, number]> = [["Page 3", 100], ["Page 2", 60], ["Page 4", 22]]
  return (
    <Reveal delay={0.16}>
      <div ref={ref} style={{ background: ink2, border: "1px solid " + line, borderRadius: 14, padding: 24 }}>
        <div style={detailLabel}>Evidence by relevance</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          {bars.map(([pg, w]) => (
            <div key={pg} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: mono, fontSize: 12, color: muted, minWidth: 50 }}>{pg}</span>
              <span style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                <motion.span initial={{ width: 0 }} animate={inView ? { width: w + "%" } : {}} transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }} style={{ display: "block", height: "100%", background: teal, borderRadius: 3 }} />
              </span>
              <span style={{ fontFamily: mono, fontSize: 12, color: teal, minWidth: 38, textAlign: "right" }}>{w}%</span>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  )
}

const btnPrimary: React.CSSProperties = { background: teal, color: ink, fontWeight: 500, fontSize: 15, padding: "14px 28px", borderRadius: 10, textDecoration: "none", cursor: "pointer" }
const btnGhost: React.CSSProperties = { color: text, fontSize: 15, padding: "14px 24px", borderRadius: 10, border: "1px solid " + line, textDecoration: "none" }
const sectionLabel: React.CSSProperties = { fontFamily: mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: teal, marginBottom: 16 }
const h2: React.CSSProperties = { fontFamily: serif, fontWeight: 400, fontSize: "clamp(28px,4.5vw,46px)", lineHeight: 1.15, letterSpacing: "-0.01em", maxWidth: "18ch", marginBottom: 20 }
const lead: React.CSSProperties = { fontSize: 17, color: muted, maxWidth: "54ch", marginBottom: 48, lineHeight: 1.6 }
const detailLabel: React.CSSProperties = { fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: muted, marginBottom: 14 }
