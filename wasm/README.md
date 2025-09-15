# AudioWmark Web Application

## ⚠️ IMPORTANT NOTICE - CURRENT IMPLEMENTATION ISSUE

**The current web application is using a simplified FSK-based watermarking implementation instead of the proper AudioWmark spectral watermarking algorithm.** This is why you hear audible FSK tones (at 1000Hz and 1500Hz) when playing watermarked audio.

### Current State vs. Intended Implementation

| Aspect | Current Implementation | Should Be |
|--------|----------------------|-----------|
| **Algorithm** | Simple FSK (Frequency Shift Keying) | AudioWmark Patchwork Algorithm |
| **Frequencies** | Audible tones at 1000Hz/1500Hz | Spectral domain modifications (inaudible) |
| **Source File** | `src/audiowmark_wasm_simple.cc` | `src/audiowmark_wasm.cc` |
| **Audibility** | **Clearly audible FSK tones** | **Virtually inaudible watermarks** |
| **Build Script** | `build_simple_wasm.sh` | `build_wasm.sh` (needs fixing) |

## What This Application Does (Currently)

This is a web-based demonstration of audio watermarking technology. The current implementation:

1. **Embeds digital messages** into audio files or generated tones
2. **Detects embedded messages** from watermarked audio in real-time
3. **Uses Web Audio API** for real-time audio processing
4. **Runs in web browsers** using WebAssembly (WASM)

### Current Features

- **Real-time watermark embedding** with adjustable strength
- **Real-time watermark detection** with confidence levels
- **Dual audio sources**: Generated test tones or uploaded audio files
- **Live audio processing** using AudioWorklets or ScriptProcessorNode
- **Visual feedback** with confidence bars and detection results
- **Responsive web interface** that works on desktop and mobile

## How It Works (Current Implementation)

### Watermark Embedding (Sender)
1. **Audio Input**: Either a generated sine wave tone or an uploaded audio file
2. **Message Encoding**: Text message is converted to hexadecimal
3. **FSK Modulation**: Each bit is encoded as:
   - `0` bit → 1000 Hz carrier wave
   - `1` bit → 1500 Hz carrier wave
4. **Audio Mixing**: The carrier signal is added to the original audio with configurable strength
5. **Real-time Output**: Processed audio is played through speakers

### Watermark Detection (Receiver)
1. **Audio Capture**: Microphone input captures the watermarked audio
2. **Frequency Analysis**: Simple correlation analysis looks for 1000Hz and 1500Hz patterns
3. **Bit Decoding**: Frequency patterns are decoded back to binary data
4. **Message Recovery**: Binary data is converted back to the original text message

## Technical Architecture

### Frontend (JavaScript)
- **Main App**: `audiowmark_simple_app.js` - Manages UI and audio processing
- **WASM Interface**: Wraps WebAssembly functions for JavaScript use
- **Audio Processing**: Uses Web Audio API with AudioWorklets for low-latency processing
- **UI Framework**: Vanilla JavaScript with responsive CSS Grid layout

### Backend (WebAssembly)
- **Source Code**: `src/audiowmark_wasm_simple.cc` ⚠️ *This is the problem!*
- **Implementation**: Custom FSK-based watermarking (not the real AudioWmark algorithm)
- **Build Tool**: Emscripten compiler for C++ to WASM conversion
- **Memory Management**: Manual memory allocation for audio buffers

### Audio Pipeline
```
[Audio Input] → [WASM Processor] → [Audio Output]
     ↓              ↓                    ↓
  Microphone    Watermark           Speakers
  File Upload   Embedding/          Headphones
  Test Tone     Detection
```

## Usage Instructions

### Setup
1. **Serve the files** from a web server (required for WASM and AudioWorklets):
   ```bash
   cd /path/to/audiowmark/wasm
   python3 -m http.server 8080
   ```
2. **Open in browser**: Navigate to `http://localhost:8080`
3. **Enable audio**: Click "Enable Audio & Start App" (required for microphone access)

### Embedding Watermarks (Sender)
1. **Enter message**: Type the text you want to embed (e.g., "Hello World!")
2. **Choose audio source**:
   - **Test Tone**: Select frequency (440Hz, 523Hz, 659Hz, or 880Hz)
   - **Audio Recording**: Upload a WAV, MP3, or other audio file
3. **Adjust volume**: Set playback volume (default 30%)
4. **Start embedding**: Click "🎵 Start Playing & Embedding"
5. **Listen**: You'll hear the original audio **plus audible FSK tones** (this is the bug!)

### Detecting Watermarks (Receiver)
1. **Set sensitivity**: Choose detection threshold (High=50%, Medium=70%, Low=90%)
2. **Start listening**: Click "🎤 Start Listening" to begin microphone capture
3. **Play watermarked audio**: Play audio from the sender (or other source)
4. **View results**: Detection results appear with confidence levels when watermarks are found

### System Information
The app displays real-time statistics:
- **Sample Rate**: Audio processing frequency (typically 44100 Hz)
- **Frame Size**: Audio buffer size (512 samples ≈ 11.6ms at 44.1kHz)
- **Latency**: Audio processing delay
- **Frames Processed**: Total number of audio frames processed

## File Structure

```
wasm/
├── index.html                    # Main web application
├── audiowmark_simple_app.js      # JavaScript application logic
├── audiowmark.js                 # Generated WASM JavaScript wrapper
├── audiowmark.wasm              # Generated WebAssembly binary
├── watermark-sender-processor.js # AudioWorklet for embedding
├── watermark-receiver-processor.js # AudioWorklet for detection
└── README.md                    # This documentation
```

