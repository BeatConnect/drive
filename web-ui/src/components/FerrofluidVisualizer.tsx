import React, { useRef, useEffect } from 'react'
import { useVisualizerData } from '../hooks/useVisualizerData'

interface FerrofluidVisualizerProps {
  size: number
}

/**
 * Ferrofluid-style visualizer using Canvas 2D
 * This creates a spiky, metallic blob that responds to audio
 *
 * For a full WebGPU implementation, this would be replaced with a compute shader
 * that simulates ferrofluid physics with magnetic field interactions
 */
export function FerrofluidVisualizer({ size }: FerrofluidVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { rms, peak, envelope } = useVisualizerData()
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)
  const spikesRef = useRef<{ angle: number; length: number; velocity: number }[]>([])

  // Initialize spikes
  useEffect(() => {
    const numSpikes = 32
    spikesRef.current = Array.from({ length: numSpikes }, (_, i) => ({
      angle: (i / numSpikes) * Math.PI * 2,
      length: 0.3 + Math.random() * 0.2,
      velocity: 0
    }))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.scale(dpr, dpr)

    const centerX = size / 2
    const centerY = size / 2
    const baseRadius = size * 0.25

    const render = () => {
      timeRef.current += 0.016

      // Clear with transparent
      ctx.clearRect(0, 0, size, size)

      // Update spikes based on audio
      const audioIntensity = Math.max(rms * 3, envelope * 2, peak)
      const targetLength = 0.3 + audioIntensity * 0.7

      spikesRef.current.forEach((spike, i) => {
        // Add some noise and variation
        const noise = Math.sin(timeRef.current * 3 + i * 0.5) * 0.1
        const target = targetLength + noise + (i % 3 === 0 ? audioIntensity * 0.3 : 0)

        // Spring physics
        const spring = 0.15
        const damping = 0.85
        spike.velocity += (target - spike.length) * spring
        spike.velocity *= damping
        spike.length += spike.velocity
      })

      // Draw glow layers
      for (let glow = 3; glow >= 0; glow--) {
        const glowRadius = baseRadius * (1 + glow * 0.15)
        const alpha = 0.1 - glow * 0.02

        ctx.beginPath()

        spikesRef.current.forEach((spike, i) => {
          const spikeLength = spike.length * (1 + glow * 0.1)
          const r = glowRadius * spikeLength
          const x = centerX + Math.cos(spike.angle) * r
          const y = centerY + Math.sin(spike.angle) * r

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            // Create smooth spikes with bezier curves
            const prevSpike = spikesRef.current[(i - 1 + spikesRef.current.length) % spikesRef.current.length]
            const midAngle = (prevSpike.angle + spike.angle) / 2
            const midR = glowRadius * (prevSpike.length + spike.length) / 2 * 0.7
            const midX = centerX + Math.cos(midAngle) * midR
            const midY = centerY + Math.sin(midAngle) * midR

            ctx.quadraticCurveTo(midX, midY, x, y)
          }
        })

        ctx.closePath()

        // Gradient fill
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, glowRadius * 1.5
        )

        if (glow > 0) {
          gradient.addColorStop(0, `rgba(255, 107, 53, ${alpha})`)
          gradient.addColorStop(0.5, `rgba(255, 60, 30, ${alpha * 0.5})`)
          gradient.addColorStop(1, `rgba(100, 20, 10, 0)`)
        } else {
          // Main body - metallic gradient
          gradient.addColorStop(0, '#ff8855')
          gradient.addColorStop(0.3, '#ff6b35')
          gradient.addColorStop(0.6, '#cc4420')
          gradient.addColorStop(0.8, '#661100')
          gradient.addColorStop(1, '#330808')
        }

        ctx.fillStyle = gradient
        ctx.fill()
      }

      // Add specular highlights
      const highlightAngle = -Math.PI / 4 + Math.sin(timeRef.current * 0.5) * 0.2
      const highlightX = centerX + Math.cos(highlightAngle) * baseRadius * 0.4
      const highlightY = centerY + Math.sin(highlightAngle) * baseRadius * 0.4

      const highlightGradient = ctx.createRadialGradient(
        highlightX, highlightY, 0,
        highlightX, highlightY, baseRadius * 0.3
      )
      highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)')
      highlightGradient.addColorStop(0.5, 'rgba(255, 200, 150, 0.1)')
      highlightGradient.addColorStop(1, 'rgba(255, 150, 100, 0)')

      ctx.fillStyle = highlightGradient
      ctx.beginPath()
      ctx.arc(highlightX, highlightY, baseRadius * 0.4, 0, Math.PI * 2)
      ctx.fill()

      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [size, rms, peak, envelope])

  return (
    <div className="ferrofluid-container" style={{ width: size, height: size }}>
      <canvas
        ref={canvasRef}
        className="ferrofluid-canvas"
        style={{ width: size, height: size }}
      />
    </div>
  )
}
