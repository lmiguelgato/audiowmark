# AudioWmark Web Application

## Overview

This web application demonstrates real-time audio watermarking technology using WebAssembly (WASM). It allows users to embed and detect digital watermarks in audio signals in real-time using modern Web Audio APIs.

## ⚠️ Important Notice

**This is currently a DEMONSTRATION implementation** that uses a simplified frequency-shift keying (FSK) approach for educational purposes. The current WASM implementation is NOT the full AudioWmark library due to WebAssembly limitations with external dependencies.

### Current Implementation
- **Algorithm**: Simplified FSK-based watermarking
- **Carriers**: 1000Hz (bit 0) and 1500Hz (bit 1)
- **Audibility**: The watermark is intentionally audible for demonstration purposes
- **Purpose**: Educational demonstration and proof-of-concept

### Production AudioWmark Library
The production AudioWmark library uses:
- **Advanced spectral domain watermarking**
- **Spread spectrum techniques** for imperceptible embedding
- **Convolutional coding** for error correction
- **Synchronization sequences** for robust detection
- **Sophisticated frequency shaping** to minimize audible artifacts

## Features

### Audio Source Options
1. **Test Tones**: Generate sine waves at various frequencies (440Hz, 523Hz, 659Hz, 880Hz)
2. **Audio Recordings**: Upload and play audio files (MP3, WAV, OGG, etc.) with watermark embedding

### Real-time Processing
- **AudioWorklet-based processing**: Modern, low-latency audio processing
- **Watermark Embedding**: Real-time addition of digital watermarks to audio signals
- **Watermark Detection**: Real-time extraction and decoding of embedded watermarks
- **Message Customization**: Embed custom text messages as watermarks

### User Interface
- **Clean, modern design** with responsive layout
- **Real-time status updates** and progress indicators
- **File information display** for uploaded audio
- **Volume controls** for audio playback
- **Detection confidence** meters and results display

## Technical Architecture

### Frontend Components
- **HTML5**: Modern semantic markup with Web Audio API integration
- **CSS3**: Responsive design with gradient backgrounds and smooth animations
- **JavaScript (ES6+)**: Modular class-based architecture

### Audio Processing Pipeline
```
Audio Source → AudioWorkletNode → Watermark Processor → Output
                     ↓
              WebAssembly Module
```

### WebAssembly Integration
- **Emscripten compilation**: C++ to WebAssembly transpilation
- **Memory management**: Efficient buffer allocation and cleanup
- **Binary transfer**: WASM module sharing between main thread and AudioWorklet
- **Function exports**: C-style function exports for JavaScript integration

## File Structure

```
wasm/
├── index.html                          # Main application interface
├── audiowmark_simple_app.js           # Application logic and UI management
├── audiowmark.js                       # Emscripten-generated WASM loader
├── audiowmark.wasm                     # WebAssembly binary module
├── watermark-sender-processor.js      # AudioWorklet for embedding
└── watermark-receiver-processor.js    # AudioWorklet for detection

src/
├── audiowmark_wasm_simple.cc          # WASM watermarking implementation
├── audiowmark_realtime.cc             # Real AudioWmark library (not WASM-compatible)
└── audiowmark_wasm.cc                 # Real library WASM wrapper (incomplete)
```

## Usage Instructions

### Getting Started
1. **Open the application** in a modern web browser
2. **Click "Enable Audio & Start App"** to initialize the Web Audio context
3. **Choose your audio source**:
   - Select "Test Tone" for simple sine wave generation
   - Select "Audio Recording" to upload an audio file

### Embedding Watermarks
1. **Enter a message** to embed as a watermark
2. **Select audio source** (tone frequency or upload file)
3. **Adjust volume** as needed
4. **Click "Start Playing & Embedding"** to begin real-time watermarking
5. **Listen** to the audio with embedded watermarks (currently audible in demo mode)

### Detecting Watermarks
1. **Click "Start Microphone"** to enable audio input
2. **Click "Start Detection"** to begin listening for watermarks
3. **Play watermarked audio** near the microphone
4. **View detection results** with confidence levels and decoded messages

