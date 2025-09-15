/*
 * AudioWmark Real-time Library Implementation
 */

#include "audiowmark_realtime.h"
#include "wmcommon.hh"
#include "wavdata.hh"
#include "fft.hh"
#include "random.hh"
#include "utils.hh"
#include "limiter.hh"
#include "resample.hh"
#include "audiobuffer.hh"
#include <memory>
#include <iostream>
#include <algorithm>
#include <cmath>
#include <queue>

namespace AudioWmark {

// Helper function to parse hex message to bit vector
std::vector<int> parse_payload(const std::string& hex) {
    std::vector<int> bitvec;
    
    if (hex.empty()) {
        return bitvec;
    }
    
    for (size_t i = 0; i < hex.length(); i += 2) {
        if (i + 1 >= hex.length()) {
            std::cerr << "Error: hex string length must be even" << std::endl;
            return {};
        }
        
        std::string byte_str = hex.substr(i, 2);
        try {
            int byte_value = std::stoi(byte_str, nullptr, 16);
            for (int bit = 7; bit >= 0; bit--) {
                bitvec.push_back((byte_value >> bit) & 1);
            }
        } catch (const std::exception& e) {
            std::cerr << "Error parsing hex string: " << e.what() << std::endl;
            return {};
        }
    }
    
    return bitvec;
}

// Forward declarations for existing classes
enum class FrameMod : uint8_t {
  KEEP = 0,
  UP,
  DOWN
};

struct FrameMod_Frame {
  FrameMod up[Params::bands_per_frame];
  FrameMod down[Params::bands_per_frame];
};

// Simple audio frame buffer for managing different frame sizes
class FrameBuffer {
private:
    std::queue<float> buffer;
    int channels;
    
public:
    FrameBuffer(int n_channels) : channels(n_channels) {}
    
    void push_samples(const std::vector<float>& samples) {
        for (float sample : samples) {
            buffer.push(sample);
        }
    }
    
    std::vector<float> pop_frame(size_t frame_size) {
        std::vector<float> frame;
        size_t samples_needed = frame_size * channels;
        
        if (buffer.size() < samples_needed) {
            return frame; // Not enough samples
        }
        
        frame.reserve(samples_needed);
        for (size_t i = 0; i < samples_needed; i++) {
            frame.push_back(buffer.front());
            buffer.pop();
        }
        
        return frame;
    }
    
    bool has_frame(size_t frame_size) const {
        return buffer.size() >= frame_size * channels;
    }
    
    size_t size() const {
        return buffer.size();
    }
    
    void clear() {
        std::queue<float> empty;
        buffer.swap(empty);
    }
};

// Minimal watermark generator for real-time use
class SimpleWatermarkGen {
private:
    int n_channels;
    int sample_rate;
    std::vector<int> bitvec;
    FFTAnalyzer fft_analyzer;
    FFTProcessor fft_processor;
    std::vector<float> window;
    size_t frame_count;
    double strength;
    Random random;
    
public:
    SimpleWatermarkGen(int channels, int rate, const std::vector<int>& message_bits, double wm_strength) 
        : n_channels(channels), sample_rate(rate), bitvec(message_bits), 
          fft_analyzer(channels), fft_processor(Params::frame_size),
          frame_count(0), strength(wm_strength), random(0, Random::Stream::data_up_down) {
        
        window = FFTAnalyzer::gen_normalized_window(Params::frame_size);
    }
    
    std::vector<float> process_frame(const std::vector<float>& input_samples) {
        if (input_samples.size() != Params::frame_size * n_channels) {
            return input_samples; // Size mismatch
        }
        
        std::vector<float> output_samples(input_samples.size(), 0.0f);
        
        // Simple watermarking: add small amplitude modulation based on message bits
        size_t bit_index = (frame_count / Params::frames_per_bit) % bitvec.size();
        int bit_value = bitvec[bit_index];
        
        // Generate a simple watermark signal
        double freq = 1000.0 + bit_value * 500.0; // 1kHz or 1.5kHz carrier
        double phase_step = 2.0 * M_PI * freq / sample_rate;
        
        for (size_t i = 0; i < input_samples.size(); i += n_channels) {
            double phase = (frame_count * Params::frame_size + i/n_channels) * phase_step;
            float watermark = strength * std::sin(phase);
            
            for (int ch = 0; ch < n_channels; ch++) {
                output_samples[i + ch] = input_samples[i + ch] + watermark;
            }
        }
        
        frame_count++;
        return output_samples;
    }
    
    void reset() {
        frame_count = 0;
    }
};

// Implementation class for RealtimeWatermarker
class RealtimeWatermarker::Impl {
public:
    Config config;
    std::vector<int> bitvec;
    std::unique_ptr<SimpleWatermarkGen> wm_gen;
    std::unique_ptr<FrameBuffer> frame_buffer;
    std::unique_ptr<FrameBuffer> output_buffer;
    std::unique_ptr<Limiter> limiter;
    bool initialized;
    
