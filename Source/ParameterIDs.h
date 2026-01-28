#pragma once

namespace ParameterIDs
{
    // Main processing parameters
    inline constexpr const char* drive    = "drive";     // Saturation/distortion amount
    inline constexpr const char* pressure = "pressure";  // Compression amount
    inline constexpr const char* tone     = "tone";      // High/low balance
    inline constexpr const char* mix      = "mix";       // Dry/wet blend
    inline constexpr const char* output   = "output";    // Output level

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
    }
}
