/*
 * Example demonstrating the AudioWmark real-time library usage
 * 
 * This example shows how to watermark audio frames in real-time,
 * simulating a typical use case where you receive small audio frames
 * (e.g., 160 samples) and need to output watermarked frames.
 */

#include "audiowmark_realtime.h"
#include <iostream>
#include <vector>
#include <cmath>
#include <fstream>

// Generate a simple test tone
std::vector<float> generate_test_tone(int sample_rate, int channels, size_t num_samples, double frequency) {
    std::vector<float> samples(num_samples * channels);
    
    for (size_t i = 0; i < num_samples; i++) {
        double phase = 2.0 * M_PI * frequency * i / sample_rate;
        float sample = 0.3f * std::sin(phase); // 30% amplitude
        
        for (int ch = 0; ch < channels; ch++) {
            samples[i * channels + ch] = sample;
        }
    }
    
    return samples;
}

// Save samples to a WAV file (simplified version)
void save_wav_file(const std::string& filename, const std::vector<float>& samples, 
                   int sample_rate, int channels) {
    std::ofstream file(filename, std::ios::binary);
    if (!file) {
        std::cerr << "Failed to create " << filename << std::endl;
        return;
    }
    
    // WAV header (simplified)
    uint32_t data_size = samples.size() * sizeof(int16_t);
    uint32_t file_size = 36 + data_size;
    uint16_t audio_format = 1; // PCM
    uint16_t bit_depth = 16;
    uint32_t byte_rate = sample_rate * channels * (bit_depth / 8);
    uint16_t block_align = channels * (bit_depth / 8);
    
    file.write("RIFF", 4);
    file.write(reinterpret_cast<const char*>(&file_size), 4);
    file.write("WAVE", 4);
    file.write("fmt ", 4);
    uint32_t fmt_size = 16;
    file.write(reinterpret_cast<const char*>(&fmt_size), 4);
    file.write(reinterpret_cast<const char*>(&audio_format), 2);
    file.write(reinterpret_cast<const char*>(&channels), 2);
    file.write(reinterpret_cast<const char*>(&sample_rate), 4);
    file.write(reinterpret_cast<const char*>(&byte_rate), 4);
    file.write(reinterpret_cast<const char*>(&block_align), 2);
    file.write(reinterpret_cast<const char*>(&bit_depth), 2);
    file.write("data", 4);
    file.write(reinterpret_cast<const char*>(&data_size), 4);
    
    // Convert float samples to 16-bit PCM
    for (float sample : samples) {
        float clamped = std::max(-1.0f, std::min(1.0f, sample));
        int16_t pcm_sample = static_cast<int16_t>(clamped * 32767.0f);
        file.write(reinterpret_cast<const char*>(&pcm_sample), 2);
    }
    
    std::cout << "Saved " << filename << " (" << samples.size() / channels 
              << " frames, " << channels << " channels)" << std::endl;
}

int main() {
    std::cout << "AudioWmark Real-time Library Example" << std::endl;
    std::cout << "=====================================" << std::endl;
    
    // Configuration
    AudioWmark::Config config(44100, 1, 0.004); // 44.1kHz, mono, 0.4% strength
    
    // Message to watermark
    std::string message = "Hello World!";
    std::string message_hex = AudioWmark::Utils::TextToHex(message);
    std::cout << "Message: \"" << message << "\"" << std::endl;
    std::cout << "Hex: " << message_hex << std::endl;
    
    // Create watermarker
    AudioWmark::RealtimeWatermarker watermarker(config, message_hex);
    
    if (!watermarker.IsInitialized()) {
        std::cerr << "Failed to initialize watermarker!" << std::endl;
        return 1;
    }
    
    std::cout << "Watermarker initialized successfully" << std::endl;
    std::cout << "Recommended frame size: " << watermarker.GetRecommendedFrameSize() << " samples" << std::endl;
    std::cout << "Internal buffer size: " << watermarker.GetInternalBufferSize() << " samples" << std::endl;
    
    // Simulate real-time processing with small frames
    const size_t frame_size = 160; // 10ms at 16kHz, or 3.6ms at 44.1kHz
    const int total_frames = 1000;   // Process 1000 frames
    const double tone_frequency = 440.0; // A4 note
    
    std::vector<float> all_original_samples;
    std::vector<float> all_watermarked_samples;
    
    std::cout << "\nProcessing " << total_frames << " frames of " << frame_size << " samples each..." << std::endl;
    
    for (int frame_idx = 0; frame_idx < total_frames; frame_idx++) {
        // Generate a frame of test audio (sine wave)
        std::vector<float> original_frame = generate_test_tone(
            config.sample_rate, config.channels, frame_size, tone_frequency
        );
        
        // Process the frame through the watermarker
        std::vector<float> watermarked_frame = watermarker.ProcessFrame(original_frame, frame_size);
        
        // Collect samples for output files
        all_original_samples.insert(all_original_samples.end(), 
                                   original_frame.begin(), original_frame.end());
        all_watermarked_samples.insert(all_watermarked_samples.end(), 
                                     watermarked_frame.begin(), watermarked_frame.end());
        
        // Print progress every 100 frames
        if ((frame_idx + 1) % 100 == 0) {
            std::cout << "Processed " << (frame_idx + 1) << " frames" << std::endl;
        }
    }
    
    std::cout << "Processing complete!" << std::endl;
    
    // Save output files
    save_wav_file("original.wav", all_original_samples, config.sample_rate, config.channels);
    save_wav_file("watermarked.wav", all_watermarked_samples, config.sample_rate, config.channels);
    
    // Calculate some statistics
    double original_rms = 0.0, watermarked_rms = 0.0, difference_rms = 0.0;
    size_t sample_count = std::min(all_original_samples.size(), all_watermarked_samples.size());
    
    for (size_t i = 0; i < sample_count; i++) {
        float orig = all_original_samples[i];
        float wm = all_watermarked_samples[i];
        float diff = wm - orig;
        
        original_rms += orig * orig;
        watermarked_rms += wm * wm;
        difference_rms += diff * diff;
    }
    
    original_rms = std::sqrt(original_rms / sample_count);
    watermarked_rms = std::sqrt(watermarked_rms / sample_count);
    difference_rms = std::sqrt(difference_rms / sample_count);
    
    double snr_db = 20.0 * std::log10(original_rms / difference_rms);
    
    std::cout << "\nStatistics:" << std::endl;
    std::cout << "Original RMS: " << original_rms << std::endl;
    std::cout << "Watermarked RMS: " << watermarked_rms << std::endl;
    std::cout << "Watermark SNR: " << snr_db << " dB" << std::endl;
    std::cout << "Total samples processed: " << sample_count << std::endl;
    std::cout << "Duration: " << (sample_count / config.channels) / (double)config.sample_rate << " seconds" << std::endl;
    
    return 0;
}