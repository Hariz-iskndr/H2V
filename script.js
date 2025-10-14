const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const landmarksOutput = document.getElementById('landmarks-output');

// Setup Hands model
const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// Handle results
hands.onResults(onResults);

const capturedData = []; // store all collected samples

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
  landmarksOutput.innerHTML = '';

  if (results.multiHandLandmarks) {
    results.multiHandLandmarks.forEach((landmarks, index) => {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
      drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });

      const flatCoords = landmarks
        .map(lm => [lm.x.toFixed(4), lm.y.toFixed(4), lm.z.toFixed(4)])
        .flat()
        .join(',');

      const handDiv = document.createElement('div');
      handDiv.innerHTML = `Hand ${index + 1}: ${flatCoords}`;
      landmarksOutput.appendChild(handDiv);

      // Store this frame in memory
      window.latestCoords = flatCoords;
    });
  }

  canvasCtx.restore();
}

// Create capture button
const captureButton = document.createElement('button');
captureButton.textContent = '📸 Capture Frame';
captureButton.style = 'position: absolute; top: 10px; left: 10px; z-index: 10; padding: 8px; font-size: 16px;';
document.body.appendChild(captureButton);

// Capture on click
captureButton.addEventListener('click', () => {
  if (window.latestCoords) {
    const label = prompt("Enter label for this gesture (e.g., A, B, C):");
    capturedData.push(`${window.latestCoords},${label}`);
    console.log(`Captured ${label}: ${window.latestCoords}`);
  }
});

// Optional: Download CSV when done
const downloadButton = document.createElement('button');
downloadButton.textContent = '💾 Download CSV';
downloadButton.style = 'position: absolute; top: 50px; left: 10px; z-index: 10; padding: 8px; font-size: 16px;';
document.body.appendChild(downloadButton);

downloadButton.addEventListener('click', () => {
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
