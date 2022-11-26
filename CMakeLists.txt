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

include(${CMAKE_CURRENT_LIST_DIR}/cmake/utils.cmake)

# Add cmake options:
option(MP3_SUPPORT "Support MP3 audio format" OFF)
option(HLS_SUPPORT "Support HTTP Live Streaming" OFF)

message("-- MP3 support: ${MP3_SUPPORT}")
message("-- HLS support: ${HLS_SUPPORT}")

#if(HLS_SUPPORT)
#    message(FATAL_ERROR "HTTP Live Streaming support is not yet implemented")
#endif()

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

if(MP3_SUPPORT)
    list(APPEND COMMON_SRC
        ${CMAKE_CURRENT_LIST_DIR}/src/mp3inputstream.cc
        ${CMAKE_CURRENT_LIST_DIR}/src/mp3inputstream.hh
    )
endif()

if(HLS_SUPPORT)
    list(APPEND COMMON_SRC
        ${CMAKE_CURRENT_LIST_DIR}/src/hls.cc
        ${CMAKE_CURRENT_LIST_DIR}/src/hls.hh
    )
endif()

#================= WASM TARGET ==================#
add_executable(${OUTPUT_NAME}
    ${CMAKE_CURRENT_LIST_DIR}/src/audiowmark.cc
    ${COMMON_SRC}
)

custom_target_link_libraries(TARGET ${OUTPUT_NAME} API sndfile.h LIB sndfile) # https://github.com/libsndfile/sndfile-tools, used by sfinputstream.cc and sfoutputstream.cc for reading/writing audio files
custom_target_link_libraries(TARGET ${OUTPUT_NAME} API fftw3.h LIB fftw3f) # http://fftw.org/download.html, used by fft.cc for the FFT
custom_target_link_libraries(TARGET ${OUTPUT_NAME} API gcrypt.h LIB gcrypt) # https://github.com/ShiftMediaProject/libgcrypt, used by random.cc for encryption
custom_target_link_libraries(TARGET ${OUTPUT_NAME} API zita-resampler LIB zita-resampler) # https://github.com/digital-stage/zita-resampler, used by wmadd.cc and resample.cc for resampling

find_package (Threads)  # std::thread, used by threadpool.cc for multithreading
target_link_libraries(${OUTPUT_NAME} PRIVATE ${CMAKE_THREAD_LIBS_INIT})

target_include_directories(${OUTPUT_NAME} PRIVATE
    ${CMAKE_CURRENT_LIST_DIR}/src
    ${CMAKE_CURRENT_LIST_DIR}
)

## Optional libraries:
if(MP3_SUPPORT)
    # http://mpg123.org/snapshot, used by mp3inputstream.cc for reading mp3 files (optional)
    custom_target_link_libraries(TARGET ${OUTPUT_NAME} API mpg123.h LIB mpg123)
    add_compile_definitions(HAVE_MP3)
endif()

if(HLS_SUPPORT)
    # ffmpeg libraries, used by hls.cc for HTTP Live Streaming (optional)
    custom_target_link_libraries(TARGET ${OUTPUT_NAME} API libavformat LIB avformat)
    custom_target_link_libraries(TARGET ${OUTPUT_NAME} API libavutil LIB avutil)
    custom_target_link_libraries(TARGET ${OUTPUT_NAME} API libswresample LIB swresample)
    custom_target_link_libraries(TARGET ${OUTPUT_NAME} API libavcodec LIB avcodec)
    add_compile_definitions(HAVE_FFMPEG)
endif()

## config.h
set(VERSION ${PACKAGE_VERSION})
configure_file(${CMAKE_CURRENT_LIST_DIR}/config.h.in ${CMAKE_CURRENT_LIST_DIR}/config.h @ONLY)

target_compile_definitions(${OUTPUT_NAME} PRIVATE
    SPECTMORPH_HAVE_FFTW=1      # whether libfftw3 is available
    HAVE_LIBZITA_RESAMPLER=1    # whether the `zita-resampler' library is available

    ## Extra, likely unnecessary definitions:
    STDC_HEADERS=1              # whether ANSI C header files are available (assert.h, errno.h, math.h, stdarg.h, stdint.h, stdio.h)
    HAVE_UNISTD_H=1             # whether the <unistd.h> header file is available
    HAVE_SYS_STAT_H=1           # whether the <sys/stat.h> header file is available
    HAVE_SYS_TYPES_H=1          # whether the <sys/types.h> header file is available
    #HAVE_CXX14=1                # whether the compiler supports basic C++14 syntax
    #HAVE_DLFCN_H=1              # whether the <dlfcn.h> header file is available
    #HAVE_INTTYPES_H=1           # whether the <inttypes.h> header file is available
    #HAVE_MEMORY_H=1             # whether the <memory.h> header file is available
    #HAVE_STDLIB_H=1             # whether the <stdlib.h> header file is available
    #HAVE_STRINGS_H=1            # whether the <strings.h> header file is available
    #HAVE_STRING_H=1             # whether the <string.h> header file is available
)

target_compile_options(${OUTPUT_NAME} PRIVATE -g -O2 -Wall)
