import { useRef, useCallback, useState } from 'react'
import { useSliderParam } from '../hooks/useJuceParam'

interface VerticalArcSliderProps {
  paramId: string
  label: string
  color?: string
  side: 'left' | 'right'
  bipolar?: boolean
}

export function VerticalArcSlider({ paramId, label, color = '#ff6b35', side, bipolar = false }: VerticalArcSliderProps) {
  const { value, setValue, dragStart, dragEnd } = useSliderParam(paramId)
  const sliderRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  // value is already normalized (0-1) from the hook
  const normalizedValue = value

  // For bipolar, show as -100 to +100
  // For unipolar, show as 0 to 100
  let displayValue: string
  if (bipolar) {
    const scaledValue = Math.round((normalizedValue - 0.5) * 200)
    displayValue = scaledValue > 0 ? `+${scaledValue}` : `${scaledValue}`
  } else {
    displayValue = Math.round(normalizedValue * 100).toString()
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    dragStart()

    const rect = sliderRef.current?.getBoundingClientRect()
    if (!rect) return

    // Calculate value from Y position (inverted - top is high, bottom is low)
    const updateFromY = (clientY: number) => {
      const y = clientY - rect.top
      const newNormalized = Math.max(0, Math.min(1, 1 - (y / rect.height)))
      console.log(`[VerticalArcSlider ${paramId}] update, y: ${y}, newNormalized: ${newNormalized}`)
      setValue(newNormalized)
    }

    // Update immediately on click
    updateFromY(e.clientY)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromY(moveEvent.clientY)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragEnd()
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [setValue, dragStart, dragEnd, paramId])

  // Double-click to reset to default (center for bipolar, 50% for unipolar)
  const handleDoubleClick = useCallback(() => {
    setValue(bipolar ? 0.5 : 0.5)
  }, [setValue, bipolar])

  // SVG dimensions
  const height = 200
  const width = 80
  const padding = 16

  // Arc parameters - pronounced curve bowing outward
  const curveOffset = side === 'left' ? -35 : 35
  const startX = width / 2
  const endX = width / 2
  const startY = height - padding
  const endY = padding

  // Control point for quadratic curve - at the middle height, offset horizontally
  const cpX = width / 2 + curveOffset
  const cpY = height / 2

  // Calculate thumb position along curve using quadratic bezier formula
  const t = normalizedValue
  const thumbX = (1-t)*(1-t)*startX + 2*(1-t)*t*cpX + t*t*endX
  const thumbY = (1-t)*(1-t)*startY + 2*(1-t)*t*cpY + t*t*endY

  const trackPath = `M ${startX} ${startY} Q ${cpX} ${cpY} ${endX} ${endY}`

  return (
    <div
      ref={sliderRef}
      className={`arc-slider ${side} ${isDragging ? 'dragging' : ''}`}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <svg width={width} height={height} className="arc-svg">
        <defs>
          <linearGradient id={`fill-${paramId}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.9" />
          </linearGradient>
          <filter id={`glow-${paramId}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
        />

        {/* Value - use pathLength for consistent fill */}
        <path
          d={trackPath}
          fill="none"
          stroke={`url(#fill-${paramId})`}
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${normalizedValue * 100} 100`}
          filter={`url(#glow-${paramId})`}
        />

        {/* Thumb */}
        <circle
          cx={thumbX}
          cy={thumbY}
          r={isDragging ? 10 : 8}
          fill="#151520"
          stroke={color}
          strokeWidth="2"
        />
      </svg>

      <div className="arc-info">
        <span className="arc-value" style={{ color }}>{displayValue}</span>
        <span className="arc-label">{label}</span>
      </div>
    </div>
  )
}
