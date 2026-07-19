"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion"
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
  { n: "01", title: "Hybrid retrieval", desc: "FAISS dense vectors + BM25 keyword, fused with Reciprocal Rank Fusion", metric: "~240ms", start: 0.16, end: 0.36 },
  { n: "02", title: "Semantic chunking", desc: "Heading-aware segmentation with automatic fallback to fixed windows", metric: "adaptive", start: 0.36, end: 0.56 },
  { n: "03", title: "Cross-encoder re-ranking", desc: "An ms-marco cross-encoder re-scores every candidate — the relevance scores you see are its verdicts.", metric: "~110ms", start: 0.56, end: 0.78 },
  { n: "04", title: "Grounded synthesis", desc: "Composed only from top-tier evidence — every claim cited to a page", metric: "page-level", start: 0.74, end: 0.86 },
]

// Threshold-triggered stage detection: each stage's own start doubles as the
// point where we switch into it. A ±0.015 hysteresis band around each
// threshold stops boundary jitter from flip-flopping activeStage back and forth.
// activeStage starts at -1 (the establishing beat, 0-0.16): the heading owns
// that range exclusively, and no stage text/ghost numeral/leader line renders.
const STAGE_THRESHOLDS = STEPS.map((s) => s.start)
const STAGE_HYSTERESIS = 0.015

function computeActiveStage(p: number, current: number) {
  if (current === -1) {
    return p > STAGE_THRESHOLDS[0] + STAGE_HYSTERESIS ? 0 : -1
  }
  let next = current
  while (next < STAGE_THRESHOLDS.length - 1 && p > STAGE_THRESHOLDS[next + 1] + STAGE_HYSTERESIS) next++
  while (next > 0 && p < STAGE_THRESHOLDS[next] - STAGE_HYSTERESIS) next--
  if (next === 0 && p < STAGE_THRESHOLDS[0] - STAGE_HYSTERESIS) return -1
  return next
}

const sectionLabel: React.CSSProperties = { fontFamily: mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: teal, marginBottom: 16 }
const h2: React.CSSProperties = { fontFamily: serif, fontWeight: 400, fontSize: "clamp(28px,4.5vw,46px)", lineHeight: 1.15, letterSpacing: "-0.01em", maxWidth: "18ch", marginBottom: 20 }
const lead: React.CSSProperties = { fontSize: 17, color: muted, maxWidth: "54ch", marginBottom: 0, lineHeight: 1.6 }

// Mood tint per stage — deep teal-green -> cooler blue-teal -> warm amber -> cream.
// Windows mirror the same stageWeight-style crossfade used for the fog lerp in EmbeddingSpace.
const TINT_STAGES: { start: number; end: number; color: string }[] = [
  { start: 0, end: 0.3, color: "#0F6E56" },
  { start: 0.25, end: 0.55, color: "#12708A" },
  { start: 0.5, end: 0.85, color: "#8A5A2E" },
  { start: 0.8, end: 1.0, color: "#D9CBAE" },
]

