#!/bin/bash
set -e

echo "Building Simple AudioWmark WebAssembly module..."

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

# Compile the simplified WASM module
echo "Compiling C++ to WebAssembly..."

emcc src/audiowmark_wasm_simple.cc \
    -o "$OUTPUT_DIR/audiowmark.js" \
    -s WASM=1 \
    -s EXPORTED_RUNTIME_METHODS='["cwrap", "getValue", "UTF8ToString", "HEAPF32", "HEAP8", "HEAPU8"]' \
    -s EXPORTED_FUNCTIONS='["_malloc", "_free"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s MAXIMUM_MEMORY=134217728 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="AudioWmarkModule" \
    -O3 \
    -DWASM_BUILD \
    --no-entry

if [ $? -eq 0 ]; then
    echo "✅ WebAssembly module compiled successfully!"
    echo "Generated files:"
    echo "  - $OUTPUT_DIR/audiowmark.js"
    echo "  - $OUTPUT_DIR/audiowmark.wasm"
    
    echo ""
    echo "File sizes:"
    ls -lh "$OUTPUT_DIR/audiowmark.js" "$OUTPUT_DIR/audiowmark.wasm" 2>/dev/null || echo "Files not found"
    
    echo ""
    echo "You can now serve the files from the wasm/ directory:"
    echo "  cd $OUTPUT_DIR && python3 -m http.server 8080"
    echo "  Then open: http://localhost:8080"
else
    echo "❌ Compilation failed!"
    exit 1
fi