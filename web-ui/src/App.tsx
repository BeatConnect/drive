import { useState, useCallback } from 'react'
import { VerticalArcSlider } from './components/VerticalArcSlider'
import { HorizontalSlider } from './components/HorizontalSlider'
import { FerrofluidVisualizer } from './components/FerrofluidVisualizer'
import { AudioReactiveBackground } from './components/AudioReactiveBackground'
import { ModeSelector } from './components/ModeSelector'
import { SmallKnob } from './components/SmallKnob'
import { ToggleSwitch } from './components/ToggleSwitch'
import { PresetSelector } from './components/PresetSelector'
import { ActivationScreen } from './components/ActivationScreen'
import { AudioProvider } from './context/AudioContext'
import { useToggleParam } from './hooks/useJuceParam'

function PluginUI() {
  const { value: isBypassed, toggle: toggleBypass } = useToggleParam('bypass')
  const [currentMode, setCurrentMode] = useState(0)

  const handleModeChange = useCallback((mode: number) => {
    setCurrentMode(mode)
  }, [])

  // Mode hue offsets for UI shift: Tube=0, Tape=25 (warmer/gold), Solid=-20 (cooler/red)
  const modeHueOffsets = [0, 25, -20]
  const currentHue = modeHueOffsets[currentMode] || 0

  return (
    <div
      className="plugin-container"
      style={{ '--mode-hue': `${currentHue}deg` } as React.CSSProperties}
    >
      {/* Audio-reactive background layers */}
      <AudioReactiveBackground mode={currentMode} />

      {/* Header */}
      <header className="plugin-header">
        <h1
          className={`plugin-title clickable ${isBypassed ? 'bypassed' : ''}`}
          onClick={toggleBypass}
        >
          DRIVE
        </h1>
        <div className="title-underline" />
      </header>

      {/* Main content */}
      <main className="plugin-main">
        {/* Left sliders */}
        <div className="slider-column left">
          <VerticalArcSlider paramId="drive" label="DRIVE" color="#ff5522" side="left" />
          <VerticalArcSlider paramId="tone" label="TONE" color="#ff7744" side="left" bipolar />
        </div>

        {/* Central visualizer */}
        <div className="visualizer-section">
          <FerrofluidVisualizer
            size={240}
            mode={currentMode}
          />
        </div>

        {/* Right sliders */}
        <div className="slider-column right">
          <VerticalArcSlider paramId="pressure" label="PRESSURE" color="#ff3333" side="right" />
          <VerticalArcSlider paramId="mix" label="MIX" color="#ff6644" side="right" />
        </div>
      </main>

      {/* Preset selector - top left */}
      <div className="preset-container">
        <PresetSelector />
      </div>

      {/* Footer with controls */}
      <footer className="plugin-footer">
        <ModeSelector
          paramId="mode"
          colors={['#ff6030', '#ffaa50', '#ff4040']}
          onModeChange={handleModeChange}
        />

        <div className="footer-divider" />

        <SmallKnob
          paramId="attack"
          label="ATTACK"
          color="#ff6644"
          min={-100}
          max={100}
          defaultValue={0}
          bipolar
        />
        <SmallKnob
          paramId="sustain"
          label="SUSTAIN"
          color="#ff6644"
          min={-100}
          max={100}
          defaultValue={0}
          bipolar
        />

        <div className="footer-divider" />

        <HorizontalSlider paramId="output" label="OUTPUT" color="#aa8877" width={240} bipolar unit="dB" displayMin={-24} displayMax={12} />

        <ToggleSwitch paramId="autoGain" label="AUTO GAIN" color="#ff5522" />
      </footer>
    </div>
  )
}

function AppContent() {
  const [isActivated, setIsActivated] = useState(false)

  const handleActivated = useCallback(() => {
    setIsActivated(true)
  }, [])

  if (!isActivated) {
    return <ActivationScreen onActivated={handleActivated} />
  }

  return <PluginUI />
}

function App() {
  return (
    <AudioProvider>
      <AppContent />
    </AudioProvider>
  )
}

export default App