export default function EmbeddingSection() {
  const reduceMotion = !!useReducedMotion()
  const sectionRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] })

  // Single shared, damped progress value — the camera (inside EmbeddingSpace)
  // and every HTML overlay below both read from this SAME MotionValue so they
  // move in lockstep instead of the camera lagging behind raw scroll input.
  const smoothProgress = useMotionValue(0)

  // Discrete stage index, threshold-triggered off smoothProgress (with
  // hysteresis) rather than continuously scrubbed, so stage text can play a
  // real time-based transition instead of freezing mid-blur on stopped scroll.
  const [activeStage, setActiveStage] = useState(-1)
  useMotionValueEvent(smoothProgress, "change", (latest) => {
    setActiveStage((prev) => computeActiveStage(latest, prev))
  })

  // Leader line: drawn from the title block's right-edge center to the
  // active station's screen-projected position (the same viewport-relative
  // projection EmbeddingSpace uses for the drei Html score chips), both
  // converted into coordinates relative to the sticky layer so the line's
  // start and end share one consistent frame of reference.
  const stickyRef = useRef<HTMLDivElement>(null)
  const titleMeasureRef = useRef<HTMLDivElement>(null)
  const stationRawRef = useRef({ x: 0, y: 0 })
  // A near-camera or off-frustum station is reported as not visible (with
  // its last stable coordinates held) by EmbeddingSpace — fade the line/dot
  // out rather than snapping them to an unstable projection, and restore
  // once the station is reported visible again.
  const leaderVisibility = useMotionValue(1)
  const stationVisibleRef = useRef(true)
  const handleStationProjected = useCallback(
    (x: number, y: number, visible: boolean) => {
      stationRawRef.current.x = x
      stationRawRef.current.y = y
      if (visible !== stationVisibleRef.current) {
        stationVisibleRef.current = visible
        animate(leaderVisibility, visible ? 1 : 0, { duration: 0.2 })
      }
    },
    [leaderVisibility]
  )

  const leaderLeft = useMotionValue(0)
  const leaderTop = useMotionValue(0)
  const leaderWidth = useMotionValue(0)
  const leaderRotate = useMotionValue(0)
  const leaderDotLeft = useMotionValue(0)
  const leaderDotTop = useMotionValue(0)

  // Entrance: draw once, then persist. The line only plays its draw-in the
  // FIRST time a stage goes active (after the stage text's own 0.45s enter
  // transition finishes); on every subsequent stage change it just stays
  // fully drawn and its endpoint sweeps continuously to the new station via
  // the per-frame tracking below — it does not hide/redraw on every switch.
  const leaderDraw = useMotionValue(0)
  const leaderDotOpacity = useMotionValue(0)
  // The dot's own draw-in opacity and the station's visibility gate are
  // independent — multiply them so a near-camera station fades the dot out
  // even mid-entrance, and the draw-in still applies once visibility returns.
  const leaderDotFinalOpacity = useTransform(
    [leaderDotOpacity, leaderVisibility],
    ([drawOpacity, vis]: number[]) => drawOpacity * vis
  )
  // Belt-and-braces: the draw-once effect already keeps the line/dot at 0
  // opacity through stage 01, but gate the rendered opacity on activeStage
  // directly too, so there's no frame where a stale motion-value state could
  // let them show before stage 02.
  const leaderLineGatedOpacity = useTransform(leaderVisibility, (v) => v * (activeStage >= 1 ? 1 : 0))
  const leaderDotGatedOpacity = useTransform(leaderDotFinalOpacity, (v) => v * (activeStage >= 1 ? 1 : 0))
  const hasDrawnRef = useRef(false)
  useEffect(() => {
    // The line skips stage 01 entirely (the ray-burst beat owns that window
    // on its own) and only draws in once activeStage reaches 02.
    if (activeStage < 1) {
      hasDrawnRef.current = false
      leaderDraw.set(0)
      leaderDotOpacity.set(0)
      return
    }
    if (hasDrawnRef.current) return

    if (reduceMotion) {
      hasDrawnRef.current = true
      leaderDraw.set(1)
      leaderDotOpacity.set(1)
      return
    }
    let drawControls: { stop: () => void } | undefined
    let dotControls: { stop: () => void } | undefined
    const timer = setTimeout(() => {
      hasDrawnRef.current = true
      drawControls = animate(leaderDraw, 1, { duration: 0.4, ease: "easeOut" })
      dotControls = animate(leaderDotOpacity, 1, { duration: 0.15, delay: 0.35 })
    }, 450)
    return () => {
      clearTimeout(timer)
      drawControls?.stop()
      dotControls?.stop()
    }
  }, [activeStage, reduceMotion, leaderDraw, leaderDotOpacity])

  useAnimationFrame((_, deltaMs) => {
    const delta = deltaMs / 1000
    const damping = 1 - Math.exp(-9 * delta)
    const target = scrollYProgress.get()
    smoothProgress.set(smoothProgress.get() + (target - smoothProgress.get()) * damping)

    const stickyRect = stickyRef.current?.getBoundingClientRect()
    const titleRect = titleMeasureRef.current?.getBoundingClientRect()
    if (stickyRect && titleRect) {
      const x1 = titleRect.right - stickyRect.left
      const y1 = (titleRect.top + titleRect.bottom) / 2 - stickyRect.top
      const x2 = stationRawRef.current.x - stickyRect.left
      const y2 = stationRawRef.current.y - stickyRect.top
      const dx = x2 - x1
      const dy = y2 - y1
      leaderLeft.set(x1)
      leaderTop.set(y1)
      leaderWidth.set(Math.sqrt(dx * dx + dy * dy))
      leaderRotate.set((Math.atan2(dy, dx) * 180) / Math.PI)
      leaderDotLeft.set(x2)
      leaderDotTop.set(y2)
    }
  })

  // The heading owns progress 0-0.10 exclusively, then fades out (with a
  // slight upward drift) over 0.10-0.16 before any stage text can appear.
  const headingOpacity = useTransform(smoothProgress, [0.10, 0.16], [1, 0])
  const headingY = useTransform(smoothProgress, [0.10, 0.16], [0, -10])
  const headingVisibility = useTransform(headingOpacity, (v) => (v < 0.01 ? "hidden" : "visible"))
  // Payoff quiet-down: the scene dims further (to 0.18, not just 0.25) and the
  // vignette deepens slightly so the cream card reads as the clear focus.
  const sceneDim = useTransform(smoothProgress, [0.88, 1], [1, 0.18])
  // The vignette fades IN with the journey (starting at 0, not already at
  // 0.35) so the section's top region matches the hero exactly at the seam.
  const vignetteAlpha = useTransform(smoothProgress, [0, 0.08, 0.88, 1], [0, 0.35, 0.35, 0.5])
  const vignetteBackground = useMotionTemplate`radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${vignetteAlpha}) 100%)`
  const payoffOpacity = useTransform(smoothProgress, [0.88, 1], [0, 1])
  const payoffVisibility = useTransform(payoffOpacity, (v) => (v < 0.01 ? "hidden" : "visible"))
  const payoffScale = useTransform(smoothProgress, [0.88, 1], [0.94, 1])
  // The entire stage-text layer (title block, ghost numeral, leader line —
  // everything inside the activeStage>=0 block below) fades out just before
  // the payoff card takes over, and reappears if the user scrolls back up.
  const stageLayerOpacity = useTransform(smoothProgress, [0.86, 0.89], [1, 0])
  const stageLayerVisibility = useTransform(stageLayerOpacity, (v) => (v < 0.01 ? "hidden" : "visible"))

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
    <div id="pipeline" ref={sectionRef} style={{ height: "400vh", position: "relative", background: "transparent" }}>
      <div ref={stickyRef} style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden", background: "transparent" }}>
        <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          {TINT_STAGES.map((stage, i) => (
            <TintLayer key={i} stage={stage} progress={smoothProgress} />
          ))}
        </div>

        {/* No opaque background here — the page's fixed Bloom glows behind
            this section must keep showing through the transparent Canvas. */}
        <motion.div style={{ position: "absolute", inset: 0, opacity: sceneDim, background: "transparent" }}>
          <EmbeddingSpace progress={smoothProgress} onStationProjected={handleStationProjected} />
        </motion.div>

        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
            background: vignetteBackground,
          }}
        />

        <motion.div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "120px 32px 0", maxWidth: 640, zIndex: 2, opacity: headingOpacity, y: headingY, visibility: headingVisibility, pointerEvents: "none" }}>
          <div style={sectionLabel}>The pipeline</div>
          <h2 style={h2}>Four steps from question to grounded answer.</h2>
          <p style={lead}>No black box. Each answer is the visible result of retrieval, re-ranking, and synthesis — and the techniques are named, not hidden.</p>
        </motion.div>

        {/* Invisible stand-in matching the stage text block's geometry, measured
            each frame so the leader line can start at its right edge. */}
        <div
          ref={titleMeasureRef}
          aria-hidden
          className="absolute left-4 right-4 bottom-[max(24px,env(safe-area-inset-bottom))] md:right-auto md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:w-[calc(100%-2rem)] lg:left-16 lg:w-[44%]"
          style={{ visibility: "hidden", pointerEvents: "none" }}
        />

        {/* Mobile only: the stage text docks to the bottom of the viewport
            there (see StageText), so it needs a scrim behind it to stay
            readable over the busy 3D scene — sits above the canvas but below
            the text layer's z-index. */}
        {activeStage >= 0 && (
          <motion.div
            className="md:hidden"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: "45%",
              zIndex: 1,
              background: "linear-gradient(transparent, rgba(10,10,15,0.75))",
              opacity: stageLayerOpacity,
              visibility: stageLayerVisibility,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Establishing beat (0-0.16) belongs to the heading alone — no stage
            text, ghost numeral, or leader line until activeStage leaves -1.
            The whole layer also fades out just before the payoff (0.86-0.89)
            and hides so it never overlaps the cream card. */}
        {activeStage >= 0 && (
          <motion.div style={{ opacity: stageLayerOpacity, visibility: stageLayerVisibility }}>
            <motion.div
              style={{
                position: "absolute",
                left: leaderLeft,
                top: leaderTop,
                width: leaderWidth,
                height: 1,
                background: "rgba(45,212,167,0.4)",
                transformOrigin: "0 50%",
                rotate: leaderRotate,
                scaleX: leaderDraw,
                opacity: leaderLineGatedOpacity,
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
            <motion.div
              style={{
                position: "absolute",
                left: leaderDotLeft,
                top: leaderDotTop,
                width: 6,
                height: 6,
                marginLeft: -3,
                marginTop: -3,
                borderRadius: "50%",
                background: teal,
                opacity: leaderDotGatedOpacity,
                zIndex: 2,
                pointerEvents: "none",
              }}
            />

            <StageText activeStage={activeStage} reduceMotion={reduceMotion} />
          </motion.div>
        )}

        <motion.div
          style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", alignItems: "center", justifyContent: "center", opacity: payoffOpacity, visibility: payoffVisibility, pointerEvents: "none", padding: 24 }}
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
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#0F6E56", paddingBottom: 12, marginBottom: 16, borderBottom: "1px solid #E0D9CA" }}>
              Grounded answer · Retrieved passage
            </div>
            <p style={{ fontFamily: serif, fontSize: 16, lineHeight: 1.7, marginBottom: 18, fontStyle: "italic" }}>
              Because each attention head computes a distinct weighted average over the input sequence, the model can attend to short-range dependencies in one head while tracking long-range coreference in another, letting relevance — not position — determine what a token conditions on.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  color: teal,
                  background: "transparent",
                  border: "1px solid rgba(45,212,167,0.4)",
                  padding: "5px 12px",
                  borderRadius: 7,
                }}
              >
                Attention Is All You Need · p. 3 · §2.1
              </span>
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
                relevance 0.91
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#8A8275" }}>Illustrative example of a cited answer</div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}

function TintLayer({ stage, progress }: { stage: { start: number; end: number; color: string }; progress: MotionValue<number> }) {
  const keyframes = [stage.start, stage.start + 0.05, stage.end - 0.05, stage.end]
  const opacity = useTransform(progress, keyframes, [0, 0.12, 0.12, 0])

  return (
    <motion.div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        background: `radial-gradient(circle at 62% 42%, ${stage.color}, transparent 70%)`,
      }}
    />
  )
}

