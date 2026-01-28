import { useToggleParam } from '../hooks/useJuceParam'

interface ToggleSwitchProps {
  paramId: string
  label: string
  color: string
}

export function ToggleSwitch({ paramId, label, color }: ToggleSwitchProps) {
  const { value: isOn, toggle } = useToggleParam(paramId)

  // Arc-style toggle matching the knob aesthetic
  const size = 44
  const center = size / 2
  const radius = 18
  const strokeWidth = 3

  // Full arc background
  const startAngle = -135 * (Math.PI / 180)
  const endAngle = 135 * (Math.PI / 180)

  const polarToCartesian = (angle: number) => ({
    x: center + radius * Math.cos(angle - Math.PI / 2),
    y: center + radius * Math.sin(angle - Math.PI / 2)
  })

  const start = polarToCartesian(startAngle)
  const end = polarToCartesian(endAngle)

  const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 1 1 ${end.x} ${end.y}`

  return (
    <div
      className={`toggle-arc ${isOn ? 'on' : ''}`}
      onClick={toggle}
      style={{ '--toggle-color': color } as React.CSSProperties}
    >
      <svg width={size} height={size} className="toggle-arc-svg">
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Active arc - full when on */}
        {isOn && (
          <path
            d={bgPath}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          />
        )}
        {/* Center indicator */}
        <circle
          cx={center}
          cy={center}
          r={8}
          fill={isOn ? color : 'rgba(255,255,255,0.1)'}
          style={isOn ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined}
        />
        {/* Power icon */}
        <path
          d={`M ${center} ${center - 5} L ${center} ${center - 2}`}
          stroke={isOn ? '#000' : 'rgba(255,255,255,0.4)'}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <path
          d={`M ${center - 3} ${center - 3} A 4 4 0 1 0 ${center + 3} ${center - 3}`}
          fill="none"
          stroke={isOn ? '#000' : 'rgba(255,255,255,0.4)'}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </svg>
      <div className="toggle-arc-info">
        <span className="toggle-arc-state">{isOn ? 'ON' : 'OFF'}</span>
        <span className="toggle-arc-label">{label}</span>
      </div>
    </div>
  )
}
