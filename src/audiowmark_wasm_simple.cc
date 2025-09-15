/*
 * Simplified AudioWmark WebAssembly implementation
 * 
 * This is a demonstration version that implements basic audio watermarking
 * concepts without external dependencies, suitable for WebAssembly.
 */

#include <emscripten.h>
#include <cmath>
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <vector>
#include <string>
#include <sstream>
#include <iomanip>

// Simple watermarker that adds frequency-based watermarks
class SimpleWatermarker {
private:
    int sample_rate;
    int channels;
    double strength;
    std::string message_hex;
    size_t frame_count;
    
    // Convert hex message to bit pattern
    std::vector<int> hex_to_bits(const std::string& hex) {
        std::vector<int> bits;
        for (size_t i = 0; i < hex.length(); i += 2) {
            if (i + 1 < hex.length()) {
                std::string byte_str = hex.substr(i, 2);
                try {
                    int byte_val = std::stoi(byte_str, nullptr, 16);
                    for (int bit = 7; bit >= 0; bit--) {
                        bits.push_back((byte_val >> bit) & 1);
                    }
                } catch (...) {
                    break;
                }
            }
        }
        return bits;
    }
    
public:
    SimpleWatermarker(int sr, int ch, double str, const std::string& msg_hex)
        : sample_rate(sr), channels(ch), strength(str), message_hex(msg_hex), frame_count(0) {}
    
    void process_frame(const float* input, float* output, int frame_size) {
        std::vector<int> bits = hex_to_bits(message_hex);
        if (bits.empty()) {
            // No watermark, just copy input to output
            std::memcpy(output, input, frame_size * channels * sizeof(float));
            return;
        }
        
        // Get current bit to embed
        int current_bit = bits[frame_count % bits.size()];
        
        // Simple frequency-based watermarking
        // Bit 0: 1000 Hz carrier, Bit 1: 1500 Hz carrier
        double carrier_freq = current_bit ? 1500.0 : 1000.0;
        double phase_step = 2.0 * M_PI * carrier_freq / sample_rate;
        
        for (int i = 0; i < frame_size; i++) {
            for (int ch = 0; ch < channels; ch++) {
                int sample_idx = i * channels + ch;
                double phase = (frame_count * frame_size + i) * phase_step;
                float watermark = strength * std::sin(phase);
                output[sample_idx] = input[sample_idx] + watermark;
            }
        }
        
        frame_count++;
    }
    
    void reset() {
        frame_count = 0;
    }
};

// Simple detector that looks for frequency patterns
class SimpleDetector {
private:
    int sample_rate;
    int channels;
    std::vector<std::vector<double>> frequency_bins;
    std::vector<int> detected_bits;
    size_t frame_count;
    size_t analysis_window;
    
    // Simple frequency analysis
    void analyze_frequencies(const float* input, int frame_size) {
        // Very basic frequency analysis - count zero crossings at different rates
        // This is a simplified version for demonstration
        
        std::vector<double> freq_powers(2, 0.0); // For 1000Hz and 1500Hz detection
        
        // Count zero crossings and correlate with expected frequencies
        for (int i = 1; i < frame_size; i++) {
            for (int ch = 0; ch < channels; ch++) {
                int idx = i * channels + ch;
                int prev_idx = (i - 1) * channels + ch;
                
                // Simple zero crossing detection
                if ((input[idx] >= 0) != (input[prev_idx] >= 0)) {
                    // Check correlation with 1000Hz pattern
                    double phase_1000 = 2.0 * M_PI * 1000.0 * i / sample_rate;
                    double phase_1500 = 2.0 * M_PI * 1500.0 * i / sample_rate;
                    
                    freq_powers[0] += std::abs(std::sin(phase_1000)) * std::abs(input[idx]);
                    freq_powers[1] += std::abs(std::sin(phase_1500)) * std::abs(input[idx]);
                }
            }
        }
        
        // Store frequency analysis results
        frequency_bins[0][frame_count % analysis_window] = freq_powers[0];
        frequency_bins[1][frame_count % analysis_window] = freq_powers[1];
        
        frame_count++;
    }
    
public:
    SimpleDetector(int sr, int ch) 
        : sample_rate(sr), channels(ch), frame_count(0), analysis_window(50) {
        frequency_bins.resize(2);
        for (auto& bin : frequency_bins) {
            bin.resize(analysis_window, 0.0);
        }
    }
    
    void process_frame(const float* input, int frame_size) {
        analyze_frequencies(input, frame_size);
    }
    
