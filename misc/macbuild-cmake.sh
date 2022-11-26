#!/bin/bash
set -Eeuo pipefail -x

# install dependencies
brew install autoconf-archive automake libsndfile fftw mpg123 libgcrypt

# build zita-resampler
git clone https://github.com/swesterfeld/zita-resampler
cd zita-resampler
cmake .
make install
cd ..

# build audiowmark
cmake -DMP3_SUPPORT=ON -DHLS_SUPPORT=ON -S . -B ./build
cmake --build ./build