    Impl(const Config& cfg, const std::string& message_hex)
        : config(cfg), initialized(false) {
        
        // Parse the hex message
        bitvec = parse_payload(message_hex);
        if (bitvec.empty()) {
            std::cerr << "Failed to parse hex message" << std::endl;
            return;
        }
        
        try {
            // Initialize components
            frame_buffer = std::make_unique<FrameBuffer>(config.channels);
            output_buffer = std::make_unique<FrameBuffer>(config.channels);
            wm_gen = std::make_unique<SimpleWatermarkGen>(config.channels, config.sample_rate, bitvec, config.strength);
            limiter = std::make_unique<Limiter>(config.channels, config.sample_rate);
            
            limiter->set_block_size_ms(100.0); // Smaller block size for real-time
            limiter->set_ceiling(0.95);
            
            initialized = true;
        } catch (const std::exception& e) {
            std::cerr << "Error initializing watermarker: " << e.what() << std::endl;
        }
    }
    
    std::vector<float> process_frame(const std::vector<float>& input_samples, size_t frame_size) {
        if (!initialized) {
            return input_samples;
        }
        
        // Add input to buffer
        frame_buffer->push_samples(input_samples);
        
        // Process complete frames of Params::frame_size
        while (frame_buffer->has_frame(Params::frame_size)) {
            std::vector<float> frame = frame_buffer->pop_frame(Params::frame_size);
            
            // Generate watermark
            std::vector<float> watermarked = wm_gen->process_frame(frame);
            
            // Apply limiter
            watermarked = limiter->process(watermarked);
            
            // Add to output buffer
            output_buffer->push_samples(watermarked);
        }
        
        // Return output samples if available
        if (output_buffer->has_frame(frame_size)) {
            return output_buffer->pop_frame(frame_size);
        }
        
        // If not enough output yet, return zeros (latency during startup)
        return std::vector<float>(input_samples.size(), 0.0f);
    }
    
    void reset() {
        if (frame_buffer) frame_buffer->clear();
        if (output_buffer) output_buffer->clear();
        if (wm_gen) wm_gen->reset();
    }
};

// RealtimeWatermarker implementation
RealtimeWatermarker::RealtimeWatermarker(const Config& config, const std::string& message_hex)
    : pImpl(std::make_unique<Impl>(config, message_hex)) {
}

RealtimeWatermarker::~RealtimeWatermarker() = default;

bool RealtimeWatermarker::IsInitialized() const {
    return pImpl && pImpl->initialized;
}

std::vector<float> RealtimeWatermarker::ProcessFrame(const std::vector<float>& input_samples, size_t frame_size) {
    if (!pImpl) {
        return input_samples;
    }
    
    // Validate input
    if (input_samples.size() != frame_size * pImpl->config.channels) {
        std::cerr << "Input size mismatch: expected " << (frame_size * pImpl->config.channels) 
                  << " samples, got " << input_samples.size() << std::endl;
        return input_samples;
    }
    
    return pImpl->process_frame(input_samples, frame_size);
}

void RealtimeWatermarker::ProcessFrameInPlace(std::vector<float>& samples, size_t frame_size) {
    std::vector<float> result = ProcessFrame(samples, frame_size);
    samples = std::move(result);
}

void RealtimeWatermarker::Reset() {
    if (pImpl) {
        pImpl->reset();
    }
}

size_t RealtimeWatermarker::GetRecommendedFrameSize() const {
    // Return a reasonable frame size - typically 160 samples (10ms at 16kHz) or similar
    // But ensure it's compatible with internal processing
    return 160; // This can be made configurable
}

size_t RealtimeWatermarker::GetInternalBufferSize() const {
    return Params::frame_size; // 1024 samples
}

// Placeholder implementation for RealtimeDetector
class RealtimeDetector::Impl {
public:
    Config config;
    bool initialized;
    
    Impl(const Config& cfg) : config(cfg), initialized(true) {
        // TODO: Implement detector
    }
};

RealtimeDetector::RealtimeDetector(const Config& config)
    : pImpl(std::make_unique<Impl>(config)) {
}

RealtimeDetector::~RealtimeDetector() = default;

bool RealtimeDetector::IsInitialized() const {
    return pImpl && pImpl->initialized;
}

void RealtimeDetector::ProcessFrame(const std::vector<float>& input_samples, size_t frame_size) {
    // TODO: Implement detection
}

bool RealtimeDetector::GetDetectionResult(std::string& detected_message, double& confidence) const {
    // TODO: Implement detection result retrieval
    return false;
}

void RealtimeDetector::Reset() {
    // TODO: Implement detector reset
}

// Utility functions
namespace Utils {
    std::string TextToHex(const std::string& text) {
        std::string hex;
        for (char c : text) {
            hex += string_printf("%02x", static_cast<unsigned char>(c));
        }
        return hex;
    }
    
    std::string HexToText(const std::string& hex) {
        std::string text;
        for (size_t i = 0; i < hex.length(); i += 2) {
            if (i + 1 < hex.length()) {
                std::string byte_str = hex.substr(i, 2);
                try {
                    char c = static_cast<char>(std::stoi(byte_str, nullptr, 16));
                    text += c;
                } catch (const std::exception&) {
                    return ""; // Invalid hex
                }
            }
        }
        return text;
    }
    
    bool IsValidHexMessage(const std::string& hex) {
        if (hex.empty() || hex.length() % 2 != 0) {
            return false;
        }
        
        for (char c : hex) {
            if (!std::isxdigit(c)) {
                return false;
            }
        }
        return true;
    }
    
    size_t GetMaxMessageLength(const Config& config) {
        // This depends on the payload size configuration
        return Params::payload_size / 8; // Convert bits to bytes
    }
}

} // namespace AudioWmark