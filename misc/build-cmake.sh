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
  cmake -DMP3_SUPPORT=ON -DHLS_SUPPORT=ON -S . -B ./build
  cmake --build ./build
}

# Tests using gcc
export CC=gcc CXX=g++

build
#make -j `nproc` distcheck

# Tests clang
export CC=clang CXX=clang++

build
