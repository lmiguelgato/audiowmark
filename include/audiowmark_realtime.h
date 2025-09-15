/*
 * AudioWmark Real-time Library API
 * 
 * This header provides a real-time audio watermarking API that can process
 * audio frames incrementally, suitable for real-time applications.
 */

#ifndef AUDIOWMARK_REALTIME_H
#define AUDIOWMARK_REALTIME_H

#include <vector>
#include <string>
#include <memory>

namespace AudioWmark {

/**
 * Configuration for the watermarking process
 */
struct Config {
    int sample_rate = 44100;       // Sample rate (e.g., 44100, 48000)
    int channels = 1;              // Number of audio channels (1 = mono, 2 = stereo)
    double strength = 0.004;       // Watermark strength (higher = more audible but robust)
    std::string key;               // Optional encryption key (empty = no encryption)
    
    Config() = default;
    Config(int rate, int ch, double str = 0.004) 
        : sample_rate(rate), channels(ch), strength(str) {}
};

/**
 * Real-time audio watermarking processor
 * 
 * This class maintains internal state to process audio frames incrementally.
 * Each call to ProcessFrame() accepts a small audio frame and returns the
 * watermarked version.
 */
class RealtimeWatermarker {
public:
    /**
     * Create a watermarker with the given configuration and message
     * 
     * @param config Audio configuration (sample rate, channels, etc.)
     * @param message_hex Hexadecimal string of the message to embed
     */
    RealtimeWatermarker(const Config& config, const std::string& message_hex);
    
    /**
     * Destructor
     */
    ~RealtimeWatermarker();
    
    /**
     * Check if the watermarker was initialized successfully
     */
    bool IsInitialized() const;
    
    /**
     * Process a frame of audio samples
     * 
     * @param input_samples Input audio samples (interleaved for multi-channel)
     * @param frame_size Number of samples per channel (e.g., 160 for 10ms at 16kHz)
     * @return Watermarked audio samples (same size as input)
     * 
     * Note: Total input size should be frame_size * channels
     */
    std::vector<float> ProcessFrame(const std::vector<float>& input_samples, size_t frame_size);
    
    /**
     * Process a frame of audio samples (in-place version)
     * 
     * @param samples Input/output audio samples buffer (modified in-place)
     * @param frame_size Number of samples per channel
     */
    void ProcessFrameInPlace(std::vector<float>& samples, size_t frame_size);
    
    /**
     * Reset the internal state (useful when processing a new audio stream)
     */
    void Reset();
    
    /**
     * Get the recommended minimum frame size for efficient processing
     */
    size_t GetRecommendedFrameSize() const;
    
    /**
     * Get the internal buffer size (frames that are buffered internally)
     */
    size_t GetInternalBufferSize() const;

private:
    class Impl;
    std::unique_ptr<Impl> pImpl;
};

/**
 * Real-time audio watermark detector
 * 
 * This class can detect and extract watermarks from audio frames in real-time.
 */
class RealtimeDetector {
public:
    /**
     * Create a detector with the given configuration
     */
    RealtimeDetector(const Config& config);
    
    /**
     * Destructor
     */
    ~RealtimeDetector();
    
    /**
     * Check if the detector was initialized successfully
     */
    bool IsInitialized() const;
    
    /**
     * Process a frame of audio samples for watermark detection
     * 
     * @param input_samples Input audio samples to analyze
     * @param frame_size Number of samples per channel
     */
    void ProcessFrame(const std::vector<float>& input_samples, size_t frame_size);
    
    /**
     * Get the current detection result
     * 
     * @param detected_message Output parameter for the detected message (if any)
     * @param confidence Output parameter for detection confidence (0.0-1.0)
     * @return true if a watermark was detected with sufficient confidence
     */
    bool GetDetectionResult(std::string& detected_message, double& confidence) const;
    
    /**
     * Reset the detector state
     */
    void Reset();

private:
    class Impl;
    std::unique_ptr<Impl> pImpl;
};

/**
 * Utility functions
 */
namespace Utils {
    /**
     * Convert a text message to hexadecimal format suitable for watermarking
     */
    std::string TextToHex(const std::string& text);
    
    /**
     * Convert a hexadecimal watermark message back to text
     */
    std::string HexToText(const std::string& hex);
    
    /**
     * Validate if a hex string is valid for watermarking
     */
    bool IsValidHexMessage(const std::string& hex);
    
    /**
     * Get the maximum message length for the given configuration
     */
    size_t GetMaxMessageLength(const Config& config);
}

} // namespace AudioWmark

#endif // AUDIOWMARK_REALTIME_H