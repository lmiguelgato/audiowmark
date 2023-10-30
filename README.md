Instructions to compile using CMake:
1. Make sure the following dependencies are installed: `sndfile`, `fftw3`, `gcrypt`, `zita-resampler`
2. `cmake -DMP3_SUPPORT=OFF -DHLS_SUPPORT=OFF -S . -B ./build; cmake --build ./build`
