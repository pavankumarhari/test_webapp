// 1. Define Module using 'var' BEFORE importing the Wasm glue code
var Module = {
    onRuntimeInitialized: function() {
        // Tell the main thread that the WebAssembly engine is fully loaded and ready
        postMessage({ type: 'READY' });
    }
};

// 2. Now import Emscripten's generated code. It will attach itself to the 'var Module' above.
importScripts('engine.js');

// 3. Listen for the simulation parameters from the main thread
onmessage = function(e) {
    const { A, f, delt, tend } = e.data;

    // Wrap the C functions so JS can call them
    const run_sim = Module.cwrap('run_sine_simulation', 'number', ['number', 'number', 'number', 'number']);
    const free_mem = Module.cwrap('free_memory', 'void', ['number']);

    // Run the Math! (Returns a memory address)
    const ptr = run_sim(A, f, delt, tend);

    // Calculate how many elements we expect
    const steps = Math.floor(tend / delt) + 1;
    const totalElements = steps * 2; // 2 columns (time and y-value)

    // Read the array from Wasm memory (ptr / 4 aligns the bytes to 32-bit floats)
    const dataArray = Module.HEAPF32.subarray(ptr / 4, (ptr / 4) + totalElements);

    // Copy the array to standard JS memory so we can safely free the Wasm memory
    const result = new Float32Array(dataArray);

    // Free the C memory to prevent RAM leaks
    free_mem(ptr);

    // Send the copied data back to the UI thread for plotting
    postMessage({ type: 'RESULT', data: result, steps: steps });
};
