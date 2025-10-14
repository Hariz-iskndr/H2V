const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const landmarksOutput = document.getElementById('landmarks-output');
const predictionOutput = document.getElementById('prediction-output');

const API_URL = 'http://localhost:8000';

// Setup Hands model
const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

hands.onResults(onResults);

const capturedData = [];
let isPredicting = false;
let batchMode = false;
let batchLabel = '';
let batchCount = 0;

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    
    drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
    drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

    const flatCoords = landmarks.map(lm => [lm.x, lm.y, lm.z]).flat();
    const flatCoordsStr = flatCoords.map(v => v.toFixed(4)).join(',');

    landmarksOutput.textContent = `Landmarks: ${flatCoordsStr.substring(0, 100)}...`;

    window.latestCoords = flatCoordsStr;
    window.latestCoordsArray = flatCoords;
    
    if (isPredicting && window.latestCoordsArray) {
      predictGesture(window.latestCoordsArray);
    }
  } else {
    landmarksOutput.textContent = 'No hand detected';
    predictionOutput.innerHTML = '<div style="color: #999;">Waiting for hand...</div>';
  }

  canvasCtx.restore();
}

async function predictGesture(landmarks) {
  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ landmarks: landmarks })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    displayPrediction(data);
    
  } catch (error) {
    console.error('Prediction error:', error);
    predictionOutput.innerHTML = `<div style="color: #ff4444;">⚠️ Server error: ${error.message}</div>`;
  }
}

