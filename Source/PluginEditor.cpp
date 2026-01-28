#include "PluginEditor.h"
#include "ParameterIDs.h"
#include <thread>

DriveAudioProcessorEditor::DriveAudioProcessorEditor(DriveAudioProcessor& p)
    : AudioProcessorEditor(&p), audioProcessor(p)
{
    setupWebView();
    setupRelaysAndAttachments();

    // Force consistent scaling regardless of OS display scaling settings
    setScaleFactor(1.0f);

    setSize(900, 500);
    setResizable(false, false);

    // Start timer for visualizer updates (60fps)
    startTimerHz(60);
}

DriveAudioProcessorEditor::~DriveAudioProcessorEditor()
{
    stopTimer();

    // Destroy attachments first (they reference relays)
    driveAttachment.reset();
    pressureAttachment.reset();
    toneAttachment.reset();
    mixAttachment.reset();
    outputAttachment.reset();
    modeAttachment.reset();
    attackAttachment.reset();
    sustainAttachment.reset();
    autoGainAttachment.reset();
    bypassAttachment.reset();

    // Destroy WebView (disconnects relay bindings)
    webView.reset();

    // Relays destroyed automatically
}

void DriveAudioProcessorEditor::setupWebView()
{
    // Create relays first (they need to exist before creating WebBrowserComponent options)
    // Slider relays for continuous parameters
    driveRelay = std::make_unique<juce::WebSliderRelay>("drive");
    pressureRelay = std::make_unique<juce::WebSliderRelay>("pressure");
    toneRelay = std::make_unique<juce::WebSliderRelay>("tone");
    mixRelay = std::make_unique<juce::WebSliderRelay>("mix");
    outputRelay = std::make_unique<juce::WebSliderRelay>("output");
    attackRelay = std::make_unique<juce::WebSliderRelay>("attack");
    sustainRelay = std::make_unique<juce::WebSliderRelay>("sustain");

    // ComboBox relay for choice parameter (mode)
    modeRelay = std::make_unique<juce::WebComboBoxRelay>("mode");

    // Toggle relays for boolean parameters
    autoGainRelay = std::make_unique<juce::WebToggleButtonRelay>("autoGain");
    bypassRelay = std::make_unique<juce::WebToggleButtonRelay>("bypass");

    // Get resources directory - handle both Standalone and VST3 paths
    auto executableFile = juce::File::getSpecialLocation(juce::File::currentExecutableFile);
    auto executableDir = executableFile.getParentDirectory();

    // Try Standalone path first: executable/../Resources/WebUI
    resourcesDir = executableDir.getChildFile("Resources").getChildFile("WebUI");

    // If that doesn't exist, try VST3 path: executable/../../Resources/WebUI
    if (!resourcesDir.isDirectory())
    {
        resourcesDir = executableDir.getParentDirectory()
                           .getChildFile("Resources")
                           .getChildFile("WebUI");
    }

    DBG("Resources dir: " + resourcesDir.getFullPathName());
    DBG("Resources exist: " + juce::String(resourcesDir.isDirectory() ? "yes" : "no"));

    // Build WebBrowserComponent options
    auto options = juce::WebBrowserComponent::Options()
        .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
        .withNativeIntegrationEnabled()
        .withResourceProvider(
            [this](const juce::String& url) -> std::optional<juce::WebBrowserComponent::Resource>
            {
                // The url parameter is just the path like "/" or "/assets/index.js"
                auto path = url;
                if (path.startsWith("/"))
                    path = path.substring(1);
                if (path.isEmpty())
                    path = "index.html";

                auto file = resourcesDir.getChildFile(path);
                if (!file.existsAsFile())
                    return std::nullopt;

                // Determine MIME type
                juce::String mimeType = "application/octet-stream";
                if (path.endsWith(".html")) mimeType = "text/html";
                else if (path.endsWith(".css")) mimeType = "text/css";
                else if (path.endsWith(".js")) mimeType = "application/javascript";
                else if (path.endsWith(".json")) mimeType = "application/json";
                else if (path.endsWith(".png")) mimeType = "image/png";
                else if (path.endsWith(".svg")) mimeType = "image/svg+xml";
                else if (path.endsWith(".woff2")) mimeType = "font/woff2";

                juce::MemoryBlock data;
                file.loadFileAsData(data);

                return juce::WebBrowserComponent::Resource{
                    std::vector<std::byte>(
                        reinterpret_cast<const std::byte*>(data.getData()),
                        reinterpret_cast<const std::byte*>(data.getData()) + data.getSize()),
                    mimeType.toStdString()
                };
            })
        .withOptionsFrom(*driveRelay)
        .withOptionsFrom(*pressureRelay)
        .withOptionsFrom(*toneRelay)
        .withOptionsFrom(*mixRelay)
        .withOptionsFrom(*outputRelay)
        .withOptionsFrom(*modeRelay)
        .withOptionsFrom(*attackRelay)
        .withOptionsFrom(*sustainRelay)
        .withOptionsFrom(*autoGainRelay)
        .withOptionsFrom(*bypassRelay)
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
        .withWinWebView2Options(
            juce::WebBrowserComponent::Options::WinWebView2()
                .withBackgroundColour(juce::Colour(0xff000000))
                .withStatusBarDisabled()
                .withUserDataFolder(
                    juce::File::getSpecialLocation(juce::File::tempDirectory)
                        .getChildFile("DriveWebView2")));

    // Create the WebBrowserComponent
    webView = std::make_unique<juce::WebBrowserComponent>(options);
    addAndMakeVisible(*webView);

    // Load URL based on build mode
#if DRIVE_DEV_MODE
    DBG("DEV_MODE: Loading from dev server");
    webView->goToURL("http://localhost:5173");
#else
    // Production mode: load from bundled resources via resource provider
    auto rootUrl = webView->getResourceProviderRoot();
    DBG("PROD_MODE: Loading from resource provider: " + rootUrl);
    webView->goToURL(rootUrl);
#endif
}