const stageTextVariants = {
  initial: { opacity: 0, y: 14, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.45, ease: "easeOut" } },
  exit: { opacity: 0, y: -12, filter: "blur(6px)", transition: { duration: 0.25 } },
}

const stageTextVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
}

const ghostVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 0.045, transition: { duration: 0.45, ease: "easeOut" } },
  exit: { opacity: 0, transition: { duration: 0.25 } },
}

const ghostVariantsReduced = {
  initial: { opacity: 0 },
  animate: { opacity: 0.045, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
}

function StageText({ activeStage, reduceMotion }: { activeStage: number; reduceMotion: boolean }) {
  const step = STEPS[activeStage]

  return (
    <div
      className="absolute left-4 right-4 bottom-[max(24px,env(safe-area-inset-bottom))] md:right-auto md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:w-[calc(100%-2rem)] lg:left-16 lg:w-[44%]"
      style={{ zIndex: 2, pointerEvents: "none" }}
    >
      <div style={{ position: "relative" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={reduceMotion ? stageTextVariantsReduced : stageTextVariants}
          >
            <motion.div
              aria-hidden
              className="hidden md:block"
              variants={reduceMotion ? ghostVariantsReduced : ghostVariants}
              style={{
                position: "absolute",
                top: "-0.05em",
                left: "-0.06em",
                fontFamily: serif,
                fontSize: "30vh",
                lineHeight: 1,
                color: text,
                zIndex: -1,
                pointerEvents: "none",
                userSelect: "none",
                whiteSpace: "nowrap",
              }}
            >
              {step.n}
            </motion.div>
            <div style={{ fontFamily: mono, fontSize: 13, letterSpacing: "0.14em", textTransform: "uppercase", color: teal, marginBottom: 14 }}>{step.n}</div>
            <h3 style={{ fontFamily: serif, fontWeight: 500, fontSize: "clamp(32px,4.5vw,52px)", lineHeight: 1.08, letterSpacing: "-0.01em", color: text, marginBottom: 16 }}>{step.title}</h3>
            <p style={{ fontSize: 16, color: muted, maxWidth: "40ch", lineHeight: 1.6, marginBottom: 18 }}>{step.desc}</p>
            <span style={{ fontFamily: mono, fontSize: 13, color: teal, background: "rgba(45,212,167,0.08)", border: "1px solid rgba(45,212,167,0.2)", padding: "6px 14px", borderRadius: 7, display: "inline-block" }}>{step.metric}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
