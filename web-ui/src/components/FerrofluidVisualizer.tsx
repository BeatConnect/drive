import { useRef, useEffect } from 'react'
import { useAudio } from '../context/AudioContext'

interface FerrofluidVisualizerProps {
  size: number
  mode?: number // 0=Tube, 1=Tape, 2=Transistor
}

// Mode configurations for unique looks
const modeConfigs = [
  // Tube: Warm, smooth, flowing - deep orange/amber
  {
    hueBase: 20,
    hueSat: 90,
    noiseSpeed: 0.008,   // Very slow, smooth
    noiseScale: 1.0,
    spikeAmount: 0.25,
    glowIntensity: 0.5,
    specularPower: 16,
    baseColor: { r: 255, g: 100, b: 30 },
    glowColor: { r: 255, g: 80, b: 20 },
  },
  // Tape: Warm golden/bronze
  {
    hueBase: 35,
    hueSat: 80,
    noiseSpeed: 0.006,   // Even slower, lazy
    noiseScale: 1.5,
    spikeAmount: 0.15,
    glowIntensity: 0.4,
    specularPower: 12,
    baseColor: { r: 255, g: 140, b: 50 },
    glowColor: { r: 255, g: 120, b: 40 },
  },
  // Transistor: Aggressive red/crimson
  {
    hueBase: 0,
    hueSat: 95,
    noiseSpeed: 0.015,   // Faster, more aggressive
    noiseScale: 0.7,
    spikeAmount: 0.4,
    glowIntensity: 0.7,
    specularPower: 32,
    baseColor: { r: 255, g: 50, b: 50 },
    glowColor: { r: 255, g: 30, b: 30 },
  }
]

// Simplex noise for organic deformation
class SimplexNoise {
  private perm: number[] = []

  constructor(seed = Math.random() * 10000) {
    const p = []
    for (let i = 0; i < 256; i++) p[i] = Math.floor((Math.sin(seed + i) * 0.5 + 0.5) * 256)
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255]
  }

  noise3D(x: number, y: number, z: number): number {
    const floor = Math.floor
    const F3 = 1 / 3, G3 = 1 / 6
    const s = (x + y + z) * F3
    const i = floor(x + s), j = floor(y + s), k = floor(z + s)
    const t = (i + j + k) * G3
    const X0 = i - t, Y0 = j - t, Z0 = k - t
    const x0 = x - X0, y0 = y - Y0, z0 = z - Z0

    let i1, j1, k1, i2, j2, k2
    if (x0 >= y0) {
      if (y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0 }
      else if (x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1 }
      else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1 }
    } else {
      if (y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1 }
      else if (x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1 }
      else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0 }
    }

    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3
    const x2 = x0 - i2 + 2*G3, y2 = y0 - j2 + 2*G3, z2 = z0 - k2 + 2*G3
    const x3 = x0 - 1 + 3*G3, y3 = y0 - 1 + 3*G3, z3 = z0 - 1 + 3*G3

    const ii = i & 255, jj = j & 255, kk = k & 255

    const grad = (hash: number, x: number, y: number, z: number) => {
      const h = hash & 15
      const u = h < 8 ? x : y
      const v = h < 4 ? y : h === 12 || h === 14 ? x : z
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
    }

    let n0 = 0, n1 = 0, n2 = 0, n3 = 0
    let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0
    if (t0 > 0) { t0 *= t0; n0 = t0 * t0 * grad(this.perm[ii+this.perm[jj+this.perm[kk]]], x0, y0, z0) }
    let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1
    if (t1 > 0) { t1 *= t1; n1 = t1 * t1 * grad(this.perm[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]], x1, y1, z1) }
    let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2
    if (t2 > 0) { t2 *= t2; n2 = t2 * t2 * grad(this.perm[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]], x2, y2, z2) }
    let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3
    if (t3 > 0) { t3 *= t3; n3 = t3 * t3 * grad(this.perm[ii+1+this.perm[jj+1+this.perm[kk+1]]], x3, y3, z3) }

    return 32 * (n0 + n1 + n2 + n3)
  }
}

interface Vertex {
  x: number; y: number; z: number
  nx: number; ny: number; nz: number
}

interface Face {
  v0: number; v1: number; v2: number
}