void DriveAudioProcessorEditor::setupRelaysAndAttachments()
{
    auto& apvts = audioProcessor.getAPVTS();

    // Slider attachments for continuous parameters
    driveAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::drive), *driveRelay, nullptr);

    pressureAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::pressure), *pressureRelay, nullptr);

    toneAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::tone), *toneRelay, nullptr);

    mixAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::mix), *mixRelay, nullptr);

    outputAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::output), *outputRelay, nullptr);

    attackAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::attack), *attackRelay, nullptr);

    sustainAttachment = std::make_unique<juce::WebSliderParameterAttachment>(
        *apvts.getParameter(ParameterIDs::sustain), *sustainRelay, nullptr);

    // ComboBox attachment for choice parameter (mode)
    modeAttachment = std::make_unique<juce::WebComboBoxParameterAttachment>(
        *apvts.getParameter(ParameterIDs::mode), *modeRelay, nullptr);

    // Toggle attachments for boolean parameters
    autoGainAttachment = std::make_unique<juce::WebToggleButtonParameterAttachment>(
        *apvts.getParameter(ParameterIDs::autoGain), *autoGainRelay, nullptr);

    bypassAttachment = std::make_unique<juce::WebToggleButtonParameterAttachment>(
        *apvts.getParameter(ParameterIDs::bypass), *bypassRelay, nullptr);
}

void DriveAudioProcessorEditor::timerCallback()
{
    sendVisualizerData();
}

void DriveAudioProcessorEditor::sendVisualizerData()
{
    if (webView == nullptr)
        return;

    auto& apvts = audioProcessor.getAPVTS();

    juce::DynamicObject::Ptr data = new juce::DynamicObject();
    data->setProperty("rms", audioProcessor.getCurrentRMS());
    data->setProperty("peak", audioProcessor.getCurrentPeak());
    data->setProperty("envelope", audioProcessor.getEnvelopeFollower());

    // Debug: send current parameter values so we can see them in browser console
    data->setProperty("debug_drive", apvts.getRawParameterValue("drive")->load());
    data->setProperty("debug_mix", apvts.getRawParameterValue("mix")->load());
    data->setProperty("debug_attack", apvts.getRawParameterValue("attack")->load());
    data->setProperty("debug_sustain", apvts.getRawParameterValue("sustain")->load());

    webView->emitEventIfBrowserIsVisible("visualizerData", juce::var(data.get()));
}

