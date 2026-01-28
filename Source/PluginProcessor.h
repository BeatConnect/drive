#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_dsp/juce_dsp.h>

#if HAS_PROJECT_DATA
#include "ProjectData.h"
#endif

#if BEATCONNECT_ACTIVATION_ENABLED
#include <beatconnect/Activation.h>
#endif

class DriveAudioProcessor : public juce::AudioProcessor
{
public:
    DriveAudioProcessor();
    ~DriveAudioProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram(int) override {}
    const juce::String getProgramName(int) override { return {}; }
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& destData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState& getAPVTS() { return apvts; }

    // Visualizer data access
    float getCurrentRMS() const { return currentRMS.load(); }
    float getCurrentPeak() const { return currentPeak.load(); }
    float getEnvelopeFollower() const { return envelopeFollower.load(); }

    // BeatConnect integration
    bool hasActivationEnabled() const;
    juce::String getPluginId() const { return pluginId; }
    juce::String getApiBaseUrl() const { return apiBaseUrl; }
    juce::String getSupabaseKey() const { return supabaseKey; }

#if BEATCONNECT_ACTIVATION_ENABLED
    beatconnect::Activation* getActivation() { return activation.get(); }
#endif

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
    void loadProjectData();

    juce::AudioProcessorValueTreeState apvts;

    // DSP components
    juce::dsp::Oversampling<float> oversampling { 2, 2, juce::dsp::Oversampling<float>::filterHalfBandPolyphaseIIR };
    juce::dsp::WaveShaper<float> waveshaper;
    juce::dsp::Compressor<float> compressor;
    juce::dsp::StateVariableTPTFilter<float> toneFilterLow;
    juce::dsp::StateVariableTPTFilter<float> toneFilterHigh;
    juce::dsp::Gain<float> outputGain;

    // Smoothed parameters
    juce::SmoothedValue<float> driveSmoothed;
    juce::SmoothedValue<float> pressureSmoothed;
    juce::SmoothedValue<float> toneSmoothed;
    juce::SmoothedValue<float> mixSmoothed;

    // Visualizer data (atomic for thread safety)
    std::atomic<float> currentRMS { 0.0f };
    std::atomic<float> currentPeak { 0.0f };
    std::atomic<float> envelopeFollower { 0.0f };
    float envelopeCoeff = 0.0f;

    // BeatConnect data
    juce::String pluginId;
    juce::String apiBaseUrl;
    juce::String supabaseKey;
    juce::var buildFlags;

#if BEATCONNECT_ACTIVATION_ENABLED
    std::unique_ptr<beatconnect::Activation> activation;
#endif

    // State version for backwards compatibility
    static constexpr int kStateVersion = 1;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(DriveAudioProcessor)
};
