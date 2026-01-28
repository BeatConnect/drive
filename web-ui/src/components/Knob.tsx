import React, { useRef, useCallback, useState } from 'react'
import { useSliderParam } from '../hooks/useJuceParam'

interface KnobProps {
  paramId: string
  label: string
  size?: number
  color?: string
}

export function Knob({ paramId, label, size = 80, color = '#ff6b35' }: KnobProps) {
  const { value, min, max, setScaledValue, dragStart, dragEnd } = useSliderParam(paramId)
  const knobRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef(0)
  const dragStartValue = useRef(0)

  const normalizedValue = (value - min) / (max - min)
  const rotation = -135 + normalizedValue * 270 // -135 to +135 degrees

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartY.current = e.clientY
    dragStartValue.current = value
    dragStart()

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = dragStartY.current - moveEvent.clientY
      const sensitivity = (max - min) / 200
      const newValue = Math.max(min, Math.min(max, dragStartValue.current + deltaY * sensitivity))
      setScaledValue(newValue)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragEnd()
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [value, min, max, setScaledValue, dragStart, dragEnd])

  // Format display value
  const displayValue = Math.round(value * 10) / 10

  return (
    <div className="knob-container" style={{ width: size, height: size + 30 }}>
      <div
        ref={knobRef}
        className={`knob ${isDragging ? 'dragging' : ''}`}
        style={{
          width: size,
          height: size,
          '--knob-color': color,
          '--rotation': `${rotation}deg`,
        } as React.CSSProperties}
        onMouseDown={handleMouseDown}
      >
        {/* Outer ring with glow */}
        <div className="knob-ring" />

        {/* Value arc */}
        <svg className="knob-arc" viewBox="0 0 100 100">
          <circle
            className="knob-arc-track"
            cx="50"
            cy="50"
            r="42"
            strokeDasharray={`${normalizedValue * 188.5} 264`}
            transform="rotate(-135 50 50)"
          />
        </svg>

        {/* Knob body */}
        <div className="knob-body">
          <div className="knob-indicator" />
        </div>
      </div>

      {/* Label */}
      <div className="knob-label">{label}</div>
      <div className="knob-value">{displayValue}</div>
    </div>
  )
}
