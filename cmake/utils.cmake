function(custom_target_link_libraries)
    cmake_parse_arguments(ARG "" "TARGET" "API;LIB" ${ARGN})

    FIND_PATH(API_DIR NAMES ${ARG_API}
        PATHS /include /usr/include /usr/local/include /usr/share/include /opt/include
        REQUIRED
    )

    FIND_LIBRARY(LIBRARY NAMES ${ARG_LIB}
        PATHS /usr/lib /lib /usr/local/lib /usr/share/lib /opt/lib /opt/share/lib /var/lib /usr/lib64 /lib64 /usr/local/lib64 /usr/share/lib64 /opt/lib64 /opt/share/lib64 /var/lib64
        REQUIRED
    )

    target_link_libraries(${ARG_TARGET} PRIVATE ${LIBRARY})
    target_include_directories(${ARG_TARGET} PRIVATE ${API_DIR})
endfunction()
