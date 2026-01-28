#pragma once

#include "PluginProcessor.h"
#include <juce_gui_extra/juce_gui_extra.h>

class DriveAudioProcessorEditor : public juce::AudioProcessorEditor,
                                   private juce::Timer
{
public:
    explicit DriveAudioProcessorEditor(DriveAudioProcessor&);
    ~DriveAudioProcessorEditor() override;

    void paint(juce::Graphics&) override;
    void resized() override;

private:
    void setupWebView();
    void timerCallback() override;
    void sendVisualizerData();

#if BEATCONNECT_ACTIVATION_ENABLED
    void sendActivationState();
    void handleActivateLicense(const juce::var& data);
    void handleDeactivateLicense(const juce::var& data);
    void handleGetActivationStatus();
#endif

    DriveAudioProcessor& audioProcessor;

    // JUCE 8 Relay system - MUST be created BEFORE WebBrowserComponent
    juce::WebSliderRelay driveRelay { "drive" };
    juce::WebSliderRelay pressureRelay { "pressure" };
    juce::WebSliderRelay toneRelay { "tone" };
    juce::WebSliderRelay mixRelay { "mix" };
    juce::WebSliderRelay outputRelay { "output" };

    // Parameter attachments - created AFTER WebBrowserComponent
    std::unique_ptr<juce::WebSliderParameterAttachment> driveAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> pressureAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> toneAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> mixAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> outputAttachment;

    // WebView component
    std::unique_ptr<juce::WebBrowserComponent> webView;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(DriveAudioProcessorEditor)
};
