"use client"

import { useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html } from "@react-three/drei"
import * as THREE from "three"
import type { MotionValue } from "framer-motion"

const CLUSTER_COUNT = 5
const POINT_COUNT = 2500
const CLUSTER_CENTER_RADIUS = 5
const CLUSTER_SPREAD = 1.8
const CORE_PER_CLUSTER = 80 // brighter, denser points at each cluster's center
const CORE_SPREAD = 0.6
const TEAL_STRIDE = 10 // ~10% of the base cloud, sampled for teal highlights
const CREAM_STRIDE = 34 // ~3% of the base cloud, sampled for cream foreground stars

const GALAXY_VERTEX_SHADER = `
  attribute float aSize;
  attribute float aPhase;
  attribute float aBrightness;
  uniform float uTime;
  uniform float uBaseSize;
  varying float vTwinkle;
  varying float vBrightness;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vTwinkle = 1.0 + 0.15 * sin(uTime * 0.6 + aPhase);
    vBrightness = aBrightness;
    gl_PointSize = uBaseSize * aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const GALAXY_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uBaseAlpha;
  varying float vTwinkle;
  varying float vBrightness;
  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.0, d);
    alpha *= alpha;
    alpha *= uBaseAlpha * vTwinkle;
    gl_FragColor = vec4(uColor * vBrightness, alpha);
  }
`

function randSize(rand: () => number) {
  return 0.5 + rand() * 1.3 // 0.5x - 1.8x
}

const MUTED = new THREE.Color("#8A8678")
const TEAL = new THREE.Color("#2DD4A7")
const AMBER = new THREE.Color("#EF9F27")
const WHITE = new THREE.Color("#FFFFFF")

const QUERY_POINT = new THREE.Vector3(4.2, 1.0, 0)
const SCORES = [0.91, 0.87, 0.84]

const WORLD_UP = new THREE.Vector3(0, 1, 0)
// Frame the active station at the right-third of the viewport, slightly
// above center, by aiming lookAt this far left/below it (as a fraction of
// the frustum's half-width/half-height at the station's distance).
const FRAME_OFFSET_X = 0.32
const FRAME_OFFSET_Y = 0.14

// Authored S-curve: start high and wide, bank left around cluster 1, dip
// through the gap between clusters 2-3, rise slightly, descend to the target.
const CAMERA_PATH_POINTS: [number, number, number][] = [
  [0, 1.5, 15],
  [-2.5, 1.0, 12],
  [-1.8, 0.3, 9],
  [1.0, -0.3, 6.5],
  [2.6, 0.6, 4.5],
  [3.6, 0.9, 2.8],
  [4.2, 1.0, 1.6],
]

// Maps journey progress to the camera curve's own parameter (t) so the
// camera physically arrives at each station right as its stage text
// activates (0.16/0.36/0.56/0.74), holding the final approach through the
// payoff. The curve's shape (CAMERA_PATH_POINTS) is untouched — only the
// pacing of how we travel along it changes.
const CAMERA_T_BREAKPOINTS: { p: number; t: number }[] = [
  { p: 0, t: 0 },
  { p: 0.16, t: 0.17 },
  { p: 0.36, t: 0.33 },
  { p: 0.56, t: 0.5 },
  { p: 0.74, t: 0.67 },
  { p: 0.88, t: 1.0 },
  { p: 1.0, t: 1.0 },
]

function remapProgressToCurveT(p: number) {
  let i = 0
  while (i < CAMERA_T_BREAKPOINTS.length - 2 && p > CAMERA_T_BREAKPOINTS[i + 1].p) i++
  const a = CAMERA_T_BREAKPOINTS[i]
  const b = CAMERA_T_BREAKPOINTS[i + 1]
  const segT = b.p > a.p ? clamp((p - a.p) / (b.p - a.p), 0, 1) : 0
  return a.t + (b.t - a.t) * segT
}

// How long (in progress units) each station-to-station approach takes at the
// END of a stage's window — the camera holds steady on the current station
// for the rest of the window, then transitions, arriving exactly on the next
// stage's own threshold (matching the text/camera arrival contract).
const STATION_HOLD_TRANSITION = 0.06

type Stations = {
  overview: THREE.Vector3
  station1: THREE.Vector3
  station2: THREE.Vector3
  station3: THREE.Vector3
  station4: THREE.Vector3
}