## Browser Compatibility

### Supported Browsers
- **Chrome/Edge**: 88+ (Full AudioWorklet support)
- **Firefox**: 76+ (AudioWorklet support)
- **Safari**: 15+ (Limited AudioWorklet support)

### Required Features
- **Web Audio API**: AudioContext, AudioWorkletNode
- **WebAssembly**: WASM module support
- **File API**: Audio file upload and decoding
- **MediaDevices**: Microphone access for detection

## Development Setup

### Prerequisites
```bash
# Install Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

### Building the WASM Module
```bash
# Build simplified demo version (current)
./build_simple_wasm.sh

# Future: Build real AudioWmark library (when dependencies resolved)
./build_real_wasm.sh
```

### Running the Application
```bash
cd wasm
python3 -m http.server 8000
# Open http://localhost:8000 in browser
```

## Known Limitations

### Current Demo Limitations
- **Audible watermarks**: FSK carriers are clearly audible
- **Simple encoding**: Basic frequency-shift keying instead of advanced spectral techniques
- **Limited robustness**: No error correction or synchronization
- **Educational only**: Not suitable for production watermarking applications

### WebAssembly Constraints
- **External dependencies**: Real AudioWmark requires libgcrypt, FFTW, etc.
- **System libraries**: No access to OS-specific cryptographic functions
- **Memory limitations**: WASM heap size constraints
- **Threading**: Limited multithreading support in AudioWorklet context

## Future Roadmap

### Short-term Goals
1. **Improve watermark quality**: Reduce audible artifacts in demo mode
2. **Better frequency analysis**: More sophisticated detection algorithms
3. **Error handling**: Enhanced user feedback and error recovery
4. **Performance optimization**: Reduce CPU usage and memory allocation

### Long-term Vision
1. **Real AudioWmark integration**: Port core algorithms without external dependencies
2. **Advanced spectral processing**: Implement spread spectrum techniques in pure JavaScript/WASM
3. **Multiple watermark types**: Support different watermarking schemes
4. **Production-ready quality**: Imperceptible watermarks suitable for real applications

## API Reference

### Main Application Class
```javascript
class SimpleAudioWmarkApp {
    constructor()                           // Initialize application
    async initialize()                      // Load WASM and setup audio
    async startSender()                     // Begin watermark embedding
    async startReceiver()                   // Begin watermark detection
    stopSender()                           // Stop embedding
    stopReceiver()                         // Stop detection
}
```

### WASM Functions
```cpp
// Watermarker (C++ exported to WASM)
void* create_simple_watermarker(int sr, int ch, double strength, char* hex)
int process_simple_frame(void* wm, float* in, float* out, int size, int ch)
void destroy_simple_watermarker(void* watermarker)

// Detector (C++ exported to WASM)
void* create_simple_detector(int sr, int ch)
int detect_simple_frame(void* det, float* in, int size, int ch)
char* get_detection_result(void* detector, double* confidence)
```

## Contributing

This is a demonstration project showing WebAssembly audio processing capabilities. While the current implementation uses simplified watermarking, it provides a solid foundation for more advanced techniques.

### Areas for Contribution
1. **Algorithm improvements**: Better frequency analysis and watermark embedding
2. **Performance optimization**: Reduce computational overhead
3. **User interface**: Enhanced controls and visualization
4. **Documentation**: Expand technical documentation and examples
5. **Testing**: Cross-browser compatibility and edge case handling

## License

This project builds upon the AudioWmark library framework. Please refer to the main AudioWmark project for licensing terms and conditions.

## Acknowledgments

- **AudioWmark Project**: Original spectral domain watermarking library
- **Emscripten Team**: WebAssembly compilation toolchain
- **Web Audio API**: Browser audio processing capabilities
- **AudioWorklet Specification**: Low-latency audio processing standard

---

**Note**: This implementation is for educational and demonstration purposes. For production-grade audio watermarking, consider using the full AudioWmark library in a native environment where all dependencies are available.