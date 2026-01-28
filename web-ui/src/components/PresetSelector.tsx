import { useState, useCallback, useRef, useEffect } from 'react'
import { getSliderState, getComboBoxState, getToggleState } from '../lib/juce-bridge'

interface Preset {
  name: string
  values: {
    drive: number
    pressure: number
    tone: number
    mix: number
    output: number
    mode: number
    attack: number
    sustain: number
    autoGain: boolean
  }
}

const PRESETS: Preset[] = [
  {
    name: 'Init',
    values: { drive: 0, pressure: 0, tone: 0, mix: 100, output: 0, mode: 0, attack: 0, sustain: 0, autoGain: false }
  },
  {
    name: 'Clean Punch',
    values: { drive: 20, pressure: 30, tone: 10, mix: 80, output: 0, mode: 0, attack: 40, sustain: -20, autoGain: true }
  },
  {
    name: 'Warm Tape',
    values: { drive: 35, pressure: 40, tone: -15, mix: 70, output: 0, mode: 1, attack: 0, sustain: 20, autoGain: true }
  },
  {
    name: 'Tube Grit',
    values: { drive: 55, pressure: 25, tone: 5, mix: 85, output: -2, mode: 0, attack: 20, sustain: 0, autoGain: true }
  },
  {
    name: 'Transistor Crunch',
    values: { drive: 60, pressure: 35, tone: 20, mix: 75, output: -3, mode: 2, attack: 30, sustain: -10, autoGain: true }
  },
  {
    name: 'Fat Kick',
    values: { drive: 40, pressure: 50, tone: -25, mix: 90, output: 0, mode: 0, attack: -30, sustain: 40, autoGain: true }
  },
  {
    name: 'Snappy Snare',
    values: { drive: 30, pressure: 20, tone: 15, mix: 85, output: 0, mode: 2, attack: 60, sustain: -30, autoGain: true }
  },
  {
    name: 'Room Glue',
    values: { drive: 25, pressure: 70, tone: -10, mix: 60, output: 2, mode: 1, attack: -20, sustain: 50, autoGain: true }
  },
  {
    name: 'Vintage Warmth',
    values: { drive: 45, pressure: 45, tone: -20, mix: 75, output: 0, mode: 1, attack: 10, sustain: 30, autoGain: true }
  },
  {
    name: 'Modern Smack',
    values: { drive: 50, pressure: 30, tone: 25, mix: 90, output: -1, mode: 2, attack: 70, sustain: -40, autoGain: false }
  },
  {
    name: 'Full Send',
    values: { drive: 85, pressure: 60, tone: 10, mix: 100, output: -4, mode: 0, attack: 50, sustain: 20, autoGain: true }
  }
]

export function PresetSelector() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentPreset, setCurrentPreset] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const applyPreset = useCallback((index: number) => {
    const preset = PRESETS[index]
    if (!preset) return

    const { values } = preset

    // Apply all parameter values
    // Sliders expect normalized 0-1 values, need to convert from display values

    // Drive: 0-100 -> 0-1
    getSliderState('drive').setNormalisedValue(values.drive / 100)

    // Pressure: 0-100 -> 0-1
    getSliderState('pressure').setNormalisedValue(values.pressure / 100)

    // Tone: -100 to +100 -> 0-1 (bipolar, 0 = 0.5)
    getSliderState('tone').setNormalisedValue((values.tone + 100) / 200)

    // Mix: 0-100 -> 0-1
    getSliderState('mix').setNormalisedValue(values.mix / 100)

    // Output: -24 to +12 dB -> 0-1
    getSliderState('output').setNormalisedValue((values.output + 24) / 36)

    // Mode: 0, 1, 2 -> setChoiceIndex
    getComboBoxState('mode').setChoiceIndex(values.mode)

    // Attack: -100 to +100 -> 0-1 (bipolar)
    getSliderState('attack').setNormalisedValue((values.attack + 100) / 200)

    // Sustain: -100 to +100 -> 0-1 (bipolar)
    getSliderState('sustain').setNormalisedValue((values.sustain + 100) / 200)

    // Auto Gain: boolean
    getToggleState('autoGain').setValue(values.autoGain)

    setCurrentPreset(index)
    setIsOpen(false)
  }, [])

  const handlePrev = useCallback(() => {
    const newIndex = currentPreset > 0 ? currentPreset - 1 : PRESETS.length - 1
    applyPreset(newIndex)
  }, [currentPreset, applyPreset])

  const handleNext = useCallback(() => {
    const newIndex = currentPreset < PRESETS.length - 1 ? currentPreset + 1 : 0
    applyPreset(newIndex)
  }, [currentPreset, applyPreset])

  return (
    <div className="preset-selector" ref={dropdownRef}>
      <button className="preset-nav prev" onClick={handlePrev}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <button className="preset-name" onClick={() => setIsOpen(!isOpen)}>
        {PRESETS[currentPreset]?.name || 'Init'}
      </button>

      <button className="preset-nav next" onClick={handleNext}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="preset-dropdown">
          {PRESETS.map((preset, index) => (
            <button
              key={preset.name}
              className={`preset-item ${index === currentPreset ? 'active' : ''}`}
              onClick={() => applyPreset(index)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
