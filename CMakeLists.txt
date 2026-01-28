cmake_minimum_required(VERSION 3.22)
project(Drive VERSION 1.0.0)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Dev mode option - enables hot reload from Vite dev server
option(DRIVE_DEV_MODE "Enable development mode with hot reload" OFF)

# Activation option - set by CI when building with license support
option(BEATCONNECT_ENABLE_ACTIVATION "Enable activation key support" OFF)

# JUCE setup
set(JUCE_PATH "${CMAKE_SOURCE_DIR}/JUCE" CACHE PATH "Path to JUCE")
if(NOT EXISTS "${JUCE_PATH}/CMakeLists.txt")
    message(FATAL_ERROR "JUCE not found at ${JUCE_PATH}. Set JUCE_PATH to your JUCE installation.")
endif()
add_subdirectory("${JUCE_PATH}" "${CMAKE_BINARY_DIR}/JUCE" EXCLUDE_FROM_ALL)

# BeatConnect SDK - MUST be before plugin target
if(EXISTS "${CMAKE_SOURCE_DIR}/beatconnect-sdk/sdk/activation/CMakeLists.txt")
    add_subdirectory(beatconnect-sdk/sdk/activation)
    target_link_libraries(beatconnect_activation PRIVATE juce::juce_cryptography)
    set(BEATCONNECT_SDK_AVAILABLE TRUE)
else()
    set(BEATCONNECT_SDK_AVAILABLE FALSE)
    message(STATUS "BeatConnect SDK not found - activation features disabled")
endif()

# Plugin target
juce_add_plugin(${PROJECT_NAME}
    COMPANY_NAME "BeatConnect"
    PLUGIN_MANUFACTURER_CODE Beat
    PLUGIN_CODE Drve
    FORMATS VST3 AU Standalone
    PRODUCT_NAME "DRIVE"
    BUNDLE_ID "com.beatconnect.drive"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD TRUE
    NEEDS_WEBVIEW2 TRUE
)

# Source files
target_sources(${PROJECT_NAME}
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
)

# Include directories
target_include_directories(${PROJECT_NAME}
    PRIVATE
        ${CMAKE_SOURCE_DIR}/Source
)

# Compile definitions
target_compile_definitions(${PROJECT_NAME}
    PUBLIC
        JUCE_WEB_BROWSER=1
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
        JUCE_DISPLAY_SPLASH_SCREEN=0
        $<IF:$<BOOL:${DRIVE_DEV_MODE}>,DRIVE_DEV_MODE=1,DRIVE_DEV_MODE=0>
)

# Windows WebView2
if(WIN32)
    target_compile_definitions(${PROJECT_NAME} PUBLIC JUCE_USE_WIN_WEBVIEW2=1)
endif()

# Link JUCE modules
target_link_libraries(${PROJECT_NAME}
    PRIVATE
        juce::juce_audio_utils
        juce::juce_audio_processors
        juce::juce_dsp
        juce::juce_gui_extra
        juce::juce_cryptography
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# BeatConnect SDK Integration
if(EXISTS "${CMAKE_SOURCE_DIR}/resources/project_data.json")
    juce_add_binary_data(Drive_ProjectData
        HEADER_NAME "ProjectData.h"
        NAMESPACE ProjectData
        SOURCES resources/project_data.json
    )
    target_link_libraries(${PROJECT_NAME} PRIVATE Drive_ProjectData)
    target_compile_definitions(${PROJECT_NAME} PUBLIC HAS_PROJECT_DATA=1)
    message(STATUS "Project data found - embedding in binary")
else()
    target_compile_definitions(${PROJECT_NAME} PUBLIC HAS_PROJECT_DATA=0)
    message(STATUS "No project_data.json - building without BeatConnect integration")
endif()

# Activation support
if(BEATCONNECT_ENABLE_ACTIVATION AND BEATCONNECT_SDK_AVAILABLE)
    target_link_libraries(${PROJECT_NAME} PRIVATE beatconnect_activation)
    target_compile_definitions(${PROJECT_NAME} PUBLIC BEATCONNECT_ACTIVATION_ENABLED=1)
    message(STATUS "Activation support ENABLED")
else()
    target_compile_definitions(${PROJECT_NAME} PUBLIC BEATCONNECT_ACTIVATION_ENABLED=0)
    message(STATUS "Activation support disabled")
endif()

# Copy WebUI resources to plugin bundle
if(NOT DRIVE_DEV_MODE)
    set(WEBUI_SOURCE_DIR "${CMAKE_SOURCE_DIR}/Resources/WebUI")
    if(EXISTS "${WEBUI_SOURCE_DIR}/index.html")
        if(APPLE)
            set(WEBUI_DEST_DIR "$<TARGET_BUNDLE_DIR:${PROJECT_NAME}>/Contents/Resources/WebUI")
        elseif(WIN32)
            set(WEBUI_DEST_DIR "$<TARGET_FILE_DIR:${PROJECT_NAME}>/WebUI")
        endif()

        add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E copy_directory
                "${WEBUI_SOURCE_DIR}"
                "${WEBUI_DEST_DIR}"
            COMMENT "Copying WebUI resources to plugin bundle"
        )
    else()
        message(WARNING "WebUI not found at ${WEBUI_SOURCE_DIR} - run 'npm run build' in web-ui/ first")
    endif()
endif()
