#include <emscripten.h>
#include <stdlib.h>
#include <math.h>

// EMSCRIPTEN_KEEPALIVE tells the compiler not to delete this function
EMSCRIPTEN_KEEPALIVE
float* run_sine_simulation(float A, float f, float delt, float tend) {
    // Calculate total number of data points
    int steps = (int)(tend / delt) + 1;
    
    // Allocate memory for 2 columns (time and y-value)
    float* data = (float*)malloc(steps * 2 * sizeof(float));

    for (int i = 0; i < steps; i++) {
        float t = i * delt;
        float y = A * sin(2.0 * M_PI * f * t) + 0.25 * A * sin(2.0 * M_PI * 5 * f * t);
        
        // Flattened 2D array indexing: [row * num_cols + col]
        data[i * 2 + 0] = t; // Column 0: Time
        data[i * 2 + 1] = y; // Column 1: Amplitude
    }

    // Return the memory address (pointer) to JavaScript
    return data;
}

// Helper function to free memory after JS reads it
EMSCRIPTEN_KEEPALIVE
void free_memory(float* ptr) {
    free(ptr);
}
