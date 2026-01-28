#pragma once

namespace ParameterIDs
{
    // Main processing parameters
    inline constexpr const char* drive    = "drive";     // Saturation/distortion amount
    inline constexpr const char* pressure = "pressure";  // Compression amount
    inline constexpr const char* tone     = "tone";      // High/low balance
    inline constexpr const char* mix      = "mix";       // Dry/wet blend
    inline constexpr const char* output   = "output";    // Output level

    // New premium features
    inline constexpr const char* mode         = "mode";         // Saturation type: 0=Tube, 1=Tape, 2=Transistor
    inline constexpr const char* attack       = "attack";       // Transient attack
    inline constexpr const char* sustain      = "sustain";      // Transient sustain
    inline constexpr const char* sidechainHp  = "sidechainHp";  // Sidechain high-pass frequency
    inline constexpr const char* autoGain     = "autoGain";     // Auto gain compensation
    inline constexpr const char* stereoWidth  = "stereoWidth";  // Stereo width
    inline constexpr const char* bypass       = "bypass";       // Master bypass

    // Parameter ranges
    namespace Ranges
    {
        // Drive: 0-100%
        inline constexpr float driveMin = 0.0f;
        inline constexpr float driveMax = 100.0f;
        inline constexpr float driveDefault = 25.0f;

        // Pressure: 0-100%
        inline constexpr float pressureMin = 0.0f;
        inline constexpr float pressureMax = 100.0f;
        inline constexpr float pressureDefault = 30.0f;

        // Tone: -100 to +100 (negative = darker, positive = brighter)
        inline constexpr float toneMin = -100.0f;
        inline constexpr float toneMax = 100.0f;
        inline constexpr float toneDefault = 0.0f;

        // Mix: 0-100%
        inline constexpr float mixMin = 0.0f;
        inline constexpr float mixMax = 100.0f;
        inline constexpr float mixDefault = 100.0f;

        // Output: -24dB to +12dB
        inline constexpr float outputMin = -24.0f;
        inline constexpr float outputMax = 12.0f;
        inline constexpr float outputDefault = 0.0f;

        // Mode: 0=Tube, 1=Tape, 2=Transistor
        inline constexpr int modeDefault = 0;

        // Attack: -100 to +100 (negative = softer attack, positive = punchier)
        inline constexpr float attackMin = -100.0f;
        inline constexpr float attackMax = 100.0f;
        inline constexpr float attackDefault = 0.0f;

        // Sustain: -100 to +100 (negative = tighter, positive = longer)
        inline constexpr float sustainMin = -100.0f;
        inline constexpr float sustainMax = 100.0f;
        inline constexpr float sustainDefault = 0.0f;

        // Sidechain HP: 20-500 Hz
        inline constexpr float sidechainHpMin = 20.0f;
        inline constexpr float sidechainHpMax = 500.0f;
        inline constexpr float sidechainHpDefault = 20.0f;

        // Stereo Width: 0-200% (0=mono, 100=normal, 200=wide)
        inline constexpr float stereoWidthMin = 0.0f;
        inline constexpr float stereoWidthMax = 200.0f;
        inline constexpr float stereoWidthDefault = 100.0f;
    }
}
