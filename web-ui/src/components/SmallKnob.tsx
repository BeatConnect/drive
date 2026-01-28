import { useState, useEffect, useRef, useCallback } from 'react'
import { useSliderParam } from '../hooks/useJuceParam'

interface SmallKnobProps {
  paramId: string
  label: string
  color: string
  min?: number
  max?: number
  defaultValue?: number
  bipolar?: boolean
}

export function SmallKnob({
  paramId,
  label,
  color,
  min: displayMin = 0,
  max: displayMax = 100,
  defaultValue = 50,
  bipolar = false
}: SmallKnobProps) {
  const { value, setValue, dragStart, dragEnd } = useSliderParam(paramId)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartValue = useRef(0)

  // value is already normalized (0-1) from the hook
  const normalizedValue = value

  // Calculate display value from normalized position
  const displayValue = displayMin + normalizedValue * (displayMax - displayMin)

  const updateValue = useCallback((newDisplayValue: number) => {
    const clampedDisplay = Math.max(displayMin, Math.min(displayMax, newDisplayValue))
    const newNormalized = (clampedDisplay - displayMin) / (displayMax - displayMin)
    setValue(newNormalized)
  }, [displayMin, displayMax, setValue])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartValue.current = displayValue
    dragStart()
  }

  const handleDoubleClick = () => {
    updateValue(defaultValue)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY.current - e.clientY
      const range = displayMax - displayMin
      const sensitivity = range / 150
      const newValue = dragStartValue.current + deltaY * sensitivity
      updateValue(newValue)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragEnd()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, displayMin, displayMax, updateValue, dragEnd])

  // Format display value
  const formattedValue = bipolar
    ? (displayValue > 0 ? `+${Math.round(displayValue)}` : Math.round(displayValue).toString())
    : Math.round(displayValue).toString()

  // Arc calculation - matches the main slider style
  const size = 48
  const center = size / 2
  const radius = 20
  const strokeWidth = 3

  const startAngle = -135 * (Math.PI / 180)
  const endAngle = 135 * (Math.PI / 180)
  const totalAngle = endAngle - startAngle

  const polarToCartesian = (angle: number) => ({
    x: center + radius * Math.cos(angle - Math.PI / 2),
    y: center + radius * Math.sin(angle - Math.PI / 2)
  })

  const start = polarToCartesian(startAngle)
  const end = polarToCartesian(endAngle)
  const valueEnd = polarToCartesian(startAngle + normalizedValue * totalAngle)

  const largeArc = totalAngle > Math.PI ? 1 : 0
  const valueLargeArc = (normalizedValue * totalAngle) > Math.PI ? 1 : 0

  const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`
  const valuePath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${valueLargeArc} 1 ${valueEnd.x} ${valueEnd.y}`

  return (
    <div
      className={`small-knob ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <svg width={size} height={size} className="small-knob-arc">
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        {normalizedValue > 0.005 && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        )}
        {/* Center dot indicator */}
        <circle
          cx={valueEnd.x}
          cy={valueEnd.y}
          r={4}
          fill={color}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      </svg>
      <span className="small-knob-value">{formattedValue}</span>
      <span className="small-knob-label">{label}</span>
    </div>
  )
}
