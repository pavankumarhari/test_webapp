// Initialize the background worker
const worker = new Worker('worker.js');
const runBtn = document.getElementById('runBtn');
let wasmReady = false;

function setIdleButtonState() {
    runBtn.disabled = !wasmReady;
    runBtn.innerText = wasmReady ? 'Run Simulation' : 'Loading Wasm...';
}

// Listen for messages from the worker
worker.onmessage = function(e) {
    if (e.data.type === 'READY') {
        // Wasm is loaded, enable the button
        if (e.data.buildId) {
            console.info(`Loaded Wasm build: ${e.data.buildId}`);
        }
        wasmReady = true;
        setIdleButtonState();
    } 
    else if (e.data.type === 'RESULT') {
        const flatArray = e.data.data;
        const steps = e.data.steps;

        const time = [];
        const y_val = [];

        // De-flatten the 1D array back into two separate columns for Plotly
        for (let i = 0; i < steps; i++) {
            time.push(flatArray[i * 2 + 0]);
            y_val.push(flatArray[i * 2 + 1]);
        }

        // Plotly Configuration using GPU acceleration (scattergl)
        const trace = {
            x: time,
            y: y_val,
            mode: 'lines',
            type: 'scattergl',
            line: { color: 'red' }
        };

        const layout = {
            title: 'Wasm Wave Output (Fundamental + 3rd Harmonic)',
            xaxis: { title: 'Time (s)' },
            yaxis: { title: 'Amplitude' }
        };

        if (!window.Plotly) {
            alert('Plotly failed to load. Please check internet/CDN access and reload.');
            setIdleButtonState();
            return;
        }

        Plotly.newPlot('plot', [trace], layout);
        setIdleButtonState();
    } else if (e.data.type === 'ERROR') {
        if (e.data.buildId) {
            console.info(`Worker build on error: ${e.data.buildId}`);
        }
        console.error('Worker error:', e.data.message);
        alert(`Simulation failed: ${e.data.message}`);
        setIdleButtonState();
    }
};

worker.onerror = function(err) {
    console.error('Uncaught worker error:', err.message);
    alert(`Worker crashed: ${err.message}`);
    setIdleButtonState();
};

// When button is clicked, send inputs to the worker
runBtn.addEventListener('click', () => {
    const A = parseFloat(document.getElementById('A').value);
    const f = parseFloat(document.getElementById('f').value);
    const delt = parseFloat(document.getElementById('delt').value);
    const tend = parseFloat(document.getElementById('tend').value);

    if (!Number.isFinite(A) || !Number.isFinite(f) || !Number.isFinite(delt) || !Number.isFinite(tend)) {
        alert('Please enter valid numeric inputs.');
        return;
    }
    if (delt <= 0 || tend <= 0 || tend < delt) {
        alert('Use positive time values and ensure End Time is greater than Time Step.');
        return;
    }

    runBtn.disabled = true;
    runBtn.innerText = 'Running...';
    worker.postMessage({ A, f, delt, tend });
});
