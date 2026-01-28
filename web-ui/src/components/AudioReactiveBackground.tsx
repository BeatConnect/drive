import { useRef, useEffect } from 'react'
import { useAudio } from '../context/AudioContext'

interface AudioReactiveBackgroundProps {
  mode?: number
}

// Mode hue offsets: Tube=0 (orange), Tape=25 (gold), Solid=-20 (red)
const modeHueOffsets = [0, 25, -20]

export function AudioReactiveBackground({ mode = 0 }: AudioReactiveBackgroundProps) {
  const { smoothRms, smoothPeak } = useAudio()
  const currentHueRef = useRef(0)
  const targetHue = modeHueOffsets[mode] || 0

  // Smooth hue transition
  useEffect(() => {
    const interval = setInterval(() => {
      const diff = targetHue - currentHueRef.current
      if (Math.abs(diff) > 0.1) {
        currentHueRef.current += diff * 0.05
      }
    }, 16)
    return () => clearInterval(interval)
  }, [targetHue])

  // Calculate subtle reactive values
  const glowIntensity = 0.8 + smoothRms * 0.4
  const pulseScale = 1 + smoothPeak * 0.02
  const heatShift = currentHueRef.current + smoothRms * 10

  return (
    <>
      {/* Base dark gradient */}
      <div className="bg-base" />

      {/* Heat waves / energy streaks */}
      <div
        className="bg-scene"
        style={{ filter: `hue-rotate(${currentHueRef.current}deg)` }}
      />

      {/* Subtle noise texture */}
      <div className="bg-grit" />

      {/* Central glow - audio reactive */}
      <div
        className="bg-glow"
        style={{
          opacity: glowIntensity,
          transform: `scale(${pulseScale})`,
          filter: `hue-rotate(${heatShift}deg)`
        }}
      />

      {/* Pulsing ring around center - subtle audio reactive */}
      <div
        className="bg-pulse-ring"
        style={{
          opacity: 0.15 + smoothPeak * 0.25,
          transform: `translate(-50%, -50%) scale(${1 + smoothPeak * 0.1})`,
          filter: `hue-rotate(${currentHueRef.current}deg)`
        }}
      />

      {/* Corner accents that pulse subtly */}
      <div
        className="bg-corner-accent top-left"
        style={{
          opacity: 0.3 + smoothRms * 0.3,
          filter: `hue-rotate(${currentHueRef.current}deg)`
        }}
      />
      <div
        className="bg-corner-accent top-right"
        style={{
          opacity: 0.3 + smoothRms * 0.3,
          filter: `hue-rotate(${currentHueRef.current}deg)`
        }}
      />
      <div
        className="bg-corner-accent bottom-left"
        style={{
          opacity: 0.25 + smoothRms * 0.25,
          filter: `hue-rotate(${currentHueRef.current}deg)`
        }}
      />
      <div
        className="bg-corner-accent bottom-right"
        style={{
          opacity: 0.25 + smoothRms * 0.25,
          filter: `hue-rotate(${currentHueRef.current}deg)`
        }}
      />

      {/* Vignette */}
      <div className="bg-vignette" />

      {/* Subtle scan lines for texture */}
      <div className="bg-scanlines" />
    </>
  )
}
