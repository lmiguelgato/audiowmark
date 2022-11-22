cmake_minimum_required(VERSION 3.16 FATAL_ERROR)
project(audiowmark CXX C)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Setup output directories.
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_CURRENT_LIST_DIR}/bin)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_CURRENT_LIST_DIR}/lib)
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_CURRENT_LIST_DIR}/lib)

set(OUTPUT_NAME audiowmark)

set(PACKAGE_NAME "audiowmark")
set(PACKAGE_VERSION "0.6.1")

set(COMMON_SRC
    ${CMAKE_CURRENT_LIST_DIR}/src/utils.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/utils.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/convcode.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/convcode.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/random.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/random.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/wavdata.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/wavdata.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/audiostream.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/audiostream.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/sfinputstream.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/sfinputstream.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/stdoutwavoutputstream.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/stdoutwavoutputstream.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/sfoutputstream.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/sfoutputstream.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/rawinputstream.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/rawinputstream.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/rawoutputstream.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/rawoutputstream.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/rawconverter.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/rawconverter.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/mp3inputstream.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/mp3inputstream.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/wmcommon.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/wmcommon.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/fft.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/fft.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/limiter.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/limiter.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/shortcode.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/shortcode.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/mpegts.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/mpegts.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/hls.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/hls.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/audiobuffer.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/wmget.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/wmadd.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/syncfinder.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/syncfinder.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/wmspeed.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/wmspeed.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/threadpool.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/threadpool.hh
    ${CMAKE_CURRENT_LIST_DIR}/src/resample.cc
    ${CMAKE_CURRENT_LIST_DIR}/src/resample.hh
)

#================= WASM TARGET ==================#
add_executable(${OUTPUT_NAME}
    ${CMAKE_CURRENT_LIST_DIR}/src/audiowmark.cc
    ${COMMON_SRC}
)

find_package (Threads)

target_link_libraries(${OUTPUT_NAME} PRIVATE
    sndfile # https://github.com/libsndfile/sndfile-tools
    fftw3f # http://fftw.org/download.html
    gcrypt # https://github.com/ShiftMediaProject/libgcrypt
    mpg123 # http://mpg123.org/snapshot
    zita-resampler # https://github.com/digital-stage/zita-resampler
    ${CMAKE_THREAD_LIBS_INIT} # pthread
    #ffmpeg is optional
)

set(VERSION ${PACKAGE_VERSION})
configure_file(${CMAKE_CURRENT_LIST_DIR}/config.h.in ${CMAKE_CURRENT_LIST_DIR}/config.h @ONLY)

target_include_directories(${OUTPUT_NAME} PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/src
    ${CMAKE_CURRENT_LIST_DIR}
)

# TODO: get these 👇 from current platform
target_compile_definitions(${OUTPUT_NAME} PRIVATE
    HAVE_CXX14=1                # whether the compiler supports basic C++14 syntax
    HAVE_DLFCN_H=1              # whether the <dlfcn.h> header file is available
    HAVE_FFMPEG=0               # whether ffmpeg libs are available
    HAVE_INTTYPES_H=1           # whether the <inttypes.h> header file is available
    HAVE_LIBZITA_RESAMPLER=1    # whether the `zita-resampler' library is available
    HAVE_MEMORY_H=1             # whether the <memory.h> header file is available
    HAVE_STDINT_H=1             # whether the <stdint.h> header file is available
    HAVE_STDLIB_H=1             # whether the <stdlib.h> header file is available
    HAVE_STRINGS_H=1            # whether the <strings.h> header file is available
    HAVE_STRING_H=1             # whether the <string.h> header file is available
    HAVE_SYS_STAT_H=1           # whether the <sys/stat.h> header file is available
    HAVE_SYS_TYPES_H=1          # whether the <sys/types.h> header file is available
    HAVE_UNISTD_H=1             # whether the <unistd.h> header file is available
    SPECTMORPH_HAVE_FFTW=1      # whether libfftw3 is available
    STDC_HEADERS=1              # whether ANSI C header files are available
)

target_compile_options(${OUTPUT_NAME} PRIVATE -g -O2 -Wall)