function computeStations(setup: StorySetup): Stations {
  const bm25Centroid = new THREE.Vector3()
  for (let i = 12; i < 20; i++) {
    bm25Centroid.x += setup.originalPositions[i * 3]
    bm25Centroid.y += setup.originalPositions[i * 3 + 1]
    bm25Centroid.z += setup.originalPositions[i * 3 + 2]
  }
  bm25Centroid.multiplyScalar(1 / 8)

  // Station 1's visual event (the ray burst) happens AT the query point, so
  // the annotation/framing anchors there directly — blending toward the
  // camera curve (as this used to) put the station nearly ON the camera at
  // that point in the journey (see CAMERA_T_BREAKPOINTS), which produces
  // unstable, near-degenerate screen projections. Station 2 blends toward
  // the query point too — a stable, camera-distant landmark — instead of
  // the curve, for the same reason.
  const station1 = QUERY_POINT.clone()
  const station2 = bm25Centroid.clone().lerp(QUERY_POINT, 0.35)

  return {
    overview: new THREE.Vector3(-1, 0.6, 7),
    station1,
    station2,
    station3: QUERY_POINT.clone(),
    station4: QUERY_POINT.clone(),
  }
}

// Mood tint per stage — deep teal-green -> cooler blue-teal -> warm amber -> cream.
const TINT_STAGES = [
  { start: 0, end: 0.3, color: new THREE.Color("#0F6E56") },
  { start: 0.25, end: 0.55, color: new THREE.Color("#12708A") },
  { start: 0.5, end: 0.85, color: new THREE.Color("#8A5A2E") },
  { start: 0.8, end: 1.0, color: new THREE.Color("#D9CBAE") },
]

function stageWeight(p: number, start: number, end: number) {
  const inEnd = start + 0.05
  const outStart = end - 0.05
  if (p <= start || p >= end) return 0
  if (p < inEnd) return (p - start) / (inEnd - start)
  if (p > outStart) return 1 - (p - outStart) / (end - outStart)
  return 1
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand: () => number) {
  const u = 1 - rand()
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

type GalaxyPointBuffers = {
  positions: Float32Array
  sizes: Float32Array
  phases: Float32Array
  brightness: Float32Array
}

function useGalaxyBuffers() {
  return useMemo(() => {
    const rand = mulberry32(1337)
    const centers: THREE.Vector3[] = []
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(2 * rand() - 1)
      const r = CLUSTER_CENTER_RADIUS * Math.cbrt(rand())
      centers.push(
        new THREE.Vector3(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        )
      )
    }

    // Base cloud — kept at POINT_COUNT length and generation order so the
    // retrieval-story nearest-neighbor indexing (buildStorySetup) is unaffected.
    const cloudPositions = new Float32Array(POINT_COUNT * 3)
    for (let i = 0; i < POINT_COUNT; i++) {
      const center = centers[i % CLUSTER_COUNT]
      cloudPositions[i * 3] = center.x + gaussian(rand) * CLUSTER_SPREAD
      cloudPositions[i * 3 + 1] = center.y + gaussian(rand) * CLUSTER_SPREAD
      cloudPositions[i * 3 + 2] = center.z + gaussian(rand) * CLUSTER_SPREAD
    }

    // Dust set: the base cloud plus a brighter, denser core per cluster.
    const coreCount = CLUSTER_COUNT * CORE_PER_CLUSTER
    const dustTotal = POINT_COUNT + coreCount
    const dust: GalaxyPointBuffers = {
      positions: new Float32Array(dustTotal * 3),
      sizes: new Float32Array(dustTotal),
      phases: new Float32Array(dustTotal),
      brightness: new Float32Array(dustTotal),
    }
    dust.positions.set(cloudPositions)
    for (let i = 0; i < POINT_COUNT; i++) {
      dust.sizes[i] = randSize(rand)
      dust.phases[i] = rand() * Math.PI * 2
      dust.brightness[i] = 1.0
    }
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const center = centers[c]
      for (let j = 0; j < CORE_PER_CLUSTER; j++) {
        const idx = POINT_COUNT + c * CORE_PER_CLUSTER + j
        dust.positions[idx * 3] = center.x + gaussian(rand) * CORE_SPREAD
        dust.positions[idx * 3 + 1] = center.y + gaussian(rand) * CORE_SPREAD
        dust.positions[idx * 3 + 2] = center.z + gaussian(rand) * CORE_SPREAD
        dust.sizes[idx] = randSize(rand)
        dust.phases[idx] = rand() * Math.PI * 2
        dust.brightness[idx] = 1.4
      }
    }

    // Teal highlights: a wider subset of the base cloud, brighter and larger.
    const tealIndices: number[] = []
    for (let i = 0; i < POINT_COUNT; i += TEAL_STRIDE) tealIndices.push(i)
    const teal: GalaxyPointBuffers = {
      positions: new Float32Array(tealIndices.length * 3),
      sizes: new Float32Array(tealIndices.length),
      phases: new Float32Array(tealIndices.length),
      brightness: new Float32Array(tealIndices.length).fill(1.0),
    }
    tealIndices.forEach((src, i) => {
      teal.positions[i * 3] = cloudPositions[src * 3]
      teal.positions[i * 3 + 1] = cloudPositions[src * 3 + 1]
      teal.positions[i * 3 + 2] = cloudPositions[src * 3 + 2]
      teal.sizes[i] = randSize(rand)
      teal.phases[i] = rand() * Math.PI * 2
    })

    // Cream foreground stars: a tiny (~3%), slightly brighter subset, offset
    // from the teal sampling so the two sets don't perfectly coincide.
    const creamIndices: number[] = []
    for (let i = 5; i < POINT_COUNT; i += CREAM_STRIDE) creamIndices.push(i)
    const cream: GalaxyPointBuffers = {
      positions: new Float32Array(creamIndices.length * 3),
      sizes: new Float32Array(creamIndices.length),
      phases: new Float32Array(creamIndices.length),
      brightness: new Float32Array(creamIndices.length).fill(1.15),
    }
    creamIndices.forEach((src, i) => {
      cream.positions[i * 3] = cloudPositions[src * 3]
      cream.positions[i * 3 + 1] = cloudPositions[src * 3 + 1]
      cream.positions[i * 3 + 2] = cloudPositions[src * 3 + 2]
      cream.sizes[i] = randSize(rand)
      cream.phases[i] = rand() * Math.PI * 2
    })

    return { cloudPositions, dust, teal, cream }
  }, [])
}

