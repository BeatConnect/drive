import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { addCustomEventListener } from '../lib/juce-bridge'

interface AudioData {
  rms: number
  peak: number
  envelope: number
  // Smoothed values for subtle UI effects
  smoothRms: number
  smoothPeak: number
}

const AudioContext = createContext<AudioData>({
  rms: 0,
  peak: 0,
  envelope: 0,
  smoothRms: 0,
  smoothPeak: 0
})

export function AudioProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AudioData>({
    rms: 0,
    peak: 0,
    envelope: 0,
    smoothRms: 0,
    smoothPeak: 0
  })

  useEffect(() => {
    let smoothRms = 0
    let smoothPeak = 0
    let debugCounter = 0

    const unsubscribe = addCustomEventListener('visualizerData', (eventData: unknown) => {
      const d = eventData as { rms: number; peak: number; envelope: number; debug_drive?: number; debug_mix?: number; debug_attack?: number; debug_sustain?: number }

      // Log APVTS parameter values every ~1 second (60 fps)
      if (++debugCounter >= 60) {
        debugCounter = 0
        console.log(`[APVTS DEBUG] drive=${d.debug_drive?.toFixed(1)}, mix=${d.debug_mix?.toFixed(1)}, attack=${d.debug_attack?.toFixed(1)}, sustain=${d.debug_sustain?.toFixed(1)}`)
      }

      // Accurate response - instant attack, natural release
      const attackSpeed = 1.0   // Instant attack - no smoothing on rise
      const releaseSpeed = 0.15 // Natural release - matches drum decay

      const targetRms = d.rms ?? 0
      const targetPeak = d.peak ?? 0

      // Attack fast, release slower
      if (targetRms > smoothRms) {
        smoothRms += (targetRms - smoothRms) * attackSpeed
      } else {
        smoothRms += (targetRms - smoothRms) * releaseSpeed
      }

      if (targetPeak > smoothPeak) {
        smoothPeak += (targetPeak - smoothPeak) * attackSpeed
      } else {
        smoothPeak += (targetPeak - smoothPeak) * releaseSpeed
      }

      setData({
        rms: d.rms ?? 0,
        peak: d.peak ?? 0,
        envelope: d.envelope ?? 0,
        smoothRms,
        smoothPeak
      })
    })

    return unsubscribe
  }, [])

  return (
    <AudioContext.Provider value={data}>
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  return useContext(AudioContext)
}
