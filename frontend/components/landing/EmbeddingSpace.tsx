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
const HIGHLIGHT_STRIDE = 12 // ~8.3% of points get the teal highlight pass

const MUTED = new THREE.Color("#8A8678")
const TEAL = new THREE.Color("#2DD4A7")
const AMBER = new THREE.Color("#EF9F27")

const QUERY_POINT = new THREE.Vector3(4.2, 1.0, 0)
const SCORES = [0.91, 0.87, 0.84]

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

function useClusterPositions() {
  return useMemo(() => {
    const rand = mulberry32(1337)
    const centers: [number, number, number][] = []
    for (let c = 0; c < CLUSTER_COUNT; c++) {
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(2 * rand() - 1)
      const r = CLUSTER_CENTER_RADIUS * Math.cbrt(rand())
      centers.push([
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ])
    }

    const positions = new Float32Array(POINT_COUNT * 3)
    const highlightPositions: number[] = []

    for (let i = 0; i < POINT_COUNT; i++) {
      const [cx, cy, cz] = centers[i % CLUSTER_COUNT]
      const x = cx + gaussian(rand) * CLUSTER_SPREAD
      const y = cy + gaussian(rand) * CLUSTER_SPREAD
      const z = cz + gaussian(rand) * CLUSTER_SPREAD
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      if (i % HIGHLIGHT_STRIDE === 0) {
        highlightPositions.push(x, y, z)
      }
    }

    return { positions, highlightPositions: new Float32Array(highlightPositions) }
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

function DriftingCloud({
  positions,
  highlightPositions,
  pRef,
}: {
  positions: Float32Array
  highlightPositions: Float32Array
  pRef: React.MutableRefObject<number>
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    // Ambient drift only while idle at the top of the section — once the
    // scroll journey begins, the cloud must hold still so its coordinates
    // stay aligned with the fixed camera path and the retrieval-story points.
    const idleFactor = 1 - clamp(pRef.current / 0.05, 0, 1)
    if (groupRef.current) groupRef.current.rotation.y += 0.02 * delta * idleFactor
  })

  return (
    <group ref={groupRef}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.045} sizeAttenuation transparent opacity={0.55} color="#8A8678" />
      </points>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[highlightPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} sizeAttenuation transparent opacity={0.8} color="#2DD4A7" />
      </points>
    </group>
  )
}

function CameraRig({ pRef }: { pRef: React.MutableRefObject<number> }) {
  const { camera } = useThree()
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 14),
        new THREE.Vector3(2, 0.5, 8),
        new THREE.Vector3(3.5, 0.8, 4),
        new THREE.Vector3(4.2, 1.0, 1.6),
      ]),
    []
  )
  const posOut = useRef(new THREE.Vector3())
  const lookAtOut = useRef(new THREE.Vector3())

  useFrame(() => {
    const p = clamp(pRef.current, 0, 1)
    curve.getPoint(p, posOut.current)
    camera.position.copy(posOut.current)
    const lookAtT = clamp((p - 0.5) / 0.5, 0, 1)
    lookAtOut.current.set(0, 0, 0).lerp(QUERY_POINT, lookAtT)
    camera.lookAt(lookAtOut.current)
  })

  return null
}

function StoryLayer({ pRef, cloudPositions }: { pRef: React.MutableRefObject<number>; cloudPositions: Float32Array }) {
  const setup = useMemo(() => buildStorySetup(cloudPositions), [cloudPositions])
  const glowCanvas = useGlowCanvas()

  const livePositions = useRef(new Float32Array(setup.originalPositions))
  const liveColors = useRef(new Float32Array(20 * 3).fill(0))
  const pointsGeomRef = useRef<THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes>>(null)
  const lineGeomRefs = useRef<(THREE.BufferGeometry<THREE.NormalOrGLBufferAttributes> | null)[]>([])
  const survivorGroupRefs = useRef<(THREE.Group | null)[]>([])
  const queryMatRef = useRef<THREE.PointsMaterial>(null)
  const glowSpriteRef = useRef<THREE.Sprite>(null)
  const glowMatRef = useRef<THREE.SpriteMaterial>(null)

  const [showLabels, setShowLabels] = useState(false)
  const labelsVisibleRef = useRef(false)

  const tmpColor = useRef(new THREE.Color())

  useFrame(() => {
    const p = pRef.current

    // Query point + additive glow: scale-pop in at p=0.08 over ~0.06 progress.
    const popT = clamp((p - 0.08) / 0.06, 0, 1)
    if (queryMatRef.current) queryMatRef.current.size = 0.14 * popT
    if (glowSpriteRef.current) glowSpriteRef.current.scale.setScalar(1.5 * popT)
    if (glowMatRef.current) glowMatRef.current.opacity = 0.6 * popT

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
        // Dense retrieval candidates: brighten to teal over p 0.1-0.3.
        const brightenT = clamp((p - 0.1) / 0.2, 0, 1)
        tmpColor.current.lerpColors(MUTED, TEAL, brightenT)

        if (i < 3) {
          // Survivors: drift toward the query cluster during reranking.
          const driftT = clamp((p - 0.5) / 0.25, 0, 1)
          const target = setup.survivorTargets[i]
          x = ox + (target.x - ox) * driftT
          y = oy + (target.y - oy) * driftT
          z = oz + (target.z - oz) * driftT
        } else {
          const dimStart = 0.5 + (setup.nonSurvivorSlot[i] / 14) * 0.2
          const dimT = clamp((p - dimStart) / 0.05, 0, 1)
          tmpColor.current.lerp(MUTED, dimT)
        }
      } else if (i < 17) {
        // BM25 fusion joiners: flare amber, hold, then drift + recolor to teal.
        const flareT = clamp((p - 0.3) / 0.05, 0, 1)
        tmpColor.current.lerpColors(MUTED, AMBER, flareT)
        const joinT = clamp((p - 0.4) / 0.1, 0, 1)
        tmpColor.current.lerp(TEAL, joinT)
        const target = setup.joinTargets[i - 12]
        x = ox + (target.x - ox) * joinT
        y = oy + (target.y - oy) * joinT
        z = oz + (target.z - oz) * joinT

        const dimStart = 0.5 + (setup.nonSurvivorSlot[i] / 14) * 0.2
        const dimT = clamp((p - dimStart) / 0.05, 0, 1)
        tmpColor.current.lerp(MUTED, dimT)
      } else {
        // BM25 fusion drop-outs: flare amber briefly, then fade back to dust.
        const flareT = clamp((p - 0.3) / 0.05, 0, 1)
        tmpColor.current.lerpColors(MUTED, AMBER, flareT)
        const fadeT = clamp((p - 0.4) / 0.1, 0, 1)
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

    // The 12 candidate lines "draw" outward from the query point.
    const drawT = clamp((p - 0.1) / 0.2, 0, 1)
    for (let i = 0; i < 12; i++) {
      const lineGeom = lineGeomRefs.current[i]
      if (!lineGeom) continue
      const posAttr = lineGeom.attributes.position as THREE.BufferAttribute
      const arr = posAttr.array as Float32Array
      arr[3] = QUERY_POINT.x + (positions[i * 3] - QUERY_POINT.x) * drawT
      arr[4] = QUERY_POINT.y + (positions[i * 3 + 1] - QUERY_POINT.y) * drawT
      arr[5] = QUERY_POINT.z + (positions[i * 3 + 2] - QUERY_POINT.z) * drawT
      posAttr.needsUpdate = true
    }

    // Anchor the score-label groups to their survivor's live position.
    for (let s = 0; s < 3; s++) {
      const grp = survivorGroupRefs.current[s]
      if (grp) grp.position.set(positions[s * 3], positions[s * 3 + 1], positions[s * 3 + 2])
    }

    const shouldShow = p > 0.55
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
          <lineBasicMaterial color="#2DD4A7" transparent opacity={0.35} />
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
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "#2DD4A7",
                  background: "rgba(16,16,24,0.7)",
                  padding: "2px 6px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                  transform: "translate(10px, -10px)",
                  display: "inline-block",
                }}
              >
                {SCORES[s].toFixed(2)}
              </span>
            </Html>
          </group>
        ))}
    </>
  )
}

function Scene({ progress }: { progress: MotionValue<number> }) {
  const smoothedP = useRef(0)
  const cloud = useClusterPositions()

  useFrame((_, delta) => {
    const target = progress.get()
    const damping = 1 - Math.exp(-4 * delta)
    smoothedP.current += (target - smoothedP.current) * damping
  })

  return (
    <>
      <DriftingCloud positions={cloud.positions} highlightPositions={cloud.highlightPositions} pRef={smoothedP} />
      <CameraRig pRef={smoothedP} />
      <StoryLayer pRef={smoothedP} cloudPositions={cloud.positions} />
    </>
  )
}

export default function EmbeddingSpace({ progress }: { progress: MotionValue<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 14], fov: 50 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      style={{ background: "transparent" }}
    >
      <fog attach="fog" args={["#0A0A0F", 10, 26]} />
      <Scene progress={progress} />
    </Canvas>
  )
}
