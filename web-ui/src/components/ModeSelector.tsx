import { useEffect } from 'react'
import { useComboParam } from '../hooks/useJuceParam'

interface ModeSelectorProps {
  paramId: string
  colors: string[]
  onModeChange?: (mode: number) => void
}

// Simple, clean tube icon - just the essential shape
const TubeIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    {/* Tube envelope - simple rounded rectangle */}
    <rect
      x="7"
      y="3"
      width="10"
      height="15"
      rx="5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity={active ? 1 : 0.5}
    />
    {/* Filament glow */}
    <ellipse
      cx="12"
      cy="13"
      rx="2.5"
      ry="2"
      fill={active ? "currentColor" : "none"}
      opacity={active ? 0.6 : 0.3}
    />
    {/* Base pins */}
    <line x1="9" y1="18" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5" opacity={0.6} />
    <line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" opacity={0.6} />
    <line x1="15" y1="18" x2="15" y2="21" stroke="currentColor" strokeWidth="1.5" opacity={0.6} />
  </svg>
)

// Simple tape reel icon
const TapeIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    {/* Left reel */}
    <circle cx="8" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.5} />
    <circle cx="8" cy="12" r="2" fill="currentColor" opacity={active ? 0.6 : 0.3} />
    {/* Right reel */}
    <circle cx="16" cy="12" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.5} />
    <circle cx="16" cy="12" r="2" fill="currentColor" opacity={active ? 0.6 : 0.3} />
    {/* Tape connecting reels */}
    <path
      d="M8 7 L16 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity={active ? 0.8 : 0.4}
    />
  </svg>
)

// Simple transistor/chip icon
const TransistorIcon = ({ active }: { active: boolean }) => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    {/* Chip body */}
    <rect
      x="6"
      y="6"
      width="12"
      height="12"
      rx="1"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      opacity={active ? 0.3 : 0.5}
    />
    {/* Pins */}
    <line x1="4" y1="9" x2="6" y2="9" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.5} />
    <line x1="4" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.5} />
    <line x1="4" y1="15" x2="6" y2="15" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.5} />
    <line x1="18" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.5} />
    <line x1="18" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.5} />
    <line x1="18" y1="15" x2="20" y2="15" stroke="currentColor" strokeWidth="1.5" opacity={active ? 1 : 0.5} />
    {/* Center dot when active */}
    {active && <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.8" />}
  </svg>
)

const icons = [TubeIcon, TapeIcon, TransistorIcon]
const labels = ['TUBE', 'TAPE', 'SOLID']

export function ModeSelector({ paramId, colors, onModeChange }: ModeSelectorProps) {
  const { index: modeIndex, setIndex } = useComboParam(paramId)

  // Notify parent when mode changes
  useEffect(() => {
    onModeChange?.(modeIndex)
  }, [modeIndex, onModeChange])

  const handleClick = (idx: number) => {
    setIndex(idx)
    onModeChange?.(idx)
  }

  return (
    <div className="mode-selector">
      {icons.map((Icon, idx) => (
        <button
          key={idx}
          className={`mode-button ${modeIndex === idx ? 'active' : ''}`}
          style={{
            '--mode-color': colors[idx],
          } as React.CSSProperties}
          onClick={() => handleClick(idx)}
        >
          <Icon active={modeIndex === idx} />
          <span className="mode-label">{labels[idx]}</span>
        </button>
      ))}
    </div>
  )
}