function displayPrediction(data) {
  const confidencePercent = (data.confidence * 100).toFixed(1);
  const confidenceColor = data.confidence > 0.7 ? '#00ff00' : data.confidence > 0.5 ? '#ffaa00' : '#ff4444';
  
  const CONFIDENCE_THRESHOLD = 0.6;
  
  let html = '';
  
  if (data.confidence < CONFIDENCE_THRESHOLD) {
    html = `
      <div style="margin: 10px 0;">
        <div style="font-size: 32px; color: #999; margin: 10px 0;">
          Unclear Gesture
        </div>
        <div style="font-size: 16px; color: #666;">
          Best guess: ${data.gesture} (${confidencePercent}%)
        </div>
        <div style="font-size: 14px; color: #999; margin-top: 10px;">
          Make a clearer gesture or show A, B, C, D, E
        </div>
      </div>
    `;
  } else {
    html = `
      <div style="margin: 10px 0;">
        <div style="font-size: 48px; font-weight: bold; color: ${confidenceColor}; margin: 10px 0;">
          ${data.gesture}
        </div>
        <div style="font-size: 18px; color: #666;">
          Confidence: ${confidencePercent}%
        </div>
        <div style="width: 100%; height: 20px; background: #eee; border-radius: 10px; margin: 10px 0; overflow: hidden;">
          <div style="width: ${confidencePercent}%; height: 100%; background: ${confidenceColor}; transition: width 0.3s;"></div>
        </div>
      </div>
    `;
  }
  
  const sorted = Object.entries(data.all_probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  html += '<div style="font-size: 12px; color: #999; margin-top: 10px;">Other possibilities:</div>';
  sorted.forEach(([gesture, prob]) => {
    if (gesture !== data.gesture) {
      html += `<div style="font-size: 14px; color: #666;">${gesture}: ${(prob * 100).toFixed(1)}%</div>`;
    }
  });
  
  predictionOutput.innerHTML = html;
}

// ===== UI CONTROLS =====

const modeButton = document.createElement('button');
modeButton.textContent = '🎥 Start Prediction Mode';
modeButton.style = 'position: absolute; top: 10px; left: 10px; z-index: 10; padding: 10px 20px; font-size: 16px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;';
document.body.appendChild(modeButton);

modeButton.addEventListener('click', () => {
  isPredicting = !isPredicting;
  
  if (isPredicting) {
    modeButton.textContent = '⏸️ Stop Prediction';
    modeButton.style.background = '#f44336';
    document.getElementById('capture-controls').style.display = 'none';
  } else {
    modeButton.textContent = '🎥 Start Prediction Mode';
    modeButton.style.background = '#4CAF50';
    document.getElementById('capture-controls').style.display = 'block';
    predictionOutput.innerHTML = '<div style="color: #999;">Prediction paused</div>';
  }
});

// Container for capture controls
const controlsDiv = document.createElement('div');
controlsDiv.id = 'capture-controls';
controlsDiv.style = 'position: absolute; top: 60px; left: 10px; z-index: 10;';
document.body.appendChild(controlsDiv);

// Batch mode toggle
const batchToggle = document.createElement('button');
batchToggle.textContent = '⚡ Start Batch Mode';
batchToggle.style = 'padding: 10px 20px; font-size: 16px; background: #9E9E9E; color: white; border: none; border-radius: 5px; cursor: pointer; display: block; margin-bottom: 10px; width: 200px;';
controlsDiv.appendChild(batchToggle);

// Label input (hidden initially)
const labelInput = document.createElement('input');
labelInput.type = 'text';
labelInput.placeholder = 'Enter label (e.g., A)';
labelInput.style = 'padding: 8px; font-size: 14px; border: 2px solid #ddd; border-radius: 5px; width: 184px; display: none; margin-bottom: 10px;';
controlsDiv.appendChild(labelInput);

// Capture button
const captureBtn = document.createElement('button');
captureBtn.textContent = '📸 Capture Frame';
captureBtn.style = 'padding: 10px 20px; font-size: 16px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; display: block; margin-bottom: 10px; width: 200px;';
controlsDiv.appendChild(captureBtn);

// Status display
const statusDiv = document.createElement('div');
statusDiv.style = 'padding: 8px; background: #f0f0f0; border-radius: 5px; font-size: 14px; color: #333; margin-bottom: 10px; width: 184px; text-align: center;';
statusDiv.textContent = 'Total: 0 samples';
controlsDiv.appendChild(statusDiv);

// Download button
const downloadBtn = document.createElement('button');
downloadBtn.textContent = '💾 Download CSV';
downloadBtn.style = 'padding: 10px 20px; font-size: 16px; background: #FF9800; color: white; border: none; border-radius: 5px; cursor: pointer; display: block; width: 200px;';
controlsDiv.appendChild(downloadBtn);

// Batch mode toggle
batchToggle.addEventListener('click', () => {
  batchMode = !batchMode;
  
  if (batchMode) {
    batchToggle.textContent = '⏹️ Stop Batch Mode';
    batchToggle.style.background = '#f44336';
    labelInput.style.display = 'block';
    labelInput.focus();
    batchCount = 0;
  } else {
    batchToggle.textContent = '⚡ Start Batch Mode';
    batchToggle.style.background = '#9E9E9E';
    labelInput.style.display = 'none';
    labelInput.value = '';
    batchLabel = '';
    if (batchCount > 0) {
      alert(`Batch complete! Captured ${batchCount} samples.`);
    }
    batchCount = 0;
    captureBtn.textContent = '📸 Capture Frame';
  }
});

// Update batch label when typing
labelInput.addEventListener('input', (e) => {
  batchLabel = e.target.value.trim();
  if (batchLabel) {
    captureBtn.textContent = `📸 Capture "${batchLabel}"`;
  } else {
    captureBtn.textContent = '📸 Capture Frame';
  }
});

// Capture button
captureBtn.addEventListener('click', () => {
  if (!window.latestCoords) {
    alert('No hand detected!');
    return;
  }

  if (batchMode && batchLabel) {
    // Batch mode - use current label
    capturedData.push(`${window.latestCoords},${batchLabel}`);
    batchCount++;
    statusDiv.textContent = `"${batchLabel}": ${batchCount} | Total: ${capturedData.length}`;
    
    // Visual feedback
    captureBtn.style.background = '#4CAF50';
    setTimeout(() => {
      captureBtn.style.background = '#2196F3';
    }, 150);
    
  } else if (!batchMode) {
    // Normal mode - ask for label
    const label = prompt("Enter label:");
    if (label) {
      capturedData.push(`${window.latestCoords},${label}`);
      statusDiv.textContent = `Total: ${capturedData.length} samples`;
      alert(`✓ Captured "${label}"!`);
    }
  } else {
    alert('Please enter a label first!');
    labelInput.focus();
  }
});

// Download button
downloadBtn.addEventListener('click', () => {
  if (capturedData.length === 0) {
    alert('No data captured yet!');
    return;
  }

  const csvContent = 'data:text/csv;charset=utf-8,' + capturedData.join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'hand_gesture_data.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  
  alert(`✓ Downloaded ${capturedData.length} samples!`);
});

// Setup Camera
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480
});
camera.start();

// Check server connection
async function checkServerConnection() {
  try {
    const response = await fetch(`${API_URL}/`);
    const data = await response.json();
    console.log('✓ Server connected:', data);
    
    const gesturesResponse = await fetch(`${API_URL}/gestures`);
    const gesturesData = await gesturesResponse.json();
    console.log('✓ Available gestures:', gesturesData.gestures);
  } catch (error) {
    console.warn('⚠️ Server not connected.');
  }
}

checkServerConnection();