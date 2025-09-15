# WebAssembly build configuration for AudioWmark
cmake_minimum_required(VERSION 3.16 FATAL_ERROR)
project(audiowmark_wasm CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Check if building with Emscripten
if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "This CMakeLists.txt is specifically for Emscripten builds. Use: emcmake cmake ..")
endif()

set(PACKAGE_NAME "audiowmark_wasm")
set(PACKAGE_VERSION "0.6.1")

# WebAssembly-specific output directory
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_LIST_DIR}/wasm)

# Core source files (excluding file I/O and platform-specific dependencies)
set(WASM_CORE_SRC
    ${CMAKE_CURRENT_LIST_DIR}/src/utils.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/convcode.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/random.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/wavdata.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/wmcommon.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/fft_wasm.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/limiter.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/shortcode.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/threadpool.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/audiowmark_realtime.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/audiowmark_wasm.cc
)

# Create WebAssembly library
add_executable(audiowmark_wasm ${WASM_CORE_SRC})

# Emscripten-specific settings
set_target_properties(audiowmark_wasm PROPERTIES
    SUFFIX ".js"
    LINK_FLAGS_RELEASE "-O3 -s WASM=1 -s EXPORTED_FUNCTIONS=['_malloc','_free','_watermarker_create','_watermarker_destroy','_watermarker_process_frame','_detector_create','_detector_destroy','_detector_process_frame','_detector_get_result','_text_to_hex','_hex_to_text'] -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','UTF8ToString','stringToUTF8','_malloc','_free'] -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=16777216 -s MAXIMUM_MEMORY=67108864 -s MODULARIZE=1 -s EXPORT_NAME='AudioWmarkModule' -s ENVIRONMENT=web -s DISABLE_EXCEPTION_CATCHING=0"
)

# Include directories
target_include_directories(audiowmark_wasm PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/include
    ${CMAKE_CURRENT_LIST_DIR}/src
)

# Compile definitions for WebAssembly
target_compile_definitions(audiowmark_wasm PRIVATE
    AUDIOWMARK_WASM=1
    STDC_HEADERS=1
    HAVE_UNISTD_H=1
    HAVE_SYS_STAT_H=1
    HAVE_SYS_TYPES_H=1
    # Disable features that require external libraries not available in WASM
    SPECTMORPH_HAVE_FFTW=0
    HAVE_LIBZITA_RESAMPLER=0
    HAVE_MP3=0
    HAVE_FFMPEG=0
)

# Compiler options
target_compile_options(audiowmark_wasm PRIVATE -O3 -g0)

# Build the WASM version of fft.cc that doesn't depend on external FFTW
target_compile_definitions(audiowmark_wasm PRIVATE USE_BUILTIN_FFT=1)