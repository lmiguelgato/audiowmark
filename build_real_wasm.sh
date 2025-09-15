#!/bin/bash
set -e

echo "Building Real AudioWmark WebAssembly module..."

# Source Emscripten environment
source /home/luisgatodiaz/emsdk/emsdk_env.sh

# Check if emcc is available
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten not found. Please install and activate emsdk."
    exit 1
fi

echo "Using Emscripten version: $(emcc --version | head -n1)"

# Create output directory
OUTPUT_DIR="/home/luisgatodiaz/audiowmark/wasm"
mkdir -p "$OUTPUT_DIR"

# Check if audiowmark_realtime files exist
if [ ! -f "src/audiowmark_realtime.cc" ] || [ ! -f "include/audiowmark_realtime.h" ]; then
    echo "Error: Real-time AudioWmark library files not found!"
    echo "Looking for: src/audiowmark_realtime.cc and include/audiowmark_realtime.h"
    exit 1
fi

# Compile the real WASM module
echo "Compiling C++ to WebAssembly..."

emcc src/audiowmark_wasm.cc \
    src/audiowmark_realtime.cc \
    src/utils.cc \
    src/convcode.cc \
    src/random.cc \
    src/wavdata.cc \
    src/wmcommon.cc \
    src/fft.cc \
    src/limiter.cc \
    src/shortcode.cc \
    src/threadpool.cc \
    -o "$OUTPUT_DIR/audiowmark.js" \
    -I include \
    -I src \
    -s WASM=1 \
    -s EXPORTED_RUNTIME_METHODS='["cwrap", "getValue", "UTF8ToString", "HEAPF32", "HEAP8", "HEAPU8"]' \
    -s EXPORTED_FUNCTIONS='["_malloc", "_free", "_watermarker_create", "_watermarker_destroy", "_watermarker_process_frame", "_detector_create", "_detector_destroy", "_detector_process_frame", "_detector_get_result", "_text_to_hex", "_hex_to_text"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s MAXIMUM_MEMORY=67108864 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='AudioWmarkModule' \
    -s ENVIRONMENT=web \
    -s DISABLE_EXCEPTION_CATCHING=0 \
    -O3

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "Generated files:"
    ls -la "$OUTPUT_DIR/audiowmark.js" "$OUTPUT_DIR/audiowmark.wasm"
    echo ""
    echo "The real AudioWmark WASM library is now ready!"
else
    echo "❌ Build failed!"
    exit 1
fi