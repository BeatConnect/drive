/**
 * JUCE 8 Relay Bridge
 * Provides TypeScript interfaces for JUCE's native WebSliderRelay system
 */

declare global {
  interface Window {
    __JUCE__?: {
      backend?: {
        addEventListener: (event: string, callback: (data: unknown) => void) => void
        removeEventListener: (event: string, callback: (data: unknown) => void) => void
        emitEvent: (event: string, data: unknown) => void
      }
      initialisationData?: {
        __juce__sliders?: Record<string, SliderState>
        __juce__toggles?: Record<string, ToggleState>
        __juce__comboBoxes?: Record<string, ComboBoxState>
      }
    }
  }
}

export interface SliderState {
  name: string
  scaledValue: number
  properties: {
    start: number
    end: number
    skew: number
    name: string
    label: string
    numSteps: number
    interval: number
    parameterIndex: number
  }
  valueChangedEvent: string
  propertiesChangedEvent: string
  gestureStartedEvent: string
  gestureEndedEvent: string
  setNormalisedValue: (value: number) => void
  setScaledValue: (value: number) => void
  sliderDragStarted: () => void
  sliderDragEnded: () => void
}

export interface ToggleState {
  name: string
  value: boolean
  properties: {
    name: string
    parameterIndex: number
  }
  valueChangedEvent: string
  setValue: (value: boolean) => void
}

export interface ComboBoxState {
  name: string
  value: number
  properties: {
    name: string
    parameterIndex: number
    choices: string[]
  }
  valueChangedEvent: string
  setValue: (value: number) => void
}

/**
 * Get a slider state by name from JUCE
 */
export function getSliderState(name: string): SliderState | null {
  const sliders = window.__JUCE__?.initialisationData?.__juce__sliders
  return sliders?.[name] ?? null
}

/**
 * Get a toggle state by name from JUCE
 */
export function getToggleState(name: string): ToggleState | null {
  const toggles = window.__JUCE__?.initialisationData?.__juce__toggles
  return toggles?.[name] ?? null
}

/**
 * Get a combo box state by name from JUCE
 */
export function getComboBoxState(name: string): ComboBoxState | null {
  const combos = window.__JUCE__?.initialisationData?.__juce__comboBoxes
  return combos?.[name] ?? null
}

/**
 * Add a custom event listener for events from JUCE
 */
export function addCustomEventListener(eventId: string, callback: (data: unknown) => void): () => void {
  const backend = window.__JUCE__?.backend
  if (!backend) {
    console.warn('JUCE backend not available')
    return () => {}
  }

  backend.addEventListener(eventId, callback)
  return () => backend.removeEventListener(eventId, callback)
}

/**
 * Emit an event to JUCE
 */
export function emitToJuce(eventId: string, data: unknown = {}): void {
  const backend = window.__JUCE__?.backend
  if (!backend) {
    console.warn('JUCE backend not available')
    return
  }
  backend.emitEvent(eventId, data)
}

/**
 * Check if running inside JUCE WebView
 */
export function isJuceEnvironment(): boolean {
  return typeof window.__JUCE__ !== 'undefined'
}
