#include "PluginEditor.h"
#include "ParameterIDs.h"

DriveAudioProcessorEditor::DriveAudioProcessorEditor(DriveAudioProcessor& p)
    : AudioProcessorEditor(&p), audioProcessor(p)
{
    setSize(600, 500);
    setResizable(false, false);

    setupWebView();

    // Start timer for visualizer updates (60fps)
    startTimerHz(60);
}

DriveAudioProcessorEditor::~DriveAudioProcessorEditor()
{
    stopTimer();
}

void DriveAudioProcessorEditor::setupWebView()
{
    // Build WebView options with relays - relays must be added BEFORE creating WebBrowserComponent
    auto options = juce::WebBrowserComponent::Options()
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withWinWebView2Options(
            juce::WebBrowserComponent::Options::WinWebView2{}
                .withUserDataFolder(juce::File::getSpecialLocation(
                    juce::File::tempDirectory).getChildFile("DriveWebView"))
        )
        .withNativeIntegrationEnabled()
        .withResourceProvider(
            [](const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource>
            {
                // Resource provider for bundled assets (production mode)
                #if !DRIVE_DEV_MODE
                    auto urlToRetrieve = url == "/" ? juce::String("/index.html") : url;

                    #if JUCE_MAC
                        auto file = juce::File::getSpecialLocation(juce::File::currentApplicationFile)
                            .getChildFile("Contents/Resources/WebUI")
                            .getChildFile(urlToRetrieve.substring(1));
                    #elif JUCE_WINDOWS
                        auto file = juce::File::getSpecialLocation(juce::File::currentExecutableFile)
                            .getParentDirectory()
                            .getChildFile("WebUI")
                            .getChildFile(urlToRetrieve.substring(1));
                    #endif

                    if (file.existsAsFile())
                    {
                        juce::String mimeType = "application/octet-stream";
                        if (file.hasFileExtension(".html")) mimeType = "text/html";
                        else if (file.hasFileExtension(".js")) mimeType = "application/javascript";
                        else if (file.hasFileExtension(".css")) mimeType = "text/css";
                        else if (file.hasFileExtension(".svg")) mimeType = "image/svg+xml";
                        else if (file.hasFileExtension(".png")) mimeType = "image/png";
                        else if (file.hasFileExtension(".woff2")) mimeType = "font/woff2";
                        else if (file.hasFileExtension(".wgsl")) mimeType = "text/plain";

                        auto* stream = file.createInputStream();
                        if (stream != nullptr)
                        {
                            juce::MemoryBlock data;
                            stream->readIntoMemoryBlock(data);
                            delete stream;
                            return juce::WebBrowserComponent::Resource{
                                std::vector<std::byte>(
                                    reinterpret_cast<const std::byte*>(data.getData()),
                                    reinterpret_cast<const std::byte*>(data.getData()) + data.getSize()
                                ),
                                mimeType.toStdString()
                            };
                        }
                    }
                #endif
                return std::nullopt;
            },
            juce::URL("http://localhost")
        )
        // Add parameter relays
        .withOptionsFrom(driveRelay)
        .withOptionsFrom(pressureRelay)
        .withOptionsFrom(toneRelay)
        .withOptionsFrom(mixRelay)
        .withOptionsFrom(outputRelay)
        // Add event listeners
        .withEventListener("requestVisualizerData", [this](const juce::var&) {
            sendVisualizerData();
        })
#if BEATCONNECT_ACTIVATION_ENABLED
        .withEventListener("activateLicense", [this](const juce::var& data) {
            handleActivateLicense(data);
        })
        .withEventListener("deactivateLicense", [this](const juce::var& data) {
            handleDeactivateLicense(data);
        })
        .withEventListener("getActivationStatus", [this](const juce::var&) {
            handleGetActivationStatus();
        })
#endif
    ;

    // Create WebBrowserComponent with options
    webView = std::make_unique<juce::WebBrowserComponent>(options);
    addAndMakeVisible(*webView);

    // Create parameter attachments AFTER WebBrowserComponent
    auto& apvts = audioProcessor.getAPVTS();

    driveAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::drive), driveRelay, nullptr);

    pressureAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::pressure), pressureRelay, nullptr);

    toneAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::tone), toneRelay, nullptr);

    mixAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::mix), mixRelay, nullptr);

    outputAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::output), outputRelay, nullptr);

    // Navigate to the UI
