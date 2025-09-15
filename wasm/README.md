# AudioWmark WebAssembly Demo

## Overview

This is a web-based demonstration of the AudioWmark audio watermarking system. It includes both a **sender** (watermark embedder) and **receiver** (watermark detector) running in real-time in your web browser using WebAssembly.

## Features

- **Real-time audio watermarking**: Embed watermarks into audio signals
- **Live watermark detection**: Detect watermarks from microphone input
- **WebAssembly performance**: Fast processing using compiled C++ code
- **No external dependencies**: Self-contained implementation
- **Adjustable parameters**: Volume, sensitivity, frequency settings

## How to Use

### Starting the Application

1. Navigate to `http://localhost:8080` in your web browser
2. Grant microphone permissions when prompted
3. Wait for the system to initialize

### Sender (Watermark Embedder)

1. **Enter a message**: Type the text you want to embed as a watermark
2. **Adjust settings**:
   - **Tone Frequency**: Base frequency for the audio tone (440Hz default)
   - **Volume**: Output volume level (50% default)
3. **Start Sender**: Click "Start Sender" to begin playing a tone with the embedded watermark
4. **Stop Sender**: Click "Stop Sender" to stop playback

### Receiver (Watermark Detector)

1. **Adjust sensitivity**: Set detection threshold (0.3 default = 30% confidence)
2. **Start Receiver**: Click "Start Receiver" to begin listening for watermarks
3. **Detection results**: When a watermark is detected, you'll see:
   - The decoded message
   - Confidence level (as percentage)
   - Visual confidence meter
4. **Stop Receiver**: Click "Stop Receiver" to stop detection

### Testing the System

**Basic Test (same device):**
1. Start the receiver first
2. Then start the sender
3. You should see watermark detection results appear

**Advanced Test (two devices):**
1. Open the application on two devices
2. Use one as sender, one as receiver
3. Place devices close to each other
4. Test watermark transmission through air

## Technical Details

### Audio Processing
- **Sample Rate**: 44.1 kHz (standard audio quality)
- **Frame Size**: 512 samples (optimized for web browsers)
- **Latency**: ~11.6ms per frame
- **Algorithm**: Frequency-domain watermarking using sine wave carriers

### Watermarking Method
- Uses two carrier frequencies (1000Hz and 1500Hz)
- Embeds data by modulating signal amplitude
- Simple but effective for demonstration purposes
- No external library dependencies

### Browser Requirements
- Modern web browser with WebAssembly support
- Microphone access for receiver functionality
- HTTPS or localhost for microphone permissions

## System Information

The application displays real-time system information:
- **Sample Rate**: Audio processing sample rate
- **Frame Size**: Number of samples processed per frame
- **Latency**: Processing delay per frame
- **Frames Processed**: Total frames processed since start

## Troubleshooting

### No audio output
- Check system volume and browser audio settings
- Ensure no other applications are blocking audio

### Microphone not working
- Grant microphone permissions in browser
- Check system microphone settings
- Try refreshing the page and granting permissions again

### Low detection rates
- Increase sender volume
- Decrease receiver sensitivity threshold
- Ensure minimal background noise
- Test with devices closer together

### Performance issues
- Close other browser tabs
- Use a modern browser with good WebAssembly support
- Check if system has sufficient CPU resources

## File Structure

```
wasm/
├── audiowmark.js           # Generated WebAssembly glue code
├── audiowmark.wasm         # Compiled WebAssembly module
├── audiowmark_simple_app.js # Main application JavaScript
├── index.html              # Web interface
└── README.md              # This documentation
```

## Building from Source

To rebuild the WebAssembly module:

```bash
# Ensure Emscripten is installed and activated
source /path/to/emsdk/emsdk_env.sh

# Run the build script
./build_simple_wasm.sh
```

## License

This demonstration is based on the AudioWmark project. Please refer to the main project repository for licensing information.

## Limitations

This simplified implementation:
- Uses basic frequency-domain watermarking (not the full AudioWmark algorithm)
- Has limited robustness compared to the full system
- Is optimized for demonstration rather than production use
- May not work well with compressed audio or noisy environments

For production applications, use the full AudioWmark library with proper audio codecs and enhanced robustness features.