/**
 * Retrieval-story setup: which cloud points play which role, computed once.
 * Story point layout (20 total): [0-11] dense-retrieval candidates (0-2 survive
 * reranking), [12-16] BM25 points that fuse into the candidate set, [17-19] BM25
 * points that fade back to dust.
 */
function buildStorySetup(cloudPositions: Float32Array) {
  const rand = mulberry32(777)

  const distances: { i: number; d2: number }[] = []
  for (let i = 0; i < POINT_COUNT; i++) {
    const dx = cloudPositions[i * 3] - QUERY_POINT.x
    const dy = cloudPositions[i * 3 + 1] - QUERY_POINT.y
    const dz = cloudPositions[i * 3 + 2] - QUERY_POINT.z
    distances.push({ i, d2: dx * dx + dy * dy + dz * dz })
  }
  distances.sort((a, b) => a.d2 - b.d2)

  const denseIndices = distances.slice(0, 12).map((d) => d.i)
  const denseSet = new Set(denseIndices)

  const bm25Indices: number[] = []
  while (bm25Indices.length < 8) {
    const candidate = Math.floor(rand() * POINT_COUNT)
    if (!denseSet.has(candidate) && !bm25Indices.includes(candidate)) {
      bm25Indices.push(candidate)
    }
  }

  const storyIndices = [...denseIndices, ...bm25Indices]
  const originalPositions = new Float32Array(20 * 3)
  for (let i = 0; i < 20; i++) {
    const src = storyIndices[i]
    originalPositions[i * 3] = cloudPositions[src * 3]
    originalPositions[i * 3 + 1] = cloudPositions[src * 3 + 1]
    originalPositions[i * 3 + 2] = cloudPositions[src * 3 + 2]
  }

  const jitteredNearQuery = (count: number) =>
    Array.from({ length: count }, () => {
      const v = new THREE.Vector3(gaussian(rand), gaussian(rand), gaussian(rand))
      v.multiplyScalar(0.35).add(QUERY_POINT)
      return v
    })

  const survivorTargets = jitteredNearQuery(3)
  const joinTargets = jitteredNearQuery(5)

  // Stagger slots for the 14 candidates that don't survive reranking:
  // local story indices 3-11 (9 dense) + 12-16 (5 bm25 joiners).
  const nonSurvivorSlot = new Array<number>(20).fill(-1)
  let slot = 0
  for (let i = 3; i < 12; i++) nonSurvivorSlot[i] = slot++
  for (let i = 12; i < 17; i++) nonSurvivorSlot[i] = slot++

  return { originalPositions, survivorTargets, joinTargets, nonSurvivorSlot }
}

type StorySetup = ReturnType<typeof buildStorySetup>

function useGlowCanvas() {
  return useMemo(() => {
    const size = 128
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")
    if (ctx) {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      gradient.addColorStop(0, "rgba(255,255,255,1)")
      gradient.addColorStop(0.4, "rgba(255,255,255,0.35)")
      gradient.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)
    }
    return canvas
  }, [])
}

