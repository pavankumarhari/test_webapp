// Bump this when rebuilding to avoid stale browser/worker cache.
const WASM_BUILD_ID = 'harmonic-v1';
const Module = {
    locateFile: (path) => `${path}?build=${encodeURIComponent(WASM_BUILD_ID)}`
};

// Load the Emscripten glue code
importScripts(`engine.js?build=${encodeURIComponent(WASM_BUILD_ID)}`);

// Wait until Wasm is fully loaded before accepting messages
Module.onRuntimeInitialized = () => {
    postMessage({ type: 'READY', buildId: WASM_BUILD_ID });
};

// Surface initialization failures to the UI.
Module.onAbort = (reason) => {
    postMessage({ type: 'ERROR', message: `Wasm aborted: ${String(reason)}` });
};

// Listen for inputs from the main thread
onmessage = function(e) {
    try {
        const { A, f, delt, tend } = e.data;

        // Wrap the C functions so JS can call them
        const run_sim = Module.cwrap('run_sine_simulation', 'number', ['number', 'number', 'number', 'number']);
        const free_mem = Module.cwrap('free_memory', 'void', ['number']);

        // 1. Run the Math! (Returns a memory address)
        const ptr = run_sim(A, f, delt, tend);
        if (!ptr) {
            throw new Error('Simulation returned a null pointer.');
        }

        // 2. Calculate how many elements we expect
        const steps = Math.floor(tend / delt) + 1;
        const totalElements = steps * 2; // 2 columns (t and y)

        // 3. Read the array from Wasm memory (ptr / 4 aligns bytes to float indices).
        // Some Emscripten builds expose HEAPF32 globally, not as Module.HEAPF32.
        const heapF32 = Module.HEAPF32 || (typeof HEAPF32 !== 'undefined' ? HEAPF32 : null);
        if (!heapF32) {
            throw new Error('Wasm heap view (HEAPF32) is unavailable.');
        }
        const dataArray = heapF32.subarray(ptr / 4, (ptr / 4) + totalElements);

        // 4. Copy the array to standard JS memory
        const result = new Float32Array(dataArray);

        // 5. Free the C memory to prevent RAM leaks
        free_mem(ptr);

        // 6. Send the copied data back to the UI thread
        postMessage({ type: 'RESULT', data: result, steps: steps });
    } catch (err) {
        postMessage({
            type: 'ERROR',
            message: err instanceof Error ? err.message : String(err)
        });
    }
};
