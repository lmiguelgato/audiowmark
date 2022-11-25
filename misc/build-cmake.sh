#!/bin/bash
set -Eeuo pipefail

build()
{
  echo "###############################################################################"
  echo "# BUILD TESTS :"
  echo "#   CC=$CC CXX=$CXX "
  echo "###############################################################################"
  $CXX --version | sed '/^[[:space:]]*$/d;s/^/#   /'
  echo "###############################################################################"
  apt-get install -y libgcrypt20-dev
  apt-get install -y libsndfile1-dev
  cmake -DMP3_SUPPORT=OFF -DHLS_SUPPORT=OFF -S . -B ./build
  cmake --build ./build
}

# Tests using gcc
export CC=gcc CXX=g++

build
#make -j `nproc` distcheck

# Tests clang
export CC=clang CXX=clang++

build
