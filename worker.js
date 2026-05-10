// 1. Load the Emscripten glue code FIRST. 
// This lets Emscripten declare the 'Module' variable natively without any conflicts.
importScripts('engine.js');

// Bump this when shipping worker changes so deployed version is easy to verify.
const WORKER_BUILD_ID = 'worker-2026-05-10-heapfix-v1';

// 2. Now that 'Module' safely exists, we attach our ready listener to it.
Module.onRuntimeInitialized = function() {
    postMessage({ type: 'READY', buildId: WORKER_BUILD_ID });
};

// 3. Listen for the simulation parameters from the main thread
onmessage = function(e) {
    try {
        const { A, f, delt, tend } = e.data;

        // Wrap the C functions so JS can call them
        const run_sim = Module.cwrap('run_sine_simulation', 'number', ['number', 'number', 'number', 'number']);
        const free_mem = Module.cwrap('free_memory', 'void', ['number']);

        // Run the Math! (Returns a memory address)
        const ptr = run_sim(A, f, delt, tend);
        if (!ptr) {
            throw new Error('Wasm returned a null pointer.');
        }

        // Calculate how many elements we expect
        const steps = Math.floor(tend / delt) + 1;
        const totalElements = steps * 2; // 2 columns (time and y-value)

        // Access heap view through Module first; fall back to legacy global if available.
        const heapF32 = Module.HEAPF32 || (typeof HEAPF32 !== 'undefined' ? HEAPF32 : undefined);
        if (!heapF32) {
            free_mem(ptr);
            throw new Error('Wasm heap is not initialized (HEAPF32 unavailable).');
        }

        // Read the array from Wasm memory (ptr / 4 aligns the bytes to 32-bit floats)
        const dataArray = heapF32.subarray(ptr / 4, (ptr / 4) + totalElements);

        // Copy the array to standard JS memory so we can safely free the Wasm memory
        const result = new Float32Array(dataArray);

        // Free the C memory to prevent RAM leaks
        free_mem(ptr);

        // Send the copied data back to the UI thread for plotting
        postMessage({ type: 'RESULT', data: result, steps: steps, buildId: WORKER_BUILD_ID });
    } catch (err) {
        postMessage({
            type: 'ERROR',
            buildId: WORKER_BUILD_ID,
            message: err && err.message ? err.message : String(err)
        });
    }
};