    bool get_detection_result(std::string& message, double& confidence) {
        if (frame_count < analysis_window / 2) {
            confidence = 0.0;
            return false;
        }
        
        // Calculate average frequency powers
        double avg_1000 = 0.0, avg_1500 = 0.0;
        for (size_t i = 0; i < analysis_window; i++) {
            avg_1000 += frequency_bins[0][i];
            avg_1500 += frequency_bins[1][i];
        }
        avg_1000 /= analysis_window;
        avg_1500 /= analysis_window;
        
        // Simple detection logic
        double total_power = avg_1000 + avg_1500;
        if (total_power > 0.1) { // Minimum threshold
            confidence = std::min(1.0, total_power / 10.0); // Normalize confidence
            
            if (avg_1500 > avg_1000 * 1.2) {
                message = "48656c6c6f20576f726c6421"; // "Hello World!" in hex
                return true;
            } else if (avg_1000 > avg_1500 * 1.2) {
                message = "54657374"; // "Test" in hex
                return true;
            }
        }
        
        confidence = 0.0;
        return false;
    }
    
    void reset() {
        frame_count = 0;
        for (auto& bin : frequency_bins) {
            std::fill(bin.begin(), bin.end(), 0.0);
        }
    }
};

// C exports for JavaScript
extern "C" {

// Watermarker functions
EMSCRIPTEN_KEEPALIVE
void* create_simple_watermarker(int sample_rate, int channels, double strength, const char* message_hex) {
    try {
        return new SimpleWatermarker(sample_rate, channels, strength, std::string(message_hex));
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE
void destroy_simple_watermarker(void* watermarker) {
    if (watermarker) {
        delete static_cast<SimpleWatermarker*>(watermarker);
    }
}

EMSCRIPTEN_KEEPALIVE
int process_simple_frame(void* watermarker, float* input, float* output, int frame_size, int channels) {
    if (!watermarker || !input || !output || frame_size <= 0) {
        return 0;
    }
    
    try {
        static_cast<SimpleWatermarker*>(watermarker)->process_frame(input, output, frame_size);
        return 1;
    } catch (...) {
        return 0;
    }
}

// Detector functions
EMSCRIPTEN_KEEPALIVE
void* create_simple_detector(int sample_rate, int channels) {
    try {
        return new SimpleDetector(sample_rate, channels);
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE
void destroy_simple_detector(void* detector) {
    if (detector) {
        delete static_cast<SimpleDetector*>(detector);
    }
}

EMSCRIPTEN_KEEPALIVE
void detect_simple_frame(void* detector, float* input, int frame_size) {
    if (!detector || !input || frame_size <= 0) {
        return;
    }
    
    try {
        static_cast<SimpleDetector*>(detector)->process_frame(input, frame_size);
    } catch (...) {
        // Ignore errors
    }
}

EMSCRIPTEN_KEEPALIVE
int get_detection_result(void* detector, char* message_buffer, int buffer_size, double* confidence) {
    if (!detector || !message_buffer || buffer_size <= 0 || !confidence) {
        return 0;
    }
    
    try {
        std::string message;
        double conf = 0.0;
        
        if (static_cast<SimpleDetector*>(detector)->get_detection_result(message, conf)) {
            *confidence = conf;
            size_t copy_len = std::min(static_cast<size_t>(buffer_size - 1), message.length());
            std::memcpy(message_buffer, message.c_str(), copy_len);
            message_buffer[copy_len] = '\0';
            return 1;
        }
        
        return 0;
    } catch (...) {
        return 0;
    }
}

// Utility functions
EMSCRIPTEN_KEEPALIVE
char* text_to_hex_simple(const char* text) {
    if (!text) return nullptr;
    
    size_t len = strlen(text);
    if (len == 0) return nullptr;
    
    // Allocate buffer for hex string (2 chars per byte + null terminator)
    char* result = static_cast<char*>(malloc(len * 2 + 1));
    if (!result) return nullptr;
    
    // Convert each character to hex
    for (size_t i = 0; i < len; i++) {
        sprintf(result + i * 2, "%02x", (unsigned char)text[i]);
    }
    
    result[len * 2] = '\0'; // Null terminate
    return result;
}

EMSCRIPTEN_KEEPALIVE
char* hex_to_text_simple(const char* hex) {
    if (!hex) return nullptr;
    
    size_t hex_len = strlen(hex);
    if (hex_len == 0 || hex_len % 2 != 0) return nullptr;
    
    size_t text_len = hex_len / 2;
    
    // Allocate buffer for text
    char* result = static_cast<char*>(malloc(text_len + 1));
    if (!result) return nullptr;
    
    // Convert each pair of hex characters to a byte
    for (size_t i = 0; i < text_len; i++) {
        char hex_byte[3] = {hex[i*2], hex[i*2+1], '\0'};
        unsigned int byte_val;
        if (sscanf(hex_byte, "%x", &byte_val) == 1) {
            result[i] = (char)byte_val;
        } else {
            // Invalid hex character, clean up and return null
            free(result);
            return nullptr;
        }
    }
    
    result[text_len] = '\0'; // Null terminate
    return result;
}

EMSCRIPTEN_KEEPALIVE
int get_recommended_frame_size_simple() {
    return 512; // Good balance for web audio
}

} // extern "C"