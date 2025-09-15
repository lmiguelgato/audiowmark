/*
 * Test to verify library compatibility with original executable
 */

#include "audiowmark_realtime.h"
#include <iostream>
#include <vector>
#include <cmath>
#include <fstream>
#include <cstdint>

// Generate a simple test signal: sine wave
std::vector<float> generate_sine_wave(int sample_rate, int channels, double duration, double frequency) {
    size_t total_samples = static_cast<size_t>(duration * sample_rate) * channels;
    std::vector<float> samples(total_samples);
    
    for (size_t i = 0; i < total_samples; i += channels) {
        size_t frame_index = i / channels;
        double phase = 2.0 * M_PI * frequency * frame_index / sample_rate;
        float sample_value = 0.3f * std::sin(phase);
        
        for (int ch = 0; ch < channels; ch++) {
            samples[i + ch] = sample_value;
        }
    }
    
    return samples;
}

// Save as proper WAV file compatible with the original tool
bool save_wav_file(const std::string& filename, const std::vector<float>& samples, 
                   int sample_rate, int channels) {
    std::ofstream file(filename, std::ios::binary);
    if (!file) {
        std::cerr << "Failed to create " << filename << std::endl;
        return false;
    }
    
    // WAV header
    uint32_t num_samples = samples.size();
    uint32_t data_size = num_samples * sizeof(int16_t);
    uint32_t file_size = 36 + data_size;
    uint16_t audio_format = 1; // PCM
    uint16_t num_channels = static_cast<uint16_t>(channels);
    uint32_t sample_rate_u32 = static_cast<uint32_t>(sample_rate);
    uint16_t bits_per_sample = 16;
    uint32_t byte_rate = sample_rate_u32 * num_channels * (bits_per_sample / 8);
    uint16_t block_align = num_channels * (bits_per_sample / 8);
    
    // RIFF header
    file.write("RIFF", 4);
    file.write(reinterpret_cast<const char*>(&file_size), 4);
    file.write("WAVE", 4);
    
    // fmt chunk
    file.write("fmt ", 4);
    uint32_t fmt_size = 16;
    file.write(reinterpret_cast<const char*>(&fmt_size), 4);
    file.write(reinterpret_cast<const char*>(&audio_format), 2);
    file.write(reinterpret_cast<const char*>(&num_channels), 2);
    file.write(reinterpret_cast<const char*>(&sample_rate_u32), 4);
    file.write(reinterpret_cast<const char*>(&byte_rate), 4);
    file.write(reinterpret_cast<const char*>(&block_align), 2);
    file.write(reinterpret_cast<const char*>(&bits_per_sample), 2);
    
    // data chunk
    file.write("data", 4);
    file.write(reinterpret_cast<const char*>(&data_size), 4);
    
    // Convert and write sample data
    for (float sample : samples) {
        float clamped = std::max(-1.0f, std::min(1.0f, sample));
        int16_t pcm_sample = static_cast<int16_t>(clamped * 32767.0f);
        file.write(reinterpret_cast<const char*>(&pcm_sample), 2);
    }
    
    return true;
}

int main() {
    std::cout << "AudioWmark Library Compatibility Test" << std::endl;
    std::cout << "=====================================" << std::endl;
    
    // Configuration matching the original tool defaults
    const int sample_rate = 44100;
    const int channels = 1;
    const double duration = 5.0; // 5 seconds
    const double frequency = 440.0; // A4 note
    const std::string message_hex = "48656c6c6f20576f726c6421"; // "Hello World!"
    
    // Generate test audio
    std::cout << "Generating " << duration << "s test audio at " << sample_rate << "Hz..." << std::endl;
    std::vector<float> original_audio = generate_sine_wave(sample_rate, channels, duration, frequency);
    
    // Save original
    if (!save_wav_file("test_original.wav", original_audio, sample_rate, channels)) {
        return 1;
    }
    std::cout << "Saved test_original.wav" << std::endl;
    
    // Create watermarker
    AudioWmark::Config config(sample_rate, channels, 0.004);
    AudioWmark::RealtimeWatermarker watermarker(config, message_hex);
    
    if (!watermarker.IsInitialized()) {
        std::cerr << "Failed to initialize watermarker!" << std::endl;
        return 1;
    }
    
    // Process with our library using the same frame size as the original tool would use
    std::cout << "Watermarking with library (frame-by-frame processing)..." << std::endl;
    const size_t frame_size = 1024; // Same as Params::frame_size
    std::vector<float> watermarked_audio;
    watermarked_audio.reserve(original_audio.size());
    
    for (size_t pos = 0; pos < original_audio.size(); pos += frame_size * channels) {
        size_t remaining_samples = original_audio.size() - pos;
        size_t current_frame_samples = std::min(frame_size * channels, remaining_samples);
        size_t current_frame_size = current_frame_samples / channels;
        
        if (current_frame_size == 0) break;
        
        std::vector<float> frame(original_audio.begin() + pos, 
                               original_audio.begin() + pos + current_frame_samples);
        
        // Pad frame if needed
        if (frame.size() < frame_size * channels) {
            frame.resize(frame_size * channels, 0.0f);
        }
        
        std::vector<float> watermarked_frame = watermarker.ProcessFrame(frame, frame_size);
        
        // Only add the samples we actually had
        watermarked_audio.insert(watermarked_audio.end(), 
                                watermarked_frame.begin(), 
                                watermarked_frame.begin() + current_frame_samples);
    }
    
    // Save watermarked version
    if (!save_wav_file("test_watermarked_lib.wav", watermarked_audio, sample_rate, channels)) {
        return 1;
    }
    std::cout << "Saved test_watermarked_lib.wav" << std::endl;
    
    // Calculate SNR
    double original_power = 0.0, diff_power = 0.0;
    size_t common_size = std::min(original_audio.size(), watermarked_audio.size());
    
    for (size_t i = 0; i < common_size; i++) {
        double orig = original_audio[i];
        double wm = watermarked_audio[i];
        double diff = wm - orig;
        
        original_power += orig * orig;
        diff_power += diff * diff;
    }
    
    double snr_db = 10.0 * std::log10(original_power / diff_power);
    
    std::cout << "SNR: " << snr_db << " dB" << std::endl;
    std::cout << "Processed " << common_size / channels << " audio frames" << std::endl;
    std::cout << "\nTo test detection with original tool, run:" << std::endl;
    std::cout << "./bin/audiowmark get test_watermarked_lib.wav" << std::endl;
    
    return 0;
}