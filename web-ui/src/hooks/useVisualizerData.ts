import { useState, useEffect } from 'react'
import { addCustomEventListener } from '../lib/juce-bridge'

export interface VisualizerData {
  rms: number
  peak: number
  envelope: number
}

/**
 * Hook for receiving visualizer data from JUCE
 */
export function useVisualizerData(): VisualizerData {
  const [data, setData] = useState<VisualizerData>({
    rms: 0,
    peak: 0,
    envelope: 0
  })

  useEffect(() => {
    const unsubscribe = addCustomEventListener('visualizerData', (eventData: unknown) => {
      const d = eventData as VisualizerData
      setData({
        rms: d.rms ?? 0,
        peak: d.peak ?? 0,
        envelope: d.envelope ?? 0
      })
    })

    return unsubscribe
  }, [])

  return data
}
