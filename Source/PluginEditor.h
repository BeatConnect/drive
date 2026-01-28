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
    void setupRelaysAndAttachments();
    void timerCallback() override;
    void sendVisualizerData();

#if BEATCONNECT_ACTIVATION_ENABLED
    void sendActivationState();
    void handleActivateLicense(const juce::var& data);
    void handleDeactivateLicense(const juce::var& data);
    void handleGetActivationStatus();
#endif

    DriveAudioProcessor& audioProcessor;

    // Resources directory for bundled WebUI
    juce::File resourcesDir;

    // JUCE 8 Relay system - created BEFORE WebBrowserComponent
    // Slider relays for continuous parameters
    std::unique_ptr<juce::WebSliderRelay> driveRelay;
    std::unique_ptr<juce::WebSliderRelay> pressureRelay;
    std::unique_ptr<juce::WebSliderRelay> toneRelay;
    std::unique_ptr<juce::WebSliderRelay> mixRelay;
    std::unique_ptr<juce::WebSliderRelay> outputRelay;
    std::unique_ptr<juce::WebSliderRelay> attackRelay;
    std::unique_ptr<juce::WebSliderRelay> sustainRelay;

    // ComboBox relay for choice parameter
    std::unique_ptr<juce::WebComboBoxRelay> modeRelay;

    // Toggle relays for boolean parameters
    std::unique_ptr<juce::WebToggleButtonRelay> autoGainRelay;
    std::unique_ptr<juce::WebToggleButtonRelay> bypassRelay;

    // Parameter attachments - created AFTER WebBrowserComponent
    std::unique_ptr<juce::WebSliderParameterAttachment> driveAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> pressureAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> toneAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> mixAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> outputAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> attackAttachment;
    std::unique_ptr<juce::WebSliderParameterAttachment> sustainAttachment;

    std::unique_ptr<juce::WebComboBoxParameterAttachment> modeAttachment;

    std::unique_ptr<juce::WebToggleButtonParameterAttachment> autoGainAttachment;
    std::unique_ptr<juce::WebToggleButtonParameterAttachment> bypassAttachment;

    // WebView component
    std::unique_ptr<juce::WebBrowserComponent> webView;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(DriveAudioProcessorEditor)
};