## Browser Compatibility

### Supported Browsers
- **Chrome/Chromium** 66+ (recommended)
- **Firefox** 61+
- **Safari** 14.1+
- **Edge** 79+

### Required Features
- **WebAssembly** support
- **Web Audio API** with AudioWorklets
- **MediaDevices API** for microphone access
- **ES6 Modules** and modern JavaScript

### Known Issues
- **Autoplay policies**: Some browsers require user interaction before audio playback
- **HTTPS requirement**: Microphone access requires HTTPS in production
- **Mobile limitations**: Some mobile browsers have restricted audio capabilities

## Performance Characteristics

### Current Implementation Performance
- **Frame Size**: 512 samples (≈11.6ms at 44.1kHz)
- **Latency**: ~20-50ms total (depending on browser and system)
- **CPU Usage**: Low (simple FSK processing)
- **Memory Usage**: ~16MB initial, up to 128MB maximum
- **Detection Speed**: Near real-time (< 1 second delay)

## The Real AudioWmark Algorithm

The **proper AudioWmark implementation** uses a sophisticated spectral watermarking approach:

### Patchwork Algorithm
- **Frequency Domain**: Works in the spectral domain using FFT
- **Frame Size**: 1024 samples for analysis
- **Pseudo-random Selection**: Randomly selects frequency bins
- **Amplitude Modulation**: Slightly increases/decreases selected frequency amplitudes
- **Perceptual Masking**: Modifications are below audible threshold
- **Error Correction**: Built-in redundancy and error correction

### Key Differences from Current Implementation
| Feature | Current (FSK) | Proper AudioWmark |
|---------|---------------|-------------------|
| Domain | Time domain | Frequency domain (FFT) |
| Audibility | **Clearly audible** | **Inaudible** |
| Robustness | Low | High (survives MP3 compression) |
| Algorithm | Simple carrier tones | Advanced spectral patchwork |
| Frame Size | 512 samples | 1024 samples |
| Dependencies | None | FFTW3, libgcrypt, etc. |

## How to Fix the Implementation

To use the proper AudioWmark algorithm instead of the FSK implementation:

### 1. Build Dependencies
The real AudioWmark requires these libraries:
```bash
sudo apt-get install -y libgcrypt20-dev libsndfile1-dev libfftw3-dev libzita-resampler-dev libmpg123-dev
```

### 2. Use the Correct WASM Source
- **Current**: `src/audiowmark_wasm_simple.cc` (FSK-based, audible)
- **Correct**: `src/audiowmark_wasm.cc` (spectral-based, inaudible)

### 3. Update Build Script
Modify the build script to:
- Use `src/audiowmark_wasm.cc` instead of `src/audiowmark_wasm_simple.cc`
- Link against the real AudioWmark library
- Include necessary dependencies for WebAssembly

### 4. Update JavaScript Interface
The function names and interfaces may differ between the two implementations.

## Development Notes

### Building from Source
```bash
# Current (problematic) build
./build_simple_wasm.sh

# Should use this instead (needs fixing)
./build_wasm.sh
```

### Testing
1. **Functional test**: Verify watermarks can be embedded and detected
2. **Audibility test**: Watermarked audio should sound identical to original
3. **Robustness test**: Watermarks should survive MP3 compression
4. **Performance test**: Real-time processing should work smoothly

### Debugging
- **Browser DevTools**: Check console for WASM loading errors
- **Audio Analysis**: Use spectrum analyzer to verify FSK tones are present
- **Network Issues**: Ensure files are served over HTTP/HTTPS (not file://)
- **Microphone Permissions**: Check browser permissions for microphone access

## Security Considerations

### Current Implementation
- **No encryption**: Messages are embedded as plain text (hex encoded)
- **No authentication**: No way to verify message integrity
- **Easily detectable**: FSK tones are obvious in spectrum analysis

### Proper Implementation Should Include
- **Message authentication**: HMAC or digital signatures
- **Encryption**: Encrypt messages before embedding
- **Key management**: Support for watermarking keys
- **Anti-tampering**: Robust against adversarial attacks

## Future Improvements

1. **Fix the core algorithm**: Replace FSK with proper spectral watermarking
2. **Add file processing**: Support batch processing of audio files
3. **Improve UI**: Better visualization of watermarking process
4. **Mobile optimization**: Better support for mobile devices
5. **Advanced features**: Multiple watermarks, different algorithms, etc.

## Conclusion

This web application demonstrates the concept of real-time audio watermarking but **currently uses an audible FSK-based implementation instead of the sophisticated inaudible spectral watermarking that AudioWmark is known for**.

The FSK implementation serves as a proof-of-concept for the web interface and real-time processing pipeline, but the core watermarking algorithm needs to be replaced with the proper AudioWmark patchwork algorithm to achieve the intended goal of inaudible watermarks.

### Next Steps
1. **Immediate**: Switch to `src/audiowmark_wasm.cc` and fix build dependencies
2. **Short-term**: Test and verify the real AudioWmark algorithm works in the web environment
3. **Long-term**: Add advanced features like file processing and improved security

---

*This README documents the current state as of the investigation. The application framework is solid, but the watermarking algorithm needs to be corrected to use the proper AudioWmark implementation.*