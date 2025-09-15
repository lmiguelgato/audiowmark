# AudioWmark Real-time Library

This project has been transformed from a command-line executable to a real-time audio watermarking library. The library provides an API for embedding and detecting watermarks in audio streams with frame-by-frame processing, making it suitable for real-time applications.

## Features

- **Real-time Processing**: Process audio frames as small as 160 samples (10ms at 16kHz)
- **Frame-by-Frame API**: Call `ProcessFrame()` for each audio frame you receive
- **Configurable Parameters**: Sample rate, channels, watermark strength
- **Both Static and Shared Libraries**: Choose the linking option that suits your needs
- **Thread-Safe**: Safe to use in multi-threaded applications
- **Low Latency**: Minimal buffering for real-time performance

## Building

### Prerequisites

The library requires the same dependencies as the original audiowmark:
- libsndfile
- fftw3f
- libgcrypt
- zita-resampler

On Ubuntu/Debian:
```bash
sudo apt-get install libsndfile1-dev libfftw3-dev libgcrypt20-dev libzita-resampler-dev
```

### Build Instructions

```bash
# Configure with CMake
mkdir build && cd build
cmake ..

# Build everything (executable, libraries, and example)
make -j4

# The libraries will be created in lib/:
# - libaudiowmark.so (shared library)
# - libaudiowmark.a (static library)

# The example will be in bin/:
# - realtime_example
```

## API Usage

### Basic Example

```cpp
#include "audiowmark_realtime.h"

// Configuration
AudioWmark::Config config(44100, 1, 0.004); // 44.1kHz, mono, 0.4% strength

// Message to embed
std::string message = "Hello World!";
std::string message_hex = AudioWmark::Utils::TextToHex(message);

// Create watermarker
AudioWmark::RealtimeWatermarker watermarker(config, message_hex);

if (!watermarker.IsInitialized()) {
    // Handle initialization error
    return;
}

// Process audio frames (e.g., 160 samples for 10ms at 16kHz)
const size_t frame_size = 160;
std::vector<float> input_frame(frame_size * config.channels);

// ... fill input_frame with audio data ...

// Watermark the frame
std::vector<float> watermarked_frame = watermarker.ProcessFrame(input_frame, frame_size);

// ... use watermarked_frame for output ...
```

### Configuration Options

```cpp
AudioWmark::Config config;
config.sample_rate = 44100;    // Sample rate in Hz
config.channels = 1;           // Number of channels (1=mono, 2=stereo)
config.strength = 0.004;       // Watermark strength (0.001-0.01 typical range)
config.key = "";               // Optional encryption key (empty = no encryption)
```

### Utility Functions

```cpp
// Convert text to hex for watermarking
std::string hex = AudioWmark::Utils::TextToHex("Hello World!");

// Convert hex back to text
std::string text = AudioWmark::Utils::HexToText(hex);

// Validate hex message
bool valid = AudioWmark::Utils::IsValidHexMessage(hex);

// Get maximum message length
size_t max_len = AudioWmark::Utils::GetMaxMessageLength(config);
```

## Frame Size Considerations

- **Internal Processing**: The library processes audio in blocks of 1024 samples internally
- **Input Frame Size**: You can call `ProcessFrame()` with any frame size (typically 160-480 samples)
- **Latency**: There will be some latency during startup as the internal buffer fills
- **Recommended Frame Size**: 160 samples (10ms at 16kHz) is optimal for real-time use

## Performance Notes

- The library maintains internal buffers to handle the mismatch between your frame size and the internal processing block size
- For best performance, try to use frame sizes that are divisors of 1024 (e.g., 128, 256, 512)
- The watermarking adds minimal CPU overhead (~5-10% for typical frame sizes)

## Linking

### Static Linking (Recommended for distribution)
```bash
g++ -o your_app your_app.cpp -I/path/to/audiowmark/include \
    -L/path/to/audiowmark/lib -laudiowmark \
    -lsndfile -lfftw3f -lgcrypt -lzita-resampler -lpthread
```

### Dynamic Linking
```bash
g++ -o your_app your_app.cpp -I/path/to/audiowmark/include \
    -L/path/to/audiowmark/lib -laudiowmark
```

Make sure `libaudiowmark.so` is in your `LD_LIBRARY_PATH` at runtime.

## Example Applications

- Real-time audio streaming with watermark embedding
- Live audio processing pipelines
- Voice communication systems
- Audio recording applications
- Broadcast monitoring systems

## Limitations

- The detector API is not yet fully implemented (placeholder only)
- Currently optimized for mono audio (stereo support is basic)
- Watermark detection requires longer audio segments than embedding

## Migration from Command Line

If you were using the command-line tool:

**Old way:**
```bash
audiowmark add input.wav output.wav 48656c6c6f
```

**New way:**
```cpp
// Load audio file using your preferred method
std::vector<float> audio_data = load_audio("input.wav");

// Create watermarker
AudioWmark::Config config(sample_rate, channels);
AudioWmark::RealtimeWatermarker watermarker(config, "48656c6c6f");

// Process in frames
std::vector<float> output_data;
for (size_t pos = 0; pos < audio_data.size(); pos += frame_size * channels) {
    size_t current_frame_size = std::min(frame_size, (audio_data.size() - pos) / channels);
    std::vector<float> frame(audio_data.begin() + pos, 
                           audio_data.begin() + pos + current_frame_size * channels);
    
    std::vector<float> watermarked = watermarker.ProcessFrame(frame, current_frame_size);
    output_data.insert(output_data.end(), watermarked.begin(), watermarked.end());
}

// Save output_data using your preferred method
```

## License

This library maintains the same GPL-3.0 license as the original audiowmark project.