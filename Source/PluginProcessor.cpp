#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "ParameterIDs.h"

DriveAudioProcessor::DriveAudioProcessor()
    : AudioProcessor(BusesProperties()
        .withInput("Input", juce::AudioChannelSet::stereo(), true)
        .withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      apvts(*this, nullptr, "Parameters", createParameterLayout())
{
    loadProjectData();

    // Initialize waveshaper with tube saturation (default mode)
    updateSaturationMode(0);
}

// Tube: warm, aggressive saturation with even harmonics
float DriveAudioProcessor::tubeSaturation(float x)
{
    // Much more aggressive tube saturation
    float shaped = std::tanh(x * 2.0f);
    // Add significant even harmonics
    shaped += 0.3f * x * x * (x > 0 ? 1.0f : -1.0f);
    return std::clamp(shaped, -1.0f, 1.0f);
}

// Tape: warm compression with obvious saturation
float DriveAudioProcessor::tapeSaturation(float x)
{
    // More aggressive tape saturation
    float shaped = x / (1.0f + std::abs(x * 0.5f));
    // Add warmth via soft clip
    shaped = std::tanh(shaped * 1.5f);
    return shaped;
}

// Transistor: hard, aggressive clipping
float DriveAudioProcessor::transistorSaturation(float x)
{
    // Very aggressive transistor distortion
    float driven = x * 2.0f;

    // Hard asymmetric clipping
    if (driven > 0.3f)
        driven = 0.3f + (driven - 0.3f) * 0.2f;
    if (driven < -0.5f)
        driven = -0.5f + (driven + 0.5f) * 0.1f;

    // Add harsh harmonics
    driven = std::tanh(driven * 3.0f);

    return std::clamp(driven, -1.0f, 1.0f);
}

void DriveAudioProcessor::updateSaturationMode(int mode)
{
    switch (mode)
    {
        case 0: // Tube
            waveshaper.functionToUse = tubeSaturation;
            break;
        case 1: // Tape
            waveshaper.functionToUse = tapeSaturation;
            break;
        case 2: // Transistor
            waveshaper.functionToUse = transistorSaturation;
            break;
        default:
            waveshaper.functionToUse = tubeSaturation;
            break;
    }
    lastMode = mode;
}

DriveAudioProcessor::~DriveAudioProcessor()
{
}

juce::AudioProcessorValueTreeState::ParameterLayout DriveAudioProcessor::createParameterLayout()
{
    using namespace ParameterIDs;
    using namespace ParameterIDs::Ranges;

    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

    // Main parameters
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { drive, 1 },
        "Drive",
        juce::NormalisableRange<float>(driveMin, driveMax, 0.1f),
        driveDefault,
        juce::AudioParameterFloatAttributes().withLabel("%")
    ));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { pressure, 1 },
        "Pressure",
        juce::NormalisableRange<float>(pressureMin, pressureMax, 0.1f),
        pressureDefault,
        juce::AudioParameterFloatAttributes().withLabel("%")
    ));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { tone, 1 },
        "Tone",
        juce::NormalisableRange<float>(toneMin, toneMax, 0.1f),
        toneDefault
    ));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { mix, 1 },
        "Mix",
        juce::NormalisableRange<float>(mixMin, mixMax, 0.1f),
        mixDefault,
        juce::AudioParameterFloatAttributes().withLabel("%")
    ));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { output, 1 },
        "Output",
        juce::NormalisableRange<float>(outputMin, outputMax, 0.1f),
        outputDefault,
        juce::AudioParameterFloatAttributes().withLabel("dB")
    ));

    // Saturation mode: Tube, Tape, Transistor
    params.push_back(std::make_unique<juce::AudioParameterChoice>(
        juce::ParameterID { mode, 1 },
        "Mode",
        juce::StringArray { "Tube", "Tape", "Transistor" },
        modeDefault
    ));

    // Transient shaping
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { attack, 1 },
        "Attack",
        juce::NormalisableRange<float>(attackMin, attackMax, 0.1f),
        attackDefault,
        juce::AudioParameterFloatAttributes().withLabel("%")
    ));

    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { sustain, 1 },
        "Sustain",
        juce::NormalisableRange<float>(sustainMin, sustainMax, 0.1f),
        sustainDefault,
        juce::AudioParameterFloatAttributes().withLabel("%")
    ));

    // Sidechain high-pass
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { sidechainHp, 1 },
        "SC HP",
        juce::NormalisableRange<float>(sidechainHpMin, sidechainHpMax, 1.0f, 0.5f),
        sidechainHpDefault,
        juce::AudioParameterFloatAttributes().withLabel("Hz")
    ));

    // Auto gain compensation
    params.push_back(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID { autoGain, 1 },
        "Auto Gain",
        false
    ));

    // Stereo width
    params.push_back(std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID { stereoWidth, 1 },
        "Width",
        juce::NormalisableRange<float>(stereoWidthMin, stereoWidthMax, 1.0f),
        stereoWidthDefault,
        juce::AudioParameterFloatAttributes().withLabel("%")
    ));

    // Bypass
    params.push_back(std::make_unique<juce::AudioParameterBool>(
        juce::ParameterID { bypass, 1 },
        "Bypass",
        false
    ));

    return { params.begin(), params.end() };
}