#if DRIVE_DEV_MODE
    webView->goToURL("http://localhost:5173");
    DBG("Dev mode: Loading from Vite dev server");
#else
    webView->goToURL("http://localhost/index.html");
    DBG("Production mode: Loading bundled assets");
#endif
}

void DriveAudioProcessorEditor::timerCallback()
{
    sendVisualizerData();
}

void DriveAudioProcessorEditor::sendVisualizerData()
{
    if (webView == nullptr)
        return;

    juce::DynamicObject::Ptr data = new juce::DynamicObject();
    data->setProperty("rms", audioProcessor.getCurrentRMS());
    data->setProperty("peak", audioProcessor.getCurrentPeak());
    data->setProperty("envelope", audioProcessor.getEnvelopeFollower());

    webView->emitEventIfBrowserIsVisible("visualizerData", juce::var(data.get()));
}

#if BEATCONNECT_ACTIVATION_ENABLED
void DriveAudioProcessorEditor::sendActivationState()
{
    if (webView == nullptr)
        return;

    auto* activation = audioProcessor.getActivation();
    juce::DynamicObject::Ptr data = new juce::DynamicObject();

    if (activation != nullptr)
    {
        data->setProperty("isConfigured", true);
        data->setProperty("isActivated", activation->isActivated());

        if (activation->isActivated())
        {
            auto info = activation->getActivationInfo();
            juce::DynamicObject::Ptr infoObj = new juce::DynamicObject();
            infoObj->setProperty("activationCode", juce::String(info.activationCode));
            infoObj->setProperty("machineId", juce::String(info.machineId));
            infoObj->setProperty("activatedAt", juce::String(info.activatedAt));
            infoObj->setProperty("currentActivations", info.currentActivations);
            infoObj->setProperty("maxActivations", info.maxActivations);
            infoObj->setProperty("isValid", info.isValid);
            data->setProperty("info", juce::var(infoObj.get()));
        }
    }
    else
    {
        data->setProperty("isConfigured", false);
        data->setProperty("isActivated", false);
    }

    webView->emitEventIfBrowserIsVisible("activationState", juce::var(data.get()));
}

void DriveAudioProcessorEditor::handleActivateLicense(const juce::var& data)
{
    auto* activation = audioProcessor.getActivation();
    if (activation == nullptr)
        return;

    auto code = data.getProperty("code", "").toString().toStdString();

    activation->activateAsync(code, [this](beatconnect::ActivationStatus status, const beatconnect::ActivationInfo& info) {
        juce::MessageManager::callAsync([this, status, info]() {
            juce::DynamicObject::Ptr result = new juce::DynamicObject();
            result->setProperty("status", juce::String(beatconnect::statusToString(status)));

            if (status == beatconnect::ActivationStatus::Valid)
            {
                juce::DynamicObject::Ptr infoObj = new juce::DynamicObject();
                infoObj->setProperty("activationCode", juce::String(info.activationCode));
                infoObj->setProperty("machineId", juce::String(info.machineId));
                infoObj->setProperty("activatedAt", juce::String(info.activatedAt));
                infoObj->setProperty("currentActivations", info.currentActivations);
                infoObj->setProperty("maxActivations", info.maxActivations);
                infoObj->setProperty("isValid", info.isValid);
                result->setProperty("info", juce::var(infoObj.get()));
            }

            if (webView != nullptr)
                webView->emitEventIfBrowserIsVisible("activationResult", juce::var(result.get()));
        });
    });
}

void DriveAudioProcessorEditor::handleDeactivateLicense(const juce::var&)
{
    auto* activation = audioProcessor.getActivation();
    if (activation == nullptr)
        return;

    activation->deactivateAsync([this](beatconnect::ActivationStatus status) {
        juce::MessageManager::callAsync([this, status]() {
            juce::DynamicObject::Ptr result = new juce::DynamicObject();
            result->setProperty("status", juce::String(beatconnect::statusToString(status)));

            if (webView != nullptr)
                webView->emitEventIfBrowserIsVisible("deactivationResult", juce::var(result.get()));
        });
    });
}

void DriveAudioProcessorEditor::handleGetActivationStatus()
{
    sendActivationState();
}
#endif

void DriveAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(juce::Colours::black);
}

void DriveAudioProcessorEditor::resized()
{
    if (webView != nullptr)
        webView->setBounds(getLocalBounds());
}
