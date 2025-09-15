/*
 * WebAssembly wrapper for AudioWmark real-time library
 * 
 * This provides C-style exports that can be called from JavaScript
 * for real-time audio watermarking in web browsers.
 */

#include "audiowmark_realtime.h"
#include <emscripten.h>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

extern "C" {

// Watermarker functions
EMSCRIPTEN_KEEPALIVE
void* watermarker_create(int sample_rate, int channels, double strength, const char* message_hex) {
    try {
        AudioWmark::Config config(sample_rate, channels, strength);
        std::string msg_hex(message_hex);
        
        auto* watermarker = new AudioWmark::RealtimeWatermarker(config, msg_hex);
        if (!watermarker->IsInitialized()) {
            delete watermarker;
            return nullptr;
        }
        return watermarker;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE
void watermarker_destroy(void* watermarker) {
    if (watermarker) {
        delete static_cast<AudioWmark::RealtimeWatermarker*>(watermarker);
    }
}

EMSCRIPTEN_KEEPALIVE
int watermarker_process_frame(void* watermarker, float* input_samples, float* output_samples, int frame_size) {
    if (!watermarker || !input_samples || !output_samples || frame_size <= 0) {
        return 0;
    }
    
    try {
        auto* wm = static_cast<AudioWmark::RealtimeWatermarker*>(watermarker);
        
        std::vector<float> input(input_samples, input_samples + frame_size);
        std::vector<float> output = wm->ProcessFrame(input, frame_size);
        
        if (output.size() >= static_cast<size_t>(frame_size)) {
            std::memcpy(output_samples, output.data(), frame_size * sizeof(float));
            return 1; // Success
        }
        
        return 0; // Not enough output (startup latency)
    } catch (...) {
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE
void watermarker_reset(void* watermarker) {
    if (watermarker) {
        static_cast<AudioWmark::RealtimeWatermarker*>(watermarker)->Reset();
    }
}

// Detector functions
EMSCRIPTEN_KEEPALIVE
void* detector_create(int sample_rate, int channels) {
    try {
        AudioWmark::Config config(sample_rate, channels);
        auto* detector = new AudioWmark::RealtimeDetector(config);
        if (!detector->IsInitialized()) {
            delete detector;
            return nullptr;
        }
        return detector;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE
void detector_destroy(void* detector) {
    if (detector) {
        delete static_cast<AudioWmark::RealtimeDetector*>(detector);
    }
}

EMSCRIPTEN_KEEPALIVE
void detector_process_frame(void* detector, float* input_samples, int frame_size) {
    if (!detector || !input_samples || frame_size <= 0) {
        return;
    }
    
    try {
        auto* det = static_cast<AudioWmark::RealtimeDetector*>(detector);
        std::vector<float> input(input_samples, input_samples + frame_size);
        det->ProcessFrame(input, frame_size);
    } catch (...) {
        // Ignore errors
    }
}

EMSCRIPTEN_KEEPALIVE
int detector_get_result(void* detector, char* message_buffer, int buffer_size, double* confidence) {
    if (!detector || !message_buffer || buffer_size <= 0 || !confidence) {
        return 0;
    }
    
    try {
        auto* det = static_cast<AudioWmark::RealtimeDetector*>(detector);
        std::string detected_message;
        double conf = 0.0;
        
        if (det->GetDetectionResult(detected_message, conf)) {
            *confidence = conf;
            size_t copy_len = std::min(static_cast<size_t>(buffer_size - 1), detected_message.length());
            std::memcpy(message_buffer, detected_message.c_str(), copy_len);
            message_buffer[copy_len] = '\0';
            return 1; // Found watermark
        }
        
        return 0; // No watermark detected
    } catch (...) {
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE
void detector_reset(void* detector) {
    if (detector) {
        static_cast<AudioWmark::RealtimeDetector*>(detector)->Reset();
    }
}

// Utility functions
EMSCRIPTEN_KEEPALIVE
char* text_to_hex(const char* text) {
    if (!text) return nullptr;
    
    try {
        std::string hex = AudioWmark::Utils::TextToHex(std::string(text));
        char* result = static_cast<char*>(malloc(hex.length() + 1));
        if (result) {
            std::strcpy(result, hex.c_str());
        }
        return result;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE
char* hex_to_text(const char* hex) {
    if (!hex) return nullptr;
    
    try {
        std::string text = AudioWmark::Utils::HexToText(std::string(hex));
        char* result = static_cast<char*>(malloc(text.length() + 1));
        if (result) {
            std::strcpy(result, text.c_str());
        }
        return result;
    } catch (...) {
        return nullptr;
    }
}

EMSCRIPTEN_KEEPALIVE
int validate_hex_message(const char* hex) {
    if (!hex) return 0;
    
    try {
        return AudioWmark::Utils::IsValidHexMessage(std::string(hex)) ? 1 : 0;
    } catch (...) {
        return 0;
    }
}

EMSCRIPTEN_KEEPALIVE
int get_recommended_frame_size() {
    return 512; // Good balance for web audio (about 10-12ms at 44.1kHz)
}

} // extern "C"