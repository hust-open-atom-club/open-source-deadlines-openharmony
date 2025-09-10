# the minimum version of CMake.
cmake_minimum_required(VERSION 3.13)
set(CMAKE_VERBOSE_MAKEFILE on)

file(GLOB rnoh_async_storage_SRC CONFIGURE_DEPENDS *.cpp)
add_library(rnoh_async_storage SHARED ${rnoh_async_storage_SRC})
target_include_directories(rnoh_async_storage PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(rnoh_async_storage PUBLIC rnoh)