function GalaxyPointSet({
  buffers,
  color,
  baseAlpha,
  baseSize,
  timeUniform,
}: {
  buffers: GalaxyPointBuffers
  color: string
  baseAlpha: number | { value: number }
  baseSize: number
  timeUniform: { value: number }
}) {
  const uniforms = useMemo(
    () => ({
      uTime: timeUniform,
      uBaseSize: { value: baseSize },
      uColor: { value: new THREE.Color(color) },
      uBaseAlpha: typeof baseAlpha === "number" ? { value: baseAlpha } : baseAlpha,
    }),
    [timeUniform, baseSize, color, baseAlpha]
  )

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[buffers.positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[buffers.sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[buffers.phases, 1]} />
        <bufferAttribute attach="attributes-aBrightness" args={[buffers.brightness, 1]} />
      </bufferGeometry>
      <shaderMaterial
        args={[
          {
            uniforms,
            vertexShader: GALAXY_VERTEX_SHADER,
            fragmentShader: GALAXY_FRAGMENT_SHADER,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          },
        ]}
      />
    </points>
  )
}

function DriftingCloud({
  dust,
  teal,
  cream,
  pRef,
}: {
  dust: GalaxyPointBuffers
  teal: GalaxyPointBuffers
  cream: GalaxyPointBuffers
  pRef: React.MutableRefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const timeUniform = useRef({ value: 0 })

  useFrame((state, delta) => {
    // Ambient drift only while idle at the top of the section — once the
    // scroll journey begins, the cloud must hold still so its coordinates
    // stay aligned with the fixed camera path and the retrieval-story points.
    const idleFactor = 1 - clamp(pRef.current / 0.05, 0, 1)
    if (groupRef.current) groupRef.current.rotation.y += 0.02 * delta * idleFactor
    timeUniform.current.value = state.clock.elapsedTime
  })

  return (
    <group ref={groupRef}>
      <GalaxyPointSet buffers={dust} color="#8A8678" baseAlpha={0.35} baseSize={0.12} timeUniform={timeUniform.current} />
      <GalaxyPointSet buffers={teal} color="#2DD4A7" baseAlpha={0.7} baseSize={0.19} timeUniform={timeUniform.current} />
      <GalaxyPointSet buffers={cream} color="#ECE8DF" baseAlpha={0.8} baseSize={0.16} timeUniform={timeUniform.current} />
    </group>
  )
}

function useNearDustBuffers() {
  return useMemo(() => {
    const rand = mulberry32(4242)
    const count = 300
    const path = CAMERA_PATH_POINTS.map((p) => new THREE.Vector3(...p))
    const tmp = new THREE.Vector3()
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)
    const brightness = new Float32Array(count).fill(1.0)

    for (let i = 0; i < count; i++) {
      const t = rand() * (path.length - 1)
      const seg = Math.min(Math.floor(t), path.length - 2)
      tmp.lerpVectors(path[seg], path[seg + 1], t - seg)
      positions[i * 3] = tmp.x + gaussian(rand) * 2.2
      positions[i * 3 + 1] = tmp.y + gaussian(rand) * 1.6
      positions[i * 3 + 2] = tmp.z + gaussian(rand) * 2.2
      sizes[i] = randSize(rand) * 1.8
      phases[i] = rand() * Math.PI * 2
    }

    return { positions, sizes, phases, brightness }
  }, [])
}

function NearDust({ pRef }: { pRef: React.MutableRefObject<number> }) {
  const buffers = useNearDustBuffers()
  const timeUniform = useRef({ value: 0 })
  const alphaUniform = useRef({ value: 0.15 })

  useFrame((state) => {
    timeUniform.current.value = state.clock.elapsedTime
    // Fade out entirely within the final payoff window so it never competes
    // with the cream card.
    const fadeOut = clamp((pRef.current - 0.85) / 0.15, 0, 1)
    alphaUniform.current.value = 0.15 * (1 - fadeOut)
  })

  return (
    <GalaxyPointSet
      buffers={buffers}
      color="#8A8678"
      baseAlpha={alphaUniform.current}
      baseSize={0.32}
      timeUniform={timeUniform.current}
    />
  )
}

// Station 02's distinct signature: ~40 nearby particles assemble into a neat
// 4x10 grid constellation during its window (0.36-0.56), hold, then disperse.
const GRID_ROWS = 4
const GRID_COLS = 10
const GRID_COUNT = GRID_ROWS * GRID_COLS
const GRID_SPACING = 0.38

function useGridBuffers(center: THREE.Vector3) {
  return useMemo(() => {
    const rand = mulberry32(9001)
    const scattered = new Float32Array(GRID_COUNT * 3)
    const grid = new Float32Array(GRID_COUNT * 3)
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = r * GRID_COLS + c
        scattered[idx * 3] = center.x + gaussian(rand) * 1.6
        scattered[idx * 3 + 1] = center.y + gaussian(rand) * 1.6
        scattered[idx * 3 + 2] = center.z + gaussian(rand) * 1.6
        grid[idx * 3] = center.x + (c - (GRID_COLS - 1) / 2) * GRID_SPACING
        grid[idx * 3 + 1] = center.y + (r - (GRID_ROWS - 1) / 2) * GRID_SPACING
        grid[idx * 3 + 2] = center.z
      }
    }
    return { scattered, grid }
  }, [center])
}

function GridConstellation({ pRef, station2 }: { pRef: React.MutableRefObject<number>; station2: THREE.Vector3 }) {
  const { scattered, grid } = useGridBuffers(station2)
  const livePositions = useRef(new Float32Array(scattered))
  const geomRef = useRef<THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes>>(null)
  const matRef = useRef<THREE.PointsMaterial>(null)

  useFrame(() => {
    const p = pRef.current
    // Assemble early in the window, hold until the window ends (0.56), then disperse.
    const assembleT = clamp((p - 0.36) / 0.08, 0, 1)
    const disperseT = clamp((p - 0.56) / 0.08, 0, 1)
    const positionT = assembleT * (1 - disperseT)
    const fadeIn = clamp((p - 0.36) / 0.04, 0, 1)
    const fadeOut = 1 - clamp((p - 0.56) / 0.06, 0, 1)
    const opacity = 0.6 * fadeIn * fadeOut

    const positions = livePositions.current
    for (let i = 0; i < GRID_COUNT; i++) {
      positions[i * 3] = scattered[i * 3] + (grid[i * 3] - scattered[i * 3]) * positionT
      positions[i * 3 + 1] = scattered[i * 3 + 1] + (grid[i * 3 + 1] - scattered[i * 3 + 1]) * positionT
      positions[i * 3 + 2] = scattered[i * 3 + 2] + (grid[i * 3 + 2] - scattered[i * 3 + 2]) * positionT
    }
    if (geomRef.current) geomRef.current.attributes.position.needsUpdate = true
    if (matRef.current) matRef.current.opacity = opacity
  })

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" args={[livePositions.current, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={matRef} color="#2DD4A7" size={0.09} sizeAttenuation transparent opacity={0} depthWrite={false} />
    </points>
  )
}

function CameraRig({
  pRef,
  stations,
  onStationProjected,
}: {
  pRef: React.MutableRefObject<number>
  stations: Stations
  onStationProjected?: (x: number, y: number, visible: boolean) => void
}) {
  const { camera, gl } = useThree()
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(CAMERA_PATH_POINTS.map((p) => new THREE.Vector3(...p))),
    []
  )

  // The camera HOLDS on each station for the bulk of its stage window, only
  // approaching the next one in the final STATION_HOLD_TRANSITION slice —
  // arriving exactly on the next stage's own threshold. Without this hold,
  // the lookAt target drifts continuously across the ENTIRE window (station
  // N to station N+1), which is why a station could end up off-frame
  // partway through its own window.
  const stationBreakpoints = useMemo(() => {
    const T = STATION_HOLD_TRANSITION
    return [
      { p: 0, point: stations.overview },
      { p: 0.16 - T, point: stations.overview },
      { p: 0.16, point: stations.station1 },
      { p: 0.36 - T, point: stations.station1 },
      { p: 0.36, point: stations.station2 },
      { p: 0.56 - T, point: stations.station2 },
      { p: 0.56, point: stations.station3 },
      { p: 0.74, point: stations.station4 },
    ]
  }, [stations])

  const posOut = useRef(new THREE.Vector3())
  const rawStation = useRef(new THREE.Vector3())
  const lookAtOut = useRef(new THREE.Vector3())
  const dirVec = useRef(new THREE.Vector3())
  const rightVec = useRef(new THREE.Vector3())
  const upVec = useRef(new THREE.Vector3())
  const projected = useRef(new THREE.Vector3())
  const lastGoodPx = useRef(0)
  const lastGoodPy = useRef(0)

  useFrame(() => {
    const p = clamp(pRef.current, 0, 1)
    curve.getPoint(remapProgressToCurveT(p), posOut.current)
    camera.position.copy(posOut.current)

    // Piecewise-linear lerp between whichever pair of hold/approach
    // breakpoints brackets p — holds steady on-station, only moving during
    // the brief approach slice at the end of each window.
    let i = 0
    while (i < stationBreakpoints.length - 2 && p > stationBreakpoints[i + 1].p) i++
    const a = stationBreakpoints[i]
    const b = stationBreakpoints[i + 1]
    const segT = b.p > a.p ? clamp((p - a.p) / (b.p - a.p), 0, 1) : 0
    rawStation.current.lerpVectors(a.point, b.point, segT)

    // Off-center framing: aim left of and below the station so it lands at
    // the right-third of the viewport, slightly above vertical center.
    dirVec.current.subVectors(rawStation.current, camera.position)
    const distance = dirVec.current.length()
    dirVec.current.normalize()
    rightVec.current.crossVectors(dirVec.current, WORLD_UP).normalize()
    upVec.current.crossVectors(rightVec.current, dirVec.current).normalize()

    const persp = camera as THREE.PerspectiveCamera
    const vFov = THREE.MathUtils.degToRad(persp.fov)
    const halfHeight = distance * Math.tan(vFov / 2)
    const halfWidth = halfHeight * persp.aspect

    lookAtOut.current
      .copy(rawStation.current)
      .addScaledVector(rightVec.current, -FRAME_OFFSET_X * halfWidth)
      .addScaledVector(upVec.current, -FRAME_OFFSET_Y * halfHeight)

    camera.lookAt(lookAtOut.current)

    // Report the active station's screen-space position (pre-offset — the
    // point itself, not the off-center aim) for the leader line drawn in the
    // HTML layer outside the canvas. Use the canvas's own DOM bounding rect
    // (the same approach drei's Html uses internally) rather than just its
    // logical size, so the result is true viewport-relative pixels and lines
    // up with getBoundingClientRect()-based measurements taken outside the canvas.
    if (onStationProjected) {
      camera.updateMatrixWorld()
      projected.current.copy(rawStation.current).project(camera)
      // Guard against near-camera / behind-camera stations: projecting a
      // point that's almost on top of the camera (or outside its near/far
      // planes) yields wildly unstable screen coordinates. When that
      // happens, hold the last known-good position and report not visible
      // rather than snapping the leader line to a bogus spot.
      const zValid = projected.current.z > -1 && projected.current.z < 1
      const distanceValid = distance >= 1.2
      const visible = zValid && distanceValid
      if (visible) {
        const canvasRect = gl.domElement.getBoundingClientRect()
        const px = canvasRect.left + (projected.current.x * 0.5 + 0.5) * canvasRect.width
        const py = canvasRect.top + (-projected.current.y * 0.5 + 0.5) * canvasRect.height
        lastGoodPx.current = px
        lastGoodPy.current = py
        onStationProjected(px, py, true)
      } else {
        onStationProjected(lastGoodPx.current, lastGoodPy.current, false)
      }
    }
  })

  return null
}

