import { useState, useEffect, useCallback, useRef } from 'react'
import { getSliderState, getToggleState, SliderState, ToggleState } from '../lib/juce-bridge'

/**
 * Hook for connecting to a JUCE slider parameter
 */
export function useSliderParam(name: string) {
  const [value, setValue] = useState(0)
  const [properties, setProperties] = useState<SliderState['properties'] | null>(null)
  const sliderRef = useRef<SliderState | null>(null)

  useEffect(() => {
    const slider = getSliderState(name)
    if (!slider) {
      console.warn(`Slider "${name}" not found in JUCE`)
      return
    }

    sliderRef.current = slider
    setValue(slider.scaledValue)
    setProperties(slider.properties)

    // Listen for value changes from JUCE
    const handleValueChange = () => {
      if (sliderRef.current) {
        setValue(sliderRef.current.scaledValue)
      }
    }

    const handlePropertiesChange = () => {
      if (sliderRef.current) {
        setProperties({ ...sliderRef.current.properties })
      }
    }

    window.__JUCE__?.backend?.addEventListener(slider.valueChangedEvent, handleValueChange)
    window.__JUCE__?.backend?.addEventListener(slider.propertiesChangedEvent, handlePropertiesChange)

    return () => {
      window.__JUCE__?.backend?.removeEventListener(slider.valueChangedEvent, handleValueChange)
      window.__JUCE__?.backend?.removeEventListener(slider.propertiesChangedEvent, handlePropertiesChange)
    }
  }, [name])

  const setScaledValue = useCallback((newValue: number) => {
    sliderRef.current?.setScaledValue(newValue)
  }, [])

  const setNormalisedValue = useCallback((newValue: number) => {
    sliderRef.current?.setNormalisedValue(newValue)
  }, [])

  const dragStart = useCallback(() => {
    sliderRef.current?.sliderDragStarted()
  }, [])

  const dragEnd = useCallback(() => {
    sliderRef.current?.sliderDragEnded()
  }, [])

  return {
    value,
    properties,
    setScaledValue,
    setNormalisedValue,
    dragStart,
    dragEnd,
    min: properties?.start ?? 0,
    max: properties?.end ?? 100,
    label: properties?.label ?? ''
  }
}

/**
 * Hook for connecting to a JUCE toggle parameter
 */
export function useToggleParam(name: string) {
  const [value, setValue] = useState(false)
  const toggleRef = useRef<ToggleState | null>(null)

  useEffect(() => {
    const toggle = getToggleState(name)
    if (!toggle) {
      console.warn(`Toggle "${name}" not found in JUCE`)
      return
    }

    toggleRef.current = toggle
    setValue(toggle.value)

    const handleValueChange = () => {
      if (toggleRef.current) {
        setValue(toggleRef.current.value)
      }
    }

    window.__JUCE__?.backend?.addEventListener(toggle.valueChangedEvent, handleValueChange)

    return () => {
      window.__JUCE__?.backend?.removeEventListener(toggle.valueChangedEvent, handleValueChange)
    }
  }, [name])

  const setToggleValue = useCallback((newValue: boolean) => {
    toggleRef.current?.setValue(newValue)
  }, [])

  const toggle = useCallback(() => {
    if (toggleRef.current) {
      toggleRef.current.setValue(!toggleRef.current.value)
    }
  }, [])

  return { value, setValue: setToggleValue, toggle }
}
