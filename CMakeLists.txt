cmake_minimum_required(VERSION 3.22)
project(Drive VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# JUCE - use JUCE_PATH if provided (CI), otherwise fetch from GitHub
if(DEFINED JUCE_PATH AND EXISTS "${JUCE_PATH}/CMakeLists.txt")
    message(STATUS "Using JUCE from: ${JUCE_PATH}")
    add_subdirectory("${JUCE_PATH}" "${CMAKE_BINARY_DIR}/JUCE" EXCLUDE_FROM_ALL)
else()
    message(STATUS "Fetching JUCE from GitHub...")
    include(FetchContent)
    FetchContent_Declare(
        JUCE
        GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
        GIT_TAG 8.0.4
    )
    FetchContent_MakeAvailable(JUCE)
endif()

# BeatConnect Plugin SDK (activation, asset downloads)
add_subdirectory(beatconnect-sdk/sdk/activation)
# SDK needs cryptography module for SHA256
target_link_libraries(beatconnect_activation PRIVATE juce::juce_cryptography)

# Determine plugin formats - AU only on macOS
set(PLUGIN_FORMATS VST3 Standalone)
if(APPLE)
    list(APPEND PLUGIN_FORMATS AU)
endif()

# Plugin target with WebView2 support
juce_add_plugin(Drive
    COMPANY_NAME "BeatConnect"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD TRUE
    PLUGIN_MANUFACTURER_CODE Beat
    PLUGIN_CODE Drve
    FORMATS ${PLUGIN_FORMATS}
    PRODUCT_NAME "DRIVE"
    NEEDS_WEBVIEW2 TRUE
)

# Source files
target_sources(Drive
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
)

target_compile_definitions(Drive
    PUBLIC
        JUCE_WEB_BROWSER=1
        JUCE_USE_WIN_WEBVIEW2=1
        # Static linking embeds the WebView2 loader into the binary - no DLL needed at runtime!
        JUCE_USE_WIN_WEBVIEW2_WITH_STATIC_LINKING=1
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
        # Development mode - set to 0 for production builds
        DRIVE_DEV_MODE=0
)

target_link_libraries(Drive
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
        juce::juce_gui_extra
        beatconnect_activation
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# Copy WebUI resources after build (for production)
# Copy to Standalone
add_custom_command(TARGET Drive_Standalone POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_SOURCE_DIR}/Resources/WebUI"
        "$<TARGET_FILE_DIR:Drive_Standalone>/Resources/WebUI"
    COMMENT "Copying WebUI resources to Standalone..."
)
# Copy to VST3 build output
add_custom_command(TARGET Drive_VST3 POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        "${CMAKE_SOURCE_DIR}/Resources/WebUI"
        "$<TARGET_FILE_DIR:Drive_VST3>/../Resources/WebUI"
    COMMENT "Copying WebUI resources to VST3..."
)
# Copy to AU build output (macOS only)
if(APPLE)
    add_custom_command(TARGET Drive_AU POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${CMAKE_SOURCE_DIR}/Resources/WebUI"
            "$<TARGET_FILE_DIR:Drive_AU>/../Resources/WebUI"
        COMMENT "Copying WebUI resources to AU..."
    )
endif()

# Also copy WebUI to installed VST3 location (Windows)
if(WIN32)
    add_custom_command(TARGET Drive_VST3 POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_directory
            "${CMAKE_SOURCE_DIR}/Resources/WebUI"
            "$ENV{CommonProgramFiles}/VST3/DRIVE.vst3/Contents/Resources/WebUI"
        COMMENT "Copying WebUI resources to installed VST3..."
    )
endif()

# ==============================================================================
# BeatConnect SDK Integration
# ==============================================================================

# Option to enable BeatConnect activation (set by CI or manually)
option(BEATCONNECT_ENABLE_ACTIVATION "Enable BeatConnect activation key support" OFF)

# Embed project_data.json if it exists (injected at build time by BeatConnect CI)
message(STATUS "=== BeatConnect SDK Configuration ===")
message(STATUS "CMAKE_SOURCE_DIR: ${CMAKE_SOURCE_DIR}")
message(STATUS "Looking for project_data.json at: ${CMAKE_SOURCE_DIR}/resources/project_data.json")
message(STATUS "BEATCONNECT_ENABLE_ACTIVATION option: ${BEATCONNECT_ENABLE_ACTIVATION}")

if(EXISTS "${CMAKE_SOURCE_DIR}/resources/project_data.json")
    message(STATUS "✓ Found project_data.json - embedding as BinaryData")
    file(SIZE "${CMAKE_SOURCE_DIR}/resources/project_data.json" PROJECT_DATA_SIZE)
    message(STATUS "  File size: ${PROJECT_DATA_SIZE} bytes")

    juce_add_binary_data(Drive_ProjectData
        HEADER_NAME "ProjectData.h"
        NAMESPACE ProjectData
        SOURCES
            resources/project_data.json
    )
    target_link_libraries(Drive PRIVATE Drive_ProjectData)
    target_compile_definitions(Drive PUBLIC HAS_PROJECT_DATA=1)
    message(STATUS "  HAS_PROJECT_DATA = 1")
else()
    message(STATUS "✗ No project_data.json found - BeatConnect features will use SDK defaults")
    target_compile_definitions(Drive PUBLIC HAS_PROJECT_DATA=0)
    message(STATUS "  HAS_PROJECT_DATA = 0")
endif()

# BeatConnect Activation SDK integration
if(BEATCONNECT_ENABLE_ACTIVATION)
    target_compile_definitions(Drive PUBLIC BEATCONNECT_ACTIVATION_ENABLED=1)
    message(STATUS "  BEATCONNECT_ACTIVATION_ENABLED = 1 (activation will be compiled in)")
else()
    target_compile_definitions(Drive PUBLIC BEATCONNECT_ACTIVATION_ENABLED=0)
    message(STATUS "  BEATCONNECT_ACTIVATION_ENABLED = 0 (activation disabled)")
endif()

message(STATUS "=== End BeatConnect SDK Configuration ===")