function StoryLayer({ pRef, setup }: { pRef: React.MutableRefObject<number>; setup: StorySetup }) {
  const glowCanvas = useGlowCanvas()

  const livePositions = useRef(new Float32Array(setup.originalPositions))
  const liveColors = useRef(new Float32Array(20 * 3).fill(0))
  const pointsGeomRef = useRef<THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes>>(null)
  const lineGeomRefs = useRef<(THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes> | null)[]>([])
  const lineMatRefs = useRef<(THREE.LineBasicMaterial | null)[]>([])
  const survivorGroupRefs = useRef<(THREE.Group | null)[]>([])
  const queryMatRef = useRef<THREE.PointsMaterial>(null)
  const glowSpriteRef = useRef<THREE.Sprite>(null)
  const glowMatRef = useRef<THREE.SpriteMaterial>(null)

  const [showLabels, setShowLabels] = useState(false)
  const labelsVisibleRef = useRef(false)
  const labelElRefs = useRef<(HTMLSpanElement | null)[]>([])

  const tmpColor = useRef(new THREE.Color())

  useFrame((state) => {
    const p = pRef.current

    // Query point + additive glow: scale-pop in at p=0.08 over ~0.06 progress.
    const popT = clamp((p - 0.08) / 0.06, 0, 1)
    if (queryMatRef.current) queryMatRef.current.size = 0.14 * popT
    if (glowSpriteRef.current) glowSpriteRef.current.scale.setScalar(1.5 * popT)
    if (glowMatRef.current) {
      // While the retrieval rays are firing (p 0.16-0.36) the query glow
      // breathes gently instead of holding flat, to read as "alive" during
      // the burst; outside that window it keeps its plain pop-in opacity.
      if (p >= 0.16 && p <= 0.36) {
        glowMatRef.current.opacity = 0.6 + 0.12 * Math.sin(state.clock.elapsedTime * 1.6)
      } else {
        glowMatRef.current.opacity = 0.6 * popT
      }
    }

    const positions = livePositions.current
    const colors = liveColors.current

    for (let i = 0; i < 20; i++) {
      const ox = setup.originalPositions[i * 3]
      const oy = setup.originalPositions[i * 3 + 1]
      const oz = setup.originalPositions[i * 3 + 2]

      let x = ox
      let y = oy
      let z = oz
      tmpColor.current.copy(MUTED)

      if (i < 12) {
        // Dense retrieval candidates ("retrieval rays"): each point brightens
        // as ITS ray arrives, staggered per index across the burst window,
        // then flares 15% past teal toward white so lit points read as
        // ignited (points can't scale up individually, so color stands in
        // for the size boost).
        const brightenT = clamp((p - (0.16 + (i / 12) * 0.05)) / 0.04, 0, 1)
        tmpColor.current.lerpColors(MUTED, TEAL, brightenT)
        tmpColor.current.lerp(WHITE, 0.15 * brightenT)

        if (i < 3) {
          // Survivors: drift toward the query cluster (stage 04 content, p 0.74-0.86).
          const driftT = clamp((p - 0.74) / 0.12, 0, 1)
          const target = setup.survivorTargets[i]
          x = ox + (target.x - ox) * driftT
          y = oy + (target.y - oy) * driftT
          z = oz + (target.z - oz) * driftT
        } else {
          // Reranking cull, p 0.56-0.78.
          const dimStart = 0.56 + (setup.nonSurvivorSlot[i] / 14) * 0.17
          const dimT = clamp((p - dimStart) / 0.05, 0, 1)
          tmpColor.current.lerp(MUTED, dimT)
        }
      } else if (i < 17) {
        // BM25 fusion joiners ("chunking" phase, p 0.36-0.56): flare amber, hold, then drift + recolor to teal.
        const flareT = clamp((p - 0.36) / 0.05, 0, 1)
        tmpColor.current.lerpColors(MUTED, AMBER, flareT)
        const joinT = clamp((p - 0.46) / 0.1, 0, 1)
        tmpColor.current.lerp(TEAL, joinT)
        const target = setup.joinTargets[i - 12]
        x = ox + (target.x - ox) * joinT
        y = oy + (target.y - oy) * joinT
        z = oz + (target.z - oz) * joinT

        // Reranking cull, p 0.56-0.78.
        const dimStart = 0.56 + (setup.nonSurvivorSlot[i] / 14) * 0.17
        const dimT = clamp((p - dimStart) / 0.05, 0, 1)
        tmpColor.current.lerp(MUTED, dimT)
      } else {
        // BM25 fusion drop-outs ("chunking" phase, p 0.36-0.56): flare amber briefly, then fade back to dust.
        const flareT = clamp((p - 0.36) / 0.05, 0, 1)
        tmpColor.current.lerpColors(MUTED, AMBER, flareT)
        const fadeT = clamp((p - 0.46) / 0.1, 0, 1)
        tmpColor.current.lerp(MUTED, fadeT)
      }

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      colors[i * 3] = tmpColor.current.r
      colors[i * 3 + 1] = tmpColor.current.g
      colors[i * 3 + 2] = tmpColor.current.b
    }

    const geom = pointsGeomRef.current
    if (geom) {
      geom.attributes.position.needsUpdate = true
      geom.attributes.color.needsUpdate = true
    }

    // The 12 candidate lines "draw" outward from the query point (retrieval
    // rays), completing early and holding — fully drawn by p≈0.23 rather than
    // dragging out across the whole 0.16-0.36 window — then fade to nothing
    // during the payoff quiet-down (fully gone by p=0.9).
    const drawT = clamp((p - 0.16) / 0.07, 0, 1)
    const lineFade = 1 - clamp((p - 0.85) / 0.05, 0, 1)
    for (let i = 0; i < 12; i++) {
      const lineGeom = lineGeomRefs.current[i]
      if (lineGeom) {
        const posAttr = lineGeom.attributes.position as THREE.BufferAttribute
        const arr = posAttr.array as Float32Array
        arr[3] = QUERY_POINT.x + (positions[i * 3] - QUERY_POINT.x) * drawT
        arr[4] = QUERY_POINT.y + (positions[i * 3 + 1] - QUERY_POINT.y) * drawT
        arr[5] = QUERY_POINT.z + (positions[i * 3 + 2] - QUERY_POINT.z) * drawT
        posAttr.needsUpdate = true
      }
      const lineMat = lineMatRefs.current[i]
      if (lineMat) lineMat.opacity = 0.35 * lineFade
    }

    // Anchor the score-label groups to their survivor's live position.
    for (let s = 0; s < 3; s++) {
      const grp = survivorGroupRefs.current[s]
      if (grp) grp.position.set(positions[s * 3], positions[s * 3 + 1], positions[s * 3 + 2])
    }

    // Score labels: visible across the 0.56-0.78 reranking window, fully
    // faded out by 0.84 — clear of the payoff card's 0.88 entrance.
    const labelFadeIn = clamp((p - 0.56) / 0.05, 0, 1)
    const labelFadeOut = clamp((p - 0.78) / 0.06, 0, 1)
    const labelOpacity = labelFadeIn * (1 - labelFadeOut)
    for (const el of labelElRefs.current) {
      if (el) el.style.opacity = String(labelOpacity)
    }

    const shouldShow = p > 0.56 && p < 0.84
    if (shouldShow !== labelsVisibleRef.current) {
      labelsVisibleRef.current = shouldShow
      setShowLabels(shouldShow)
    }
  })

  return (
    <>
      <points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([QUERY_POINT.x, QUERY_POINT.y, QUERY_POINT.z]), 3]}
          />
        </bufferGeometry>
        <pointsMaterial ref={queryMatRef} size={0} sizeAttenuation transparent opacity={0.95} color="#2DD4A7" />
      </points>

      <sprite ref={glowSpriteRef} position={[QUERY_POINT.x, QUERY_POINT.y, QUERY_POINT.z]} scale={[0, 0, 0]}>
        <spriteMaterial
          ref={glowMatRef}
          transparent
          opacity={0}
          color="#2DD4A7"
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        >
          <canvasTexture attach="map" args={[glowCanvas]} />
        </spriteMaterial>
      </sprite>

      {Array.from({ length: 12 }).map((_, i) => (
        <line key={i}>
          <bufferGeometry ref={(el) => { lineGeomRefs.current[i] = el }}>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  QUERY_POINT.x,
                  QUERY_POINT.y,
                  QUERY_POINT.z,
                  QUERY_POINT.x,
                  QUERY_POINT.y,
                  QUERY_POINT.z,
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial ref={(el) => { lineMatRefs.current[i] = el }} color="#2DD4A7" transparent opacity={0.35} />
        </line>
      ))}

      <points>
        <bufferGeometry ref={pointsGeomRef}>
          <bufferAttribute attach="attributes-position" args={[livePositions.current, 3]} />
          <bufferAttribute attach="attributes-color" args={[liveColors.current, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.07} sizeAttenuation vertexColors transparent opacity={0.9} />
      </points>

      {showLabels &&
        [0, 1, 2].map((s) => (
          <group
            key={s}
            ref={(el) => { survivorGroupRefs.current[s] = el }}
            position={[setup.originalPositions[s * 3], setup.originalPositions[s * 3 + 1], setup.originalPositions[s * 3 + 2]]}
          >
            <Html occlude={false} center={false}>
              <span
                ref={(el) => { labelElRefs.current[s] = el }}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "#2DD4A7",
                  background: "rgba(10,10,15,0.85)",
                  border: "1px solid rgba(45,212,167,0.5)",
                  padding: "3px 8px",
                  borderRadius: 999,
                  whiteSpace: "nowrap",
                  // Stagger above/below by index so the three chips — which can
                  // sit close together once their points converge — never overlap.
                  transform: `translate(10px, ${(s - 1) * 18}px)`,
                  display: "inline-block",
                  opacity: 0,
                }}
              >
                relevance {SCORES[s].toFixed(2)}
              </span>
            </Html>
          </group>
        ))}
    </>
  )
}

function SceneFog({ pRef }: { pRef: React.MutableRefObject<number> }) {
  const fogRef = useRef<THREE.Fog>(null)
  const baseColor = useMemo(() => new THREE.Color("#0A0A0F"), [])
  const blended = useRef(new THREE.Color())

  useFrame(() => {
    if (!fogRef.current) return
    const p = pRef.current
    blended.current.copy(baseColor)
    for (const stage of TINT_STAGES) {
      const w = stageWeight(p, stage.start, stage.end)
      if (w > 0) blended.current.lerp(stage.color, w * 0.3)
    }
    fogRef.current.color.copy(blended.current)
  })

  return <fog ref={fogRef} attach="fog" args={["#0A0A0F", 10, 26]} />
}

function Scene({
  progress,
  onStationProjected,
}: {
  progress: MotionValue<number>
  onStationProjected?: (x: number, y: number, visible: boolean) => void
}) {
  // `progress` is already the shared, damped (1 - exp(-9 * delta)) value
  // computed once in EmbeddingSection — read it directly here so the camera
  // and every HTML overlay move in lockstep off the same smoothed signal.
  const smoothedP = useRef(0)
  const galaxy = useGalaxyBuffers()
  const setup = useMemo(() => buildStorySetup(galaxy.cloudPositions), [galaxy.cloudPositions])
  const stations = useMemo(() => computeStations(setup), [setup])

  useFrame(() => {
    smoothedP.current = progress.get()
  })

  return (
    <>
      <SceneFog pRef={smoothedP} />
      <DriftingCloud dust={galaxy.dust} teal={galaxy.teal} cream={galaxy.cream} pRef={smoothedP} />
      <NearDust pRef={smoothedP} />
      <GridConstellation pRef={smoothedP} station2={stations.station2} />
      <CameraRig pRef={smoothedP} stations={stations} onStationProjected={onStationProjected} />
      <StoryLayer pRef={smoothedP} setup={setup} />
    </>
  )
}

export default function EmbeddingSpace({
  progress,
  onStationProjected,
}: {
  progress: MotionValue<number>
  onStationProjected?: (x: number, y: number, visible: boolean) => void
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 14], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <Scene progress={progress} onStationProjected={onStationProjected} />
    </Canvas>
  )
}
