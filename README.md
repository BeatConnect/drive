# DRIVE

**Drum Analog Processor** - Saturation, distortion, and pressure in one plugin.

![DRIVE Plugin](docs/screenshot.png)

## Features

- **DRIVE** - Analog-style saturation with oversampling for clean harmonics
- **PRESSURE** - Musical compression that adds weight and punch
- **TONE** - Shape the high/low balance
- **MIX** - Blend wet/dry for parallel processing
- **OUTPUT** - Final level control

## Building

### Prerequisites

- CMake 3.22+
- JUCE 8.0+
- C++20 compiler
- Node.js 18+ (for web UI)

### Development Build

```bash
# Clone with submodules
git clone --recursive https://github.com/BeatConnect/drive.git
cd drive

# Build web UI
cd web-ui
npm install
npm run dev  # Start dev server for hot reload

# In another terminal - build plugin in dev mode
cmake -B build -DJUCE_PATH=/path/to/JUCE -DDRIVE_DEV_MODE=ON
cmake --build build
```

### Production Build

```bash
# Build web UI
cd web-ui
npm ci
npm run build
cd ..

# Build plugin
cmake -B build -DJUCE_PATH=/path/to/JUCE -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release
```

## Architecture

- **C++ (JUCE 8)** - Audio processing with oversampled waveshaping and compression
- **React/TypeScript** - WebView-based UI with ferrofluid visualizer
- **JUCE 8 Relay System** - Native parameter sync between C++ and web UI

## License

Copyright © 2024 BeatConnect. All rights reserved.