#if BEATCONNECT_ACTIVATION_ENABLED
void DriveAudioProcessorEditor::sendActivationState()
{
    if (webView == nullptr)
        return;

    auto* activation = audioProcessor.getActivation();
    juce::DynamicObject::Ptr data = new juce::DynamicObject();

    bool isConfigured = (activation != nullptr);
    bool isActivated = isConfigured && activation->isActivated();

    data->setProperty("isConfigured", isConfigured);
    data->setProperty("isActivated", isActivated);

    if (isActivated && activation)
    {
        if (auto info = activation->getActivationInfo())
        {
            juce::DynamicObject::Ptr infoObj = new juce::DynamicObject();
            infoObj->setProperty("activationCode", juce::String(info->activationCode));
            infoObj->setProperty("machineId", juce::String(info->machineId));
            infoObj->setProperty("activatedAt", juce::String(info->activatedAt));
            infoObj->setProperty("currentActivations", info->currentActivations);
            infoObj->setProperty("maxActivations", info->maxActivations);
            infoObj->setProperty("isValid", info->isValid);
            data->setProperty("info", juce::var(infoObj.get()));
        }
    }

    webView->emitEventIfBrowserIsVisible("activationState", juce::var(data.get()));
}

void DriveAudioProcessorEditor::handleActivateLicense(const juce::var& data)
{
    juce::String code = data.getProperty("code", "").toString();
    if (code.isEmpty())
        return;

    juce::Component::SafePointer<DriveAudioProcessorEditor> safeThis(this);

    auto* activation = audioProcessor.getActivation();
    if (!activation)
        return;

    activation->activateAsync(code.toStdString(),
        [safeThis](beatconnect::ActivationStatus status) {
            juce::MessageManager::callAsync([safeThis, status]() {
                if (safeThis == nullptr || safeThis->webView == nullptr)
                    return;

                juce::DynamicObject::Ptr result = new juce::DynamicObject();

                juce::String statusStr;
                switch (status) {
                    case beatconnect::ActivationStatus::Valid:         statusStr = "valid"; break;
                    case beatconnect::ActivationStatus::Invalid:       statusStr = "invalid"; break;
                    case beatconnect::ActivationStatus::Revoked:       statusStr = "revoked"; break;
                    case beatconnect::ActivationStatus::MaxReached:    statusStr = "max_reached"; break;
                    case beatconnect::ActivationStatus::NetworkError:  statusStr = "network_error"; break;
                    case beatconnect::ActivationStatus::ServerError:   statusStr = "server_error"; break;
                    case beatconnect::ActivationStatus::NotConfigured: statusStr = "not_configured"; break;
                    case beatconnect::ActivationStatus::AlreadyActive: statusStr = "already_active"; break;
                    case beatconnect::ActivationStatus::NotActivated:  statusStr = "not_activated"; break;
                }
                result->setProperty("status", statusStr);

                if (status == beatconnect::ActivationStatus::Valid ||
                    status == beatconnect::ActivationStatus::AlreadyActive)
                {
                    auto* activation = safeThis->audioProcessor.getActivation();
                    if (activation)
                    {
                        if (auto info = activation->getActivationInfo())
                        {
                            juce::DynamicObject::Ptr infoObj = new juce::DynamicObject();
                            infoObj->setProperty("activationCode", juce::String(info->activationCode));
                            infoObj->setProperty("machineId", juce::String(info->machineId));
                            infoObj->setProperty("activatedAt", juce::String(info->activatedAt));
                            infoObj->setProperty("currentActivations", info->currentActivations);
                            infoObj->setProperty("maxActivations", info->maxActivations);
                            infoObj->setProperty("isValid", info->isValid);
                            result->setProperty("info", juce::var(infoObj.get()));
                        }
                    }
                }

                safeThis->webView->emitEventIfBrowserIsVisible("activationResult", juce::var(result.get()));
            });
        });
}

void DriveAudioProcessorEditor::handleDeactivateLicense(const juce::var&)
{
    juce::Component::SafePointer<DriveAudioProcessorEditor> safeThis(this);

    auto* activation = audioProcessor.getActivation();
    if (!activation)
        return;

    std::thread([safeThis, activation]() {
        auto status = activation->deactivate();

        juce::MessageManager::callAsync([safeThis, status]() {
            if (safeThis == nullptr || safeThis->webView == nullptr)
                return;

            juce::DynamicObject::Ptr result = new juce::DynamicObject();

            juce::String statusStr;
            switch (status) {
                case beatconnect::ActivationStatus::Valid:         statusStr = "valid"; break;
                case beatconnect::ActivationStatus::NetworkError:  statusStr = "network_error"; break;
                case beatconnect::ActivationStatus::ServerError:   statusStr = "server_error"; break;
                case beatconnect::ActivationStatus::NotActivated:  statusStr = "not_activated"; break;
                default: statusStr = "server_error"; break;
            }
            result->setProperty("status", statusStr);

            safeThis->webView->emitEventIfBrowserIsVisible("deactivationResult", juce::var(result.get()));
        });
    }).detach();
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
