/*
 * Simple FFT implementation for WebAssembly build
 * This replaces the FFTW dependency with a basic DFT implementation
 */

#include "fft.hh"
#include <cmath>
#include <complex>

#ifdef AUDIOWMARK_WASM

// Simple DFT implementation for WASM (not optimized, but functional)
void simple_dft(const std::vector<float>& input, std::vector<std::complex<float>>& output) {
    const int N = input.size();
    output.resize(N);
    
    for (int k = 0; k < N; k++) {
        std::complex<float> sum(0, 0);
        for (int n = 0; n < N; n++) {
            float angle = -2.0 * M_PI * k * n / N;
            sum += input[n] * std::complex<float>(std::cos(angle), std::sin(angle));
        }
        output[k] = sum;
    }
}

void simple_idft(const std::vector<std::complex<float>>& input, std::vector<float>& output) {
    const int N = input.size();
    output.resize(N);
    
    for (int n = 0; n < N; n++) {
        std::complex<float> sum(0, 0);
        for (int k = 0; k < N; k++) {
            float angle = 2.0 * M_PI * k * n / N;
            sum += input[k] * std::complex<float>(std::cos(angle), std::sin(angle));
        }
        output[n] = sum.real() / N;
    }
}

// WebAssembly FFT processor implementation
FFTProcessor::FFTProcessor(int block_size) : m_block_size(block_size) {
    // Simple initialization
}

FFTProcessor::~FFTProcessor() {
    // Simple cleanup
}

void FFTProcessor::fft(const std::vector<float>& in, std::vector<std::complex<float>>& out) {
    simple_dft(in, out);
}

void FFTProcessor::ifft(const std::vector<std::complex<float>>& in, std::vector<float>& out) {
    simple_idft(in, out);
}

#endif // AUDIOWMARK_WASM