import { Knob } from './components/Knob'
import { FerrofluidVisualizer } from './components/FerrofluidVisualizer'

function App() {
  return (
    <div className="plugin-container">
      {/* Animated gradient background */}
      <div className="background-gradient" />

      {/* Decorative elements */}
      <div className="background-elements">
        <div className="grid-overlay" />
        <div className="noise-texture" />
        <div className="vignette" />
      </div>

      {/* Header */}
      <header className="plugin-header">
        <h1 className="plugin-title">DRIVE</h1>
        <span className="plugin-subtitle">DRUM ANALOG PROCESSOR</span>
      </header>

      {/* Main content - circular layout */}
      <main className="plugin-main">
        {/* Central visualizer */}
        <div className="visualizer-container">
          <FerrofluidVisualizer size={200} />
        </div>

        {/* Knobs arranged in a circle around the visualizer */}
        <div className="knobs-orbit">
          <div className="knob-position knob-top-left">
            <Knob paramId="drive" label="DRIVE" color="#ff6b35" />
          </div>

          <div className="knob-position knob-top-right">
            <Knob paramId="pressure" label="PRESSURE" color="#ff4444" />
          </div>

          <div className="knob-position knob-bottom-left">
            <Knob paramId="tone" label="TONE" color="#44aaff" />
          </div>

          <div className="knob-position knob-bottom-right">
            <Knob paramId="mix" label="MIX" color="#88ff88" />
          </div>
        </div>

        {/* Output control at bottom */}
        <div className="output-section">
          <Knob paramId="output" label="OUTPUT" size={60} color="#ffffff" />
        </div>
      </main>

      {/* Footer branding */}
      <footer className="plugin-footer">
        <span className="brand">BEATCONNECT</span>
      </footer>
    </div>
  )
}

export default App
