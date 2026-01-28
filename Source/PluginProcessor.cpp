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

    // Initialize waveshaper with soft saturation curve
    waveshaper.functionToUse = [](float x) {
        // Soft clip with asymmetric saturation for analog character
        return std::tanh(x) * (1.0f + 0.1f * x * x);
    };
}

DriveAudioProcessor::~DriveAudioProcessor()
{
}

juce::AudioProcessorValueTreeState::ParameterLayout DriveAudioProcessor::createParameterLayout()
{
    using namespace ParameterIDs;
    using namespace ParameterIDs::Ranges;

    std::vector<std::unique_ptr<juce::RangedAudioParameter>> params;

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
    outputGain.prepare(spec);

    // Configure compressor for drum "pressure"
    compressor.setThreshold(-20.0f);
    compressor.setRatio(4.0f);
    compressor.setAttack(5.0f);
    compressor.setRelease(100.0f);

    // Configure tone filters
    toneFilterLow.setType(juce::dsp::StateVariableTPTFilterType::lowpass);
    toneFilterHigh.setType(juce::dsp::StateVariableTPTFilterType::highpass);

    // Smoothing
    driveSmoothed.reset(sampleRate, 0.02);
    pressureSmoothed.reset(sampleRate, 0.02);
    toneSmoothed.reset(sampleRate, 0.02);
    mixSmoothed.reset(sampleRate, 0.02);

    // Envelope follower coefficient (fast attack, medium release)
    envelopeCoeff = std::exp(-1.0f / (static_cast<float>(sampleRate) * 0.05f));
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

    auto totalNumInputChannels = getTotalNumInputChannels();
    auto totalNumOutputChannels = getTotalNumOutputChannels();

    // Clear unused channels
    for (auto i = totalNumInputChannels; i < totalNumOutputChannels; ++i)
        buffer.clear(i, 0, buffer.getNumSamples());

    // Get parameter values
    const float driveVal = apvts.getRawParameterValue(ParameterIDs::drive)->load();
    const float pressureVal = apvts.getRawParameterValue(ParameterIDs::pressure)->load();
    const float toneVal = apvts.getRawParameterValue(ParameterIDs::tone)->load();
    const float mixVal = apvts.getRawParameterValue(ParameterIDs::mix)->load();
    const float outputVal = apvts.getRawParameterValue(ParameterIDs::output)->load();

    driveSmoothed.setTargetValue(driveVal);
    pressureSmoothed.setTargetValue(pressureVal);
    toneSmoothed.setTargetValue(toneVal);
    mixSmoothed.setTargetValue(mixVal);

    // Store dry signal for mix
    juce::AudioBuffer<float> dryBuffer;
    dryBuffer.makeCopyOf(buffer);

    // Calculate visualizer data before processing
    float rms = 0.0f;
    float peak = 0.0f;
    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        rms += buffer.getRMSLevel(channel, 0, buffer.getNumSamples());
        peak = std::max(peak, buffer.getMagnitude(channel, 0, buffer.getNumSamples()));
    }
    rms /= static_cast<float>(buffer.getNumChannels());

    currentRMS.store(rms);
    currentPeak.store(peak);

    // Envelope follower for visualizer
    float env = envelopeFollower.load();
    env = std::max(env * envelopeCoeff, peak);
    envelopeFollower.store(env);

    // Oversample for cleaner saturation
    auto oversampledBlock = oversampling.processSamplesUp(juce::dsp::AudioBlock<float>(buffer));

    // Apply drive (saturation)
    const float driveAmount = driveSmoothed.getNextValue() / 100.0f;
    if (driveAmount > 0.0f)
    {
        const float inputGain = 1.0f + driveAmount * 4.0f; // Up to 5x gain into saturator

        for (size_t channel = 0; channel < oversampledBlock.getNumChannels(); ++channel)
        {
            auto* channelData = oversampledBlock.getChannelPointer(channel);
            for (size_t i = 0; i < oversampledBlock.getNumSamples(); ++i)
            {
                channelData[i] *= inputGain;
            }
        }

        juce::dsp::ProcessContextReplacing<float> waveshaperContext(oversampledBlock);
        waveshaper.process(waveshaperContext);

        // Compensate for gain increase
        const float makeupGain = 1.0f / (1.0f + driveAmount * 2.0f);
        for (size_t channel = 0; channel < oversampledBlock.getNumChannels(); ++channel)
        {
            auto* channelData = oversampledBlock.getChannelPointer(channel);
            for (size_t i = 0; i < oversampledBlock.getNumSamples(); ++i)
            {
                channelData[i] *= makeupGain;
            }
        }
    }

    // Downsample
    oversampling.processSamplesDown(juce::dsp::AudioBlock<float>(buffer));

    // Apply pressure (compression)
    const float pressureAmount = pressureSmoothed.getNextValue() / 100.0f;
    if (pressureAmount > 0.0f)
    {
        // Adjust compressor based on pressure amount
        compressor.setRatio(1.0f + pressureAmount * 7.0f); // 1:1 to 8:1
        compressor.setThreshold(-30.0f + pressureAmount * 20.0f); // -30dB to -10dB

        juce::dsp::AudioBlock<float> block(buffer);
        juce::dsp::ProcessContextReplacing<float> compContext(block);
        compressor.process(compContext);
    }

    // Apply tone
    const float toneAmount = toneSmoothed.getNextValue();
    if (std::abs(toneAmount) > 0.1f)
    {
        juce::dsp::AudioBlock<float> block(buffer);

        if (toneAmount < 0.0f)
        {
            // Negative = darker (low pass)
            const float cutoff = 20000.0f * std::pow(10.0f, toneAmount / 100.0f);
            toneFilterLow.setCutoffFrequency(std::max(200.0f, cutoff));
            juce::dsp::ProcessContextReplacing<float> filterContext(block);
            toneFilterLow.process(filterContext);
        }
        else
        {
            // Positive = brighter (high shelf boost simulation via high pass blend)
            const float cutoff = 200.0f + (toneAmount / 100.0f) * 2000.0f;
            toneFilterHigh.setCutoffFrequency(cutoff);

            // Create a parallel high-passed signal and add it
            juce::AudioBuffer<float> highBuffer;
            highBuffer.makeCopyOf(buffer);
            juce::dsp::AudioBlock<float> highBlock(highBuffer);
            juce::dsp::ProcessContextReplacing<float> highContext(highBlock);
            toneFilterHigh.process(highContext);

            // Blend high frequencies
            const float highMix = toneAmount / 200.0f; // Subtle boost
            for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
            {
                auto* dest = buffer.getWritePointer(channel);
                const auto* src = highBuffer.getReadPointer(channel);
                for (int i = 0; i < buffer.getNumSamples(); ++i)
                {
                    dest[i] += src[i] * highMix;
                }
            }
        }
    }

    // Mix dry/wet
    const float wetMix = mixSmoothed.getNextValue() / 100.0f;
    const float dryMix = 1.0f - wetMix;

    for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
    {
        auto* wet = buffer.getWritePointer(channel);
        const auto* dry = dryBuffer.getReadPointer(channel);
        for (int i = 0; i < buffer.getNumSamples(); ++i)
        {
            wet[i] = wet[i] * wetMix + dry[i] * dryMix;
        }
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
