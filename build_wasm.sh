#!/bin/bash

# AudioWmark WebAssembly Build Script

set -e

echo "🔧 Building AudioWmark for WebAssembly..."

# Check if Emscripten is available
if ! command -v emcc &> /dev/null; then
    echo "❌ Error: Emscripten not found. Please install Emscripten SDK:"
    echo "   https://emscripten.org/docs/getting_started/downloads.html"
    exit 1
fi

# Create build directory
BUILD_DIR="build_wasm"
mkdir -p $BUILD_DIR
cd $BUILD_DIR

echo "📦 Configuring CMake for WebAssembly..."

# Configure with Emscripten
cp ../CMakeLists_wasm.txt CMakeLists.txt
emcmake cmake -DCMAKE_BUILD_TYPE=Release .

echo "🔨 Building WebAssembly module..."

# Build the WASM module
emmake make -j$(nproc 2>/dev/null || echo 4)

echo "📋 Build complete!"

# Check if files were generated
if [ -f "audiowmark_wasm.js" ] && [ -f "audiowmark_wasm.wasm" ]; then
    echo "✅ Generated files:"
    echo "   - audiowmark_wasm.js"
    echo "   - audiowmark_wasm.wasm"
    
    # Copy to wasm directory
    cp audiowmark_wasm.js ../wasm/
    cp audiowmark_wasm.wasm ../wasm/
    
    echo "📁 Files copied to wasm/ directory"
    
    # Show file sizes
    echo "📊 File sizes:"
    ls -lh audiowmark_wasm.*
    
    echo ""
    echo "🌐 To test the application:"
    echo "   1. Start a web server in the wasm/ directory"
    echo "   2. Open index.html in a modern web browser"
    echo "   3. Allow microphone access when prompted"
    echo ""
    echo "   Example using Python:"
    echo "   cd wasm && python3 -m http.server 8000"
    echo "   Then open: http://localhost:8000"
    
else
    echo "❌ Build failed - output files not found"
    exit 1
fi