// Lerp between two configs
function lerpConfig(a: typeof modeConfigs[0], b: typeof modeConfigs[0], t: number) {
  const lerp = (x: number, y: number) => x + (y - x) * t
  return {
    hueBase: lerp(a.hueBase, b.hueBase),
    hueSat: lerp(a.hueSat, b.hueSat),
    noiseSpeed: lerp(a.noiseSpeed, b.noiseSpeed),
    noiseScale: lerp(a.noiseScale, b.noiseScale),
    spikeAmount: lerp(a.spikeAmount, b.spikeAmount),
    glowIntensity: lerp(a.glowIntensity, b.glowIntensity),
    specularPower: lerp(a.specularPower, b.specularPower),
    baseColor: {
      r: lerp(a.baseColor.r, b.baseColor.r),
      g: lerp(a.baseColor.g, b.baseColor.g),
      b: lerp(a.baseColor.b, b.baseColor.b),
    },
    glowColor: {
      r: lerp(a.glowColor.r, b.glowColor.r),
      g: lerp(a.glowColor.g, b.glowColor.g),
      b: lerp(a.glowColor.b, b.glowColor.b),
    },
  }
}

export function FerrofluidVisualizer({ size, mode = 0 }: FerrofluidVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { smoothRms, smoothPeak } = useAudio()
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)
  const noiseRef = useRef<SimplexNoise | null>(null)
  const sphereRef = useRef<{ vertices: Vertex[]; faces: Face[] } | null>(null)

  // Smooth mode transitions
  const currentConfigRef = useRef(modeConfigs[0])
  const targetConfigRef = useRef(modeConfigs[0])
  const transitionRef = useRef(1) // 1 = complete, 0 = just started
  const prevModeRef = useRef(0)

  // When mode changes, start transition
  if (mode !== prevModeRef.current) {
    currentConfigRef.current = { ...currentConfigRef.current } // snapshot current interpolated state
    targetConfigRef.current = modeConfigs[mode] || modeConfigs[0]
    transitionRef.current = 0
    prevModeRef.current = mode
  }

  useEffect(() => {
    noiseRef.current = new SimplexNoise(42)
    const sphere = createIcosphere(3)
    sphereRef.current = sphere
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const noise = noiseRef.current
    const sphere = sphereRef.current
    if (!canvas || !noise || !sphere) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const canvasSize = size * 1.5
    const offset = (canvasSize - size) / 2

    canvas.width = canvasSize * dpr
    canvas.height = canvasSize * dpr
    canvas.style.width = `${canvasSize}px`
    canvas.style.height = `${canvasSize}px`
    canvas.style.marginLeft = `${-offset}px`
    canvas.style.marginTop = `${-offset}px`
    ctx.scale(dpr, dpr)

    const centerX = canvasSize / 2
    const centerY = canvasSize / 2
    const lightDir = normalize({ x: -0.4, y: -0.6, z: 0.7 })

    const render = () => {
      // Smooth transition between modes
      if (transitionRef.current < 1) {
        transitionRef.current = Math.min(1, transitionRef.current + 0.02) // ~1 second transition at 60fps
        const eased = 1 - Math.pow(1 - transitionRef.current, 3) // ease-out cubic
        currentConfigRef.current = lerpConfig(currentConfigRef.current, targetConfigRef.current, eased * 0.1)
      }

      const config = currentConfigRef.current
      timeRef.current += config.noiseSpeed

      ctx.clearRect(0, 0, canvasSize, canvasSize)

      const audioInfluence = Math.min(smoothRms * 2.5 + smoothPeak * 1.2, 1.0)
      const minRadius = size * 0.28
      const maxRadius = size * 0.42
      const baseRadius = minRadius + (maxRadius - minRadius) * audioInfluence

      const t = timeRef.current

      // Transform vertices with mode-specific displacement
      const transformedVerts: { x: number; y: number; z: number; nx: number; ny: number; nz: number; displacement: number }[] = []

      for (const vert of sphere.vertices) {
        const nx = vert.nx, ny = vert.ny, nz = vert.nz

        // Mode-specific noise patterns
        const scale = config.noiseScale
        const noiseVal1 = noise.noise3D(nx * scale + t * 0.2, ny * scale + t * 0.15, nz * scale + t * 0.1) * 0.4
        const noiseVal2 = noise.noise3D(nx * scale * 2.5 + t * 0.3, ny * scale * 2.5 + t * 0.25, nz * scale * 2.5 + t * 0.2) * 0.2

        // Transistor mode gets extra high-frequency detail for sharpness
        let noiseVal3 = 0
        if (mode === 2) {
          noiseVal3 = noise.noise3D(nx * 8 + t * 0.6, ny * 8 + t * 0.5, nz * 8 + t * 0.4) * 0.15
        } else {
          noiseVal3 = noise.noise3D(nx * scale * 4 + t * 0.4, ny * scale * 4 + t * 0.35, nz * scale * 4 + t * 0.3) * 0.1
        }

        let displacement = noiseVal1 + noiseVal2 + noiseVal3

        // Audio reactivity with mode-specific spike amount
        const audioNoise = noise.noise3D(nx * 2 + t * 2, ny * 2 + t * 1.5, nz * 2 + t)
        displacement += audioInfluence * config.spikeAmount * (0.5 + audioNoise * 0.5)

        const displacementScale = 0.25 + audioInfluence * 0.25
        const vertScale = 1 + displacement * displacementScale
        const x = vert.x * vertScale
        const y = vert.y * vertScale
        const z = vert.z * vertScale

        transformedVerts.push({ x, y, z, nx, ny, nz, displacement })
      }

      // Collect and sort faces
      const facesToRender: { face: Face; depth: number }[] = []

      for (const face of sphere.faces) {
        const v0 = transformedVerts[face.v0]
        const v1 = transformedVerts[face.v1]
        const v2 = transformedVerts[face.v2]

        const cz = (v0.z + v1.z + v2.z) / 3
        const edge1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z }
        const edge2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z }
        const faceNormal = cross(edge1, edge2)

        if (faceNormal.z > 0) {
          facesToRender.push({ face, depth: cz })
        }
      }

      facesToRender.sort((a, b) => a.depth - b.depth)

      // Mode-specific colors - use config colors directly for clear distinction
      const glowColor1 = config.baseColor
      const glowColor2 = config.glowColor
      const glowColor3 = { r: config.glowColor.r * 0.7, g: config.glowColor.g * 0.7, b: config.glowColor.b * 0.7 }

      // Draw outer glow
      const glowIntensity = 0.15 + audioInfluence * config.glowIntensity
      const glowSize = baseRadius * 1.4
      const outerGlow = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.3, centerX, centerY, glowSize)
      outerGlow.addColorStop(0, `rgba(${glowColor1.r}, ${glowColor1.g}, ${glowColor1.b}, ${glowIntensity * 0.9})`)
      outerGlow.addColorStop(0.4, `rgba(${glowColor2.r}, ${glowColor2.g}, ${glowColor2.b}, ${glowIntensity * 0.4})`)
      outerGlow.addColorStop(0.7, `rgba(${glowColor3.r}, ${glowColor3.g}, ${glowColor3.b}, ${glowIntensity * 0.15})`)
      outerGlow.addColorStop(1, `rgba(${glowColor3.r}, ${glowColor3.g}, ${glowColor3.b}, 0)`)
      ctx.fillStyle = outerGlow
      ctx.beginPath()
      ctx.arc(centerX, centerY, glowSize, 0, Math.PI * 2)
      ctx.fill()

      // Render faces with mode-specific coloring
      for (const { face } of facesToRender) {
        const v0 = transformedVerts[face.v0]
        const v1 = transformedVerts[face.v1]
        const v2 = transformedVerts[face.v2]

        const project = (v: typeof v0) => ({
          x: centerX + v.x * baseRadius,
          y: centerY + v.y * baseRadius
        })

        const p0 = project(v0)
        const p1 = project(v1)
        const p2 = project(v2)

        const edge1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z }
        const edge2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z }
        const faceNormal = normalize(cross(edge1, edge2))

        const diffuse = Math.max(0, dot(faceNormal, lightDir))
        const viewDir = { x: 0, y: 0, z: 1 }
        const halfDir = normalize({
          x: lightDir.x + viewDir.x,
          y: lightDir.y + viewDir.y,
          z: lightDir.z + viewDir.z
        })
        const specular = Math.pow(Math.max(0, dot(faceNormal, halfDir)), config.specularPower)

        const avgDisp = (v0.displacement + v1.displacement + v2.displacement) / 3
        const heat = 0.5 + avgDisp * 0.8 + audioInfluence * 0.3

        // Use config base color directly for clear mode distinction
        const brightness = 0.3 + heat * 0.4 + diffuse * 0.3
        const faceColor = {
          r: Math.floor(config.baseColor.r * brightness),
          g: Math.floor(config.baseColor.g * brightness),
          b: Math.floor(config.baseColor.b * brightness)
        }

        const r = Math.min(255, faceColor.r + specular * 200)
        const g = Math.min(255, faceColor.g + specular * 150)
        const b = Math.min(255, faceColor.b + specular * 100)

        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.lineTo(p2.x, p2.y)
        ctx.closePath()
        ctx.fillStyle = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`
        ctx.fill()
      }

      // Specular highlight
      const highlightX = centerX - baseRadius * 0.25
      const highlightY = centerY - baseRadius * 0.25
      const highlightGradient = ctx.createRadialGradient(highlightX, highlightY, 0, highlightX, highlightY, baseRadius * 0.5)
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)')
      highlightGradient.addColorStop(0.3, 'rgba(255, 240, 220, 0.15)')
      highlightGradient.addColorStop(1, 'rgba(255, 220, 200, 0)')
      ctx.fillStyle = highlightGradient
      ctx.beginPath()
      ctx.arc(highlightX, highlightY, baseRadius * 0.5, 0, Math.PI * 2)
      ctx.fill()

      // Core glow with mode colors
      const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * (0.4 + audioInfluence * 0.2))
      const coreIntensity = 0.15 + audioInfluence * 0.4
      const coreColor = config.baseColor
      coreGlow.addColorStop(0, `rgba(${coreColor.r}, ${coreColor.g}, ${coreColor.b}, ${coreIntensity})`)
      coreGlow.addColorStop(0.4, `rgba(${glowColor1.r}, ${glowColor1.g}, ${glowColor1.b}, ${coreIntensity * 0.5})`)
      coreGlow.addColorStop(1, `rgba(${glowColor2.r}, ${glowColor2.g}, ${glowColor2.b}, 0)`)

      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = coreGlow
      ctx.beginPath()
      ctx.arc(centerX, centerY, baseRadius * (0.4 + audioInfluence * 0.2), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'

      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [size, smoothRms, smoothPeak])

  return (
    <div className="ferrofluid-container" style={{ width: size, height: size }}>
      <canvas ref={canvasRef} className="ferrofluid-canvas" />
    </div>
  )
}

// Vector math helpers
function dot(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }
}

function normalize(v: { x: number; y: number; z: number }) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

// Create icosphere
function createIcosphere(subdivisions: number): { vertices: Vertex[]; faces: Face[] } {
  const t = (1 + Math.sqrt(5)) / 2

  const baseVerts = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
  ].map(([x, y, z]) => {
    const len = Math.sqrt(x * x + y * y + z * z)
    return { x: x / len, y: y / len, z: z / len }
  })

  let faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
  ]

  const vertices = [...baseVerts]
  const midpointCache = new Map<string, number>()

  const getMidpoint = (i1: number, i2: number) => {
    const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`
    if (midpointCache.has(key)) return midpointCache.get(key)!

    const v1 = vertices[i1], v2 = vertices[i2]
    const mid = {
      x: (v1.x + v2.x) / 2,
      y: (v1.y + v2.y) / 2,
      z: (v1.z + v2.z) / 2
    }
    const len = Math.sqrt(mid.x * mid.x + mid.y * mid.y + mid.z * mid.z)
    mid.x /= len; mid.y /= len; mid.z /= len

    const idx = vertices.length
    vertices.push(mid)
    midpointCache.set(key, idx)
    return idx
  }

  for (let i = 0; i < subdivisions; i++) {
    const newFaces: [number, number, number][] = []
    for (const [v0, v1, v2] of faces) {
      const a = getMidpoint(v0, v1)
      const b = getMidpoint(v1, v2)
      const c = getMidpoint(v2, v0)
      newFaces.push([v0, a, c], [v1, b, a], [v2, c, b], [a, b, c])
    }
    faces = newFaces
  }

  return {
    vertices: vertices.map(v => ({ x: v.x, y: v.y, z: v.z, nx: v.x, ny: v.y, nz: v.z, u: 0, v: 0 })),
    faces: faces.map(([v0, v1, v2]) => ({ v0, v1, v2 }))
  }
}