void DriveAudioProcessor::loadProjectData()
{
#if HAS_PROJECT_DATA
    int dataSize = 0;
    const char* data = ProjectData::getNamedResource("project_data_json", dataSize);

    if (data == nullptr || dataSize == 0)
    {
        DBG("No project_data.json found in binary data");
        return;
    }

    auto parsed = juce::JSON::parse(juce::String::fromUTF8(data, dataSize));
    if (parsed.isVoid())
    {
        DBG("Failed to parse project_data.json");
        return;
    }

    pluginId = parsed.getProperty("pluginId", "").toString();
    apiBaseUrl = parsed.getProperty("apiBaseUrl", "").toString();
    supabaseKey = parsed.getProperty("supabasePublishableKey", "").toString();
    buildFlags = parsed.getProperty("flags", juce::var());

    DBG("Loaded project data - pluginId: " + pluginId);

#if BEATCONNECT_ACTIVATION_ENABLED
    bool enableActivation = static_cast<bool>(buildFlags.getProperty("enableActivationKeys", false));

    if (enableActivation && pluginId.isNotEmpty())
    {
        beatconnect::ActivationConfig config;
        config.apiBaseUrl = apiBaseUrl.toStdString();
        config.pluginId = pluginId.toStdString();
        config.supabaseKey = supabaseKey.toStdString();
        config.validateOnStartup = true;
        config.revalidateIntervalSeconds = 86400; // Daily revalidation

        activation = beatconnect::Activation::create(config);
        DBG("Activation system configured");
    }
#endif
#endif
}

bool DriveAudioProcessor::hasActivationEnabled() const
{
#if HAS_PROJECT_DATA && BEATCONNECT_ACTIVATION_ENABLED
    return static_cast<bool>(buildFlags.getProperty("enableActivationKeys", false));
#else
    return false;
#endif
}

void DriveAudioProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    // Prepare with 2x headroom for variable buffer sizes
    juce::dsp::ProcessSpec spec;
    spec.sampleRate = sampleRate;
    spec.maximumBlockSize = static_cast<juce::uint32>(samplesPerBlock * 2);
    spec.numChannels = static_cast<juce::uint32>(getTotalNumOutputChannels());

    oversampling.initProcessing(spec.maximumBlockSize);
    waveshaper.prepare(spec);
    compressor.prepare(spec);
    toneFilterLow.prepare(spec);
    toneFilterHigh.prepare(spec);
    sidechainHpFilter.prepare(spec);
    outputGain.prepare(spec);

    // Configure sidechain HP filter
    sidechainHpFilter.setType(juce::dsp::StateVariableTPTFilterType::highpass);
    sidechainHpFilter.setCutoffFrequency(20.0f);

    // Configure compressor for drum "pressure"
    compressor.setThreshold(-20.0f);
    compressor.setRatio(4.0f);
    compressor.setAttack(5.0f);
    compressor.setRelease(100.0f);

    // Configure tone filters
    toneFilterLow.setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    toneFilterHigh.setType(juce::dsp::StateVariableTPTFilterType::highpass);

    // Sub filter for harmonic generation (isolate low frequencies)
    subFilter.prepare(spec);
    subFilter.setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    subFilter.setCutoffFrequency(80.0f);

    // Reset persistent state
    for (int i = 0; i < 2; ++i)
    {
        fastEnvelope[i] = 0.0f;
        slowEnvelope[i] = 0.0f;
        subOscPhase[i] = 0.0f;
        lastSubInput[i] = 0.0f;
        dcBlockerState[i] = 0.0f;
    }
    autoGainSmoothed = 1.0f;

    // Smoothing - initialize to current parameter values
    driveSmoothed.reset(sampleRate, 0.02);
    pressureSmoothed.reset(sampleRate, 0.02);
    toneSmoothed.reset(sampleRate, 0.02);
    mixSmoothed.reset(sampleRate, 0.02);

    // Set initial values from parameters
    driveSmoothed.setCurrentAndTargetValue(apvts.getRawParameterValue(ParameterIDs::drive)->load());
    pressureSmoothed.setCurrentAndTargetValue(apvts.getRawParameterValue(ParameterIDs::pressure)->load());
    toneSmoothed.setCurrentAndTargetValue(apvts.getRawParameterValue(ParameterIDs::tone)->load());
    mixSmoothed.setCurrentAndTargetValue(apvts.getRawParameterValue(ParameterIDs::mix)->load());

    // Envelope follower coefficient - SLOWER release to catch kick drums properly
    // Kicks have energy spread over ~50-100ms, so we need slower release
    envelopeCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * 0.12f)); // 120ms release

    DBG("prepareToPlay called - sampleRate: " + juce::String(sampleRate) + ", blockSize: " + juce::String(samplesPerBlock));
}

void DriveAudioProcessor::releaseResources()
{
    oversampling.reset();
}

bool DriveAudioProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const
{
    if (layouts.getMainOutputChannelSet() != juce::AudioChannelSet::mono()
        && layouts.getMainOutputChannelSet() != juce::AudioChannelSet::stereo())
        return false;

    if (layouts.getMainOutputChannelSet() != layouts.getMainInputChannelSet())
        return false;

    return true;
}

void DriveAudioProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    juce::ScopedNoDenormals noDenormals;

    const int numChannels = buffer.getNumChannels();
    const int numSamples = buffer.getNumSamples();
    const double sampleRate = getSampleRate();

    // Clear unused output channels
    for (int i = getTotalNumInputChannels(); i < getTotalNumOutputChannels(); ++i)
        buffer.clear(i, 0, numSamples);

    // =========================================================================
    // GET PARAMETERS
    // =========================================================================
    const float driveVal = apvts.getRawParameterValue(ParameterIDs::drive)->load();
    const float pressureVal = apvts.getRawParameterValue(ParameterIDs::pressure)->load();
    const float toneVal = apvts.getRawParameterValue(ParameterIDs::tone)->load();
    const float mixVal = apvts.getRawParameterValue(ParameterIDs::mix)->load();
    const float outputVal = apvts.getRawParameterValue(ParameterIDs::output)->load();
    const int modeVal = static_cast<int>(apvts.getRawParameterValue(ParameterIDs::mode)->load());
    const bool bypassVal = apvts.getRawParameterValue(ParameterIDs::bypass)->load() > 0.5f;
    const float attackVal = apvts.getRawParameterValue(ParameterIDs::attack)->load();
    const float sustainVal = apvts.getRawParameterValue(ParameterIDs::sustain)->load();
    const bool autoGainVal = apvts.getRawParameterValue(ParameterIDs::autoGain)->load() > 0.5f;
    const float stereoWidthVal = apvts.getRawParameterValue(ParameterIDs::stereoWidth)->load();

    // Store for UI
    currentMode.store(modeVal);
    bypassed.store(bypassVal);
    if (modeVal != lastMode) updateSaturationMode(modeVal);

    // =========================================================================
    // VISUALIZER DATA (pre-processing)
    // RMS captures low frequency energy better than peak
    // =========================================================================
    float inputRms = 0.0f;
    float peak = 0.0f;
    for (int ch = 0; ch < numChannels; ++ch)
    {
        inputRms += buffer.getRMSLevel(ch, 0, numSamples);
        peak = std::max(peak, buffer.getMagnitude(ch, 0, numSamples));
    }
    inputRms /= static_cast<float>(numChannels);
    currentRMS.store(inputRms);
    currentPeak.store(peak);

    // Envelope follower uses combination of RMS and peak for better low-end response
    // RMS * 2 to boost its contribution (low frequencies have more RMS than peak)
    const float combinedLevel = std::max(peak, inputRms * 2.5f);
    float env = envelopeFollower.load();
    env = std::max(env * envelopeCoeff, combinedLevel);
    envelopeFollower.store(env);

    if (bypassVal) return;

    // =========================================================================
    // STORE DRY SIGNAL
    // =========================================================================
    juce::AudioBuffer<float> dryBuffer;
    dryBuffer.makeCopyOf(buffer);

    // =========================================================================
    // NORMALIZE PARAMETERS
    // =========================================================================
    const float driveNorm = driveVal / 100.0f;           // 0-1
    const float pressureNorm = pressureVal / 100.0f;     // 0-1
    const float attackNorm = attackVal / 100.0f;         // -1 to +1
    const float sustainNorm = sustainVal / 100.0f;       // -1 to +1
    const float mixNorm = mixVal / 100.0f;               // 0-1

    // Envelope time constants (in samples)
    const float fastAttackCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * 0.001f));  // 1ms
    const float fastReleaseCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * 0.015f)); // 15ms
    const float slowAttackCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * 0.005f));  // 5ms
    const float slowReleaseCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * 0.150f)); // 150ms

    // =========================================================================
    // STAGE 1: TRANSIENT SHAPING (Attack & Sustain)
    // Clean implementation: separate transient and sustain processing
    // =========================================================================
    const bool doTransientShaping = std::abs(attackNorm) > 0.02f || std::abs(sustainNorm) > 0.02f;

    if (doTransientShaping)
    {
        for (int ch = 0; ch < std::min(numChannels, 2); ++ch)
        {
            auto* data = buffer.getWritePointer(ch);

            for (int i = 0; i < numSamples; ++i)
            {
                const float input = data[i];
                const float absVal = std::abs(input);

                // ENVELOPE DETECTION
                // Fast envelope: instant attack, ~10ms release (catches transients)
                if (absVal > fastEnvelope[ch])
                    fastEnvelope[ch] = absVal;
                else
                    fastEnvelope[ch] += (absVal - fastEnvelope[ch]) * 0.002f; // ~10ms at 44.1k

                // Slow envelope: ~5ms attack, ~100ms release (follows body)
                if (absVal > slowEnvelope[ch])
                    slowEnvelope[ch] += (absVal - slowEnvelope[ch]) * 0.01f; // ~5ms attack
                else
                    slowEnvelope[ch] += (absVal - slowEnvelope[ch]) * 0.0004f; // ~100ms release

                // TRANSIENT DETECTION
                // Transient = when fast envelope significantly exceeds slow
                const float envDiff = fastEnvelope[ch] - slowEnvelope[ch];
                const float transient = std::max(0.0f, envDiff) / (slowEnvelope[ch] + 0.001f);
                const float transientSmooth = std::clamp(transient, 0.0f, 1.0f);

                // GAIN CALCULATION
                float gain = 1.0f;

                // ATTACK control: affects the transient portion
                if (std::abs(attackNorm) > 0.02f)
                {
                    // Positive = boost transients, Negative = soften transients
                    const float attackGain = 1.0f + attackNorm * transientSmooth * 4.0f;
                    gain *= std::clamp(attackGain, 0.2f, 5.0f);
                }

                // SUSTAIN control: affects the body/tail (non-transient portion)
                if (std::abs(sustainNorm) > 0.02f)
                {
                    // Only apply sustain shaping when NOT in a transient
                    const float sustainRegion = 1.0f - transientSmooth;
                    // Positive = boost sustain, Negative = gate/tighten
                    const float sustainGain = 1.0f + sustainNorm * sustainRegion * 2.0f;
                    gain *= std::clamp(sustainGain, 0.3f, 3.0f);
                }

                data[i] = input * gain;
            }
        }
    }

    // =========================================================================
    // STAGE 2: SATURATION (Mode-dependent character)
    // Oversampled for clean harmonics
    // =========================================================================
    auto oversampledBlock = oversampling.processSamplesUp(juce::dsp::AudioBlock<float>(buffer));

    // Dynamic drive: base gain + envelope-following boost
    // This makes the saturation "breathe" with the drums
    const float baseDriveGain = 1.0f + driveNorm * 15.0f;

    for (size_t ch = 0; ch < oversampledBlock.getNumChannels(); ++ch)
    {
        auto* data = oversampledBlock.getChannelPointer(ch);
        const int chIdx = static_cast<int>(ch) % 2;

        for (size_t i = 0; i < oversampledBlock.getNumSamples(); ++i)
        {
            // Envelope-following drive: more saturation on loud parts
            const float envDrive = 1.0f + fastEnvelope[chIdx] * driveNorm * 10.0f;
            const float totalDrive = baseDriveGain * envDrive;

            float x = data[i] * totalDrive;
            float shaped = 0.0f;

            switch (modeVal)
            {
                case 0: // =================== TUBE ===================
                // Warm, fat, musical. Even harmonics dominant.
                // Asymmetric soft clipping, preserves low end punch
                {
                    // Asymmetric waveshaping (triode-like)
                    const float bias = 0.1f * driveNorm; // Slight DC bias adds even harmonics
                    float biased = x + bias;

                    // Soft clip with different curves for +/-
                    if (biased >= 0.0f)
                    {
                        // Positive: gentle saturation
                        shaped = biased / (1.0f + biased * 0.5f);
                        // Add 2nd harmonic warmth
                        shaped += 0.2f * driveNorm * biased * biased / (1.0f + biased * biased);
                    }
                    else
                    {
                        // Negative: slightly harder clip (tube grid conduction)
                        shaped = biased / (1.0f - biased * 0.7f);
                    }

                    // Final soft limit with warmth
                    shaped = std::tanh(shaped * 0.8f) * 1.1f;

                    // Remove DC from bias
                    shaped -= std::tanh(bias * 0.8f) * 0.3f;
                    break;
                }

                case 1: // =================== TAPE ===================
                // Glue, compression, warmth. Soft knee saturation.
                // Slight high frequency rolloff, "vintage" character
                {
                    // Tape-style soft saturation with built-in compression
                    const float headroom = 1.0f / (1.0f + driveNorm * 2.0f);

                    // Soft knee compression before saturation
                    float compressed;
                    const float threshold = 0.3f;
                    const float absX = std::abs(x);
                    if (absX < threshold)
                    {
                        compressed = x;
                    }
                    else
                    {
                        // Soft knee
                        const float over = absX - threshold;
                        const float ratio = 1.0f + driveNorm * 3.0f;
                        const float reduced = threshold + over / ratio;
                        compressed = (x > 0 ? reduced : -reduced);
                    }

                    // Tape saturation (smooth S-curve)
                    shaped = compressed / (1.0f + std::abs(compressed) * 0.4f);

                    // Hysteresis-like harmonic generation
                    shaped += 0.15f * driveNorm * std::sin(compressed * 2.0f) * std::exp(-std::abs(compressed));

                    // Subtle high frequency loss (tape head gap)
                    shaped = shaped * 0.85f + std::tanh(shaped * 1.5f) * 0.15f;
                    break;
                }

                case 2: // =================== SOLID (Transistor) ===================
                // Aggressive, gritty, harsh. Odd harmonics dominant.
                // Hard clipping, crossover distortion, "in your face"
                {
                    // Hard clipping with transistor character
                    float driven = x * (1.0f + driveNorm * 2.0f);

                    // Crossover distortion (transistor dead zone)
                    const float deadZone = 0.05f * (1.0f - driveNorm * 0.5f);
                    if (std::abs(driven) < deadZone)
                    {
                        driven *= 0.3f; // Reduced gain in dead zone
                    }

                    // Asymmetric hard clipping
                    const float posClip = 0.8f - driveNorm * 0.3f;
                    const float negClip = -0.6f + driveNorm * 0.2f;

                    if (driven > posClip)
                        driven = posClip + (driven - posClip) * 0.05f;
                    if (driven < negClip)
                        driven = negClip + (driven - negClip) * 0.03f;

                    // Add harsh odd harmonics
                    shaped = driven + 0.3f * driveNorm * driven * driven * driven;

                    // Hard limit
                    shaped = std::clamp(shaped, -1.2f, 1.2f);

                    // Final harsh character
                    shaped = shaped * 0.7f + std::tanh(shaped * 3.0f) * 0.3f;
                    break;
                }

                default:
                    shaped = std::tanh(x);
            }

            data[i] = std::clamp(shaped, -1.5f, 1.5f);
        }
    }

    juce::dsp::AudioBlock<float> outputBlock(buffer);
    oversampling.processSamplesDown(outputBlock);

    // Makeup gain (compensate for saturation level changes)
    const float satMakeup = 1.0f / (1.0f + driveNorm * 0.8f);
    buffer.applyGain(satMakeup);

    // =========================================================================
    // STAGE 3: PRESSURE (Parallel Compression)
    // NY-style: blend crushed signal with original for punch + sustain
    // =========================================================================
    if (pressureNorm > 0.01f)
    {
        // Make a copy for parallel compression
        juce::AudioBuffer<float> crushedBuffer;
        crushedBuffer.makeCopyOf(buffer);

        // Aggressive compression settings
        compressor.setThreshold(-30.0f - pressureNorm * 20.0f); // -30 to -50 dB
        compressor.setRatio(4.0f + pressureNorm * 16.0f);       // 4:1 to 20:1
        compressor.setAttack(0.5f + (1.0f - pressureNorm) * 5.0f); // Fast attack
        compressor.setRelease(50.0f + (1.0f - sustainNorm) * 150.0f); // Release affected by sustain

        juce::dsp::AudioBlock<float> crushedBlock(crushedBuffer);
        juce::dsp::ProcessContextReplacing<float> compContext(crushedBlock);
        compressor.process(compContext);

        // Makeup gain on crushed signal
        crushedBuffer.applyGain(1.0f + pressureNorm * 4.0f);

        // Blend: more pressure = more crushed signal
        const float crushMix = pressureNorm * 0.7f;
        const float cleanMix = 1.0f - crushMix * 0.3f;

        for (int ch = 0; ch < numChannels; ++ch)
        {
            auto* out = buffer.getWritePointer(ch);
            const auto* crushed = crushedBuffer.getReadPointer(ch);
            for (int i = 0; i < numSamples; ++i)
            {
                out[i] = out[i] * cleanMix + crushed[i] * crushMix;
            }
        }
    }

    // =========================================================================
    // STAGE 4: TONE (Frequency Shaping)
    // =========================================================================
    const float toneNorm = toneVal / 100.0f; // -1 to +1

    if (toneNorm < -0.05f)
    {
        // DARK: Low pass filter
        const float cutoff = 18000.0f * std::pow(10.0f, toneNorm * 1.5f); // Down to ~500Hz at -100
        toneFilterLow.setCutoffFrequency(std::max(300.0f, cutoff));
        juce::dsp::AudioBlock<float> block(buffer);
        juce::dsp::ProcessContextReplacing<float> ctx(block);
        toneFilterLow.process(ctx);
    }
    else if (toneNorm > 0.05f)
    {
        // BRIGHT: High frequency boost via parallel high-pass
        const float cutoff = 2000.0f + toneNorm * 4000.0f;
        toneFilterHigh.setCutoffFrequency(cutoff);

        juce::AudioBuffer<float> highBuffer;
        highBuffer.makeCopyOf(buffer);
        juce::dsp::AudioBlock<float> highBlock(highBuffer);
        juce::dsp::ProcessContextReplacing<float> ctx(highBlock);
        toneFilterHigh.process(ctx);

        // Add highs back with boost
        const float highBoost = toneNorm * 2.0f;
        for (int ch = 0; ch < numChannels; ++ch)
        {
            auto* out = buffer.getWritePointer(ch);
            const auto* high = highBuffer.getReadPointer(ch);
            for (int i = 0; i < numSamples; ++i)
            {
                out[i] += high[i] * highBoost;
            }
        }
    }

    // =========================================================================
    // STAGE 5: STEREO WIDTH
    // =========================================================================
    if (numChannels == 2 && std::abs(stereoWidthVal - 100.0f) > 1.0f)
    {
        const float widthNorm = stereoWidthVal / 100.0f;
        auto* left = buffer.getWritePointer(0);
        auto* right = buffer.getWritePointer(1);

        for (int i = 0; i < numSamples; ++i)
        {
            const float mid = (left[i] + right[i]) * 0.5f;
            const float side = (left[i] - right[i]) * 0.5f * widthNorm;
            left[i] = mid + side;
            right[i] = mid - side;
        }
    }

    // =========================================================================
    // STAGE 6: DRY/WET MIX
    // =========================================================================
    for (int ch = 0; ch < numChannels; ++ch)
    {
        auto* wet = buffer.getWritePointer(ch);
        const auto* dry = dryBuffer.getReadPointer(ch);
        for (int i = 0; i < numSamples; ++i)
        {
            wet[i] = wet[i] * mixNorm + dry[i] * (1.0f - mixNorm);
        }
    }

    // =========================================================================
    // STAGE 7: AUTO GAIN (Very smooth loudness matching)
    // Uses slow averaging to avoid pumping - just maintains overall level
    // =========================================================================
    if (autoGainVal)
    {
        float outputRms = 0.0f;
        for (int ch = 0; ch < numChannels; ++ch)
            outputRms += buffer.getRMSLevel(ch, 0, numSamples);
        outputRms /= static_cast<float>(numChannels);

        // Only update when we have meaningful signal
        if (inputRms > 0.001f && outputRms > 0.001f)
        {
            const float targetGain = inputRms / outputRms;
            // Tighter clamp range for subtler compensation
            const float clampedGain = std::clamp(targetGain, 0.5f, 2.0f);

            // VERY slow smoothing to avoid any pumping - just gradual level matching
            // This takes ~500ms to fully adjust, so it won't react to individual hits
            autoGainSmoothed += (clampedGain - autoGainSmoothed) * 0.01f;
        }

        // Always apply the smoothed gain (even during silence)
        buffer.applyGain(autoGainSmoothed);
    }

    // Output gain
    outputGain.setGainDecibels(outputVal);
    juce::dsp::AudioBlock<float> block(buffer);
    juce::dsp::ProcessContextReplacing<float> gainContext(block);
    outputGain.process(gainContext);
}

juce::AudioProcessorEditor* DriveAudioProcessor::createEditor()
{
    return new DriveAudioProcessorEditor(*this);
}

void DriveAudioProcessor::getStateInformation(juce::MemoryBlock& destData)
{
    auto state = apvts.copyState();

    // Add version for backwards compatibility
    state.setProperty("stateVersion", kStateVersion, nullptr);

    std::unique_ptr<juce::XmlElement> xml(state.createXml());
    copyXmlToBinary(*xml, destData);
}

void DriveAudioProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    std::unique_ptr<juce::XmlElement> xml(getXmlFromBinary(data, sizeInBytes));

    if (xml != nullptr && xml->hasTagName(apvts.state.getType()))
    {
        auto newState = juce::ValueTree::fromXml(*xml);

        // Check version and migrate if needed
        int version = newState.getProperty("stateVersion", 0);
        if (version < kStateVersion)
        {
            // Handle migration from older versions here
            DBG("Migrating state from version " + juce::String(version) + " to " + juce::String(kStateVersion));
        }

        apvts.replaceState(newState);
    }
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new DriveAudioProcessor();
}
