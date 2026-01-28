import { useRef, useCallback, useState } from 'react'
import { useSliderParam } from '../hooks/useJuceParam'

interface HorizontalSliderProps {
  paramId: string
  label: string
  color?: string
  width?: number
  bipolar?: boolean
  unit?: string
  // Override range if JUCE doesn't provide it correctly
  displayMin?: number
  displayMax?: number
}

export function HorizontalSlider({
  paramId,
  label,
  color = '#888888',
  width = 200,
  bipolar = false,
  unit = '',
  displayMin = 0,
  displayMax = 100
}: HorizontalSliderProps) {
  const { value, setValue, dragStart, dragEnd } = useSliderParam(paramId)
  const sliderRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // value is already normalized (0-1) from the hook
  const normalizedValue = value

  // Calculate display value from normalized position using display range
  const displayNum = displayMin + normalizedValue * (displayMax - displayMin)

  // Format display value
  let displayValue: string
  if (bipolar) {
    const rounded = Math.round(displayNum)
    displayValue = rounded > 0 ? `+${rounded}` : `${rounded}`
  } else {
    displayValue = Math.round(displayNum).toString()
  }
  if (unit) displayValue += unit

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragStart()

    const rect = sliderRef.current?.getBoundingClientRect()
    if (!rect) return

    const updateValue = (clientX: number) => {
      const x = clientX - rect.left
      const newNormalized = Math.max(0, Math.min(1, x / rect.width))
      console.log(`[HorizontalSlider ${paramId}] updateValue, newNormalized: ${newNormalized}`)
      setValue(newNormalized)
    }

    updateValue(e.clientX)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateValue(moveEvent.clientX)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragEnd()
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [setValue, dragStart, dragEnd])

  // Double-click to reset to default (center for bipolar, 50% for unipolar)
  const handleDoubleClick = useCallback(() => {
    setValue(bipolar ? 0.5 : 0.5)
  }, [setValue, bipolar])

  return (
    <div
      className={`horizontal-slider ${isDragging ? 'dragging' : ''}`}
      style={{ '--slider-color': color, '--slider-width': `${width}px` } as React.CSSProperties}
    >
      <span className="horizontal-label">{label}</span>

      <div
        ref={sliderRef}
        className="horizontal-track-container"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Track background */}
        <div className="horizontal-track" />

        {/* Value fill */}
        <div
          className="horizontal-fill"
          style={{ width: `${normalizedValue * 100}%`, background: color }}
        />

        {/* Thumb */}
        <div
          className="horizontal-thumb"
          style={{ left: `${normalizedValue * 100}%`, borderColor: color }}
        >
          <div className="horizontal-thumb-inner" style={{ background: color }} />
        </div>
      </div>

      <span className="horizontal-value" style={{ color }}>{displayValue}</span>
    </div>
  )
}
