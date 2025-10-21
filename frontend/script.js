const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const landmarksOutput = document.getElementById('landmarks-output');
const predictionOutput = document.getElementById('prediction-output');

let API_URL = 'http://localhost:8000';
// Detect if mobile (must be before defaultSettings)
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
  document.documentElement.classList.add('is-mobile'); // or document.body.classList.add(...)
} else {
  document.documentElement.classList.remove('is-mobile');
}

// ===== Settings / Theme =====
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const themeToggle = document.getElementById('toggle-theme');
const uiFontSize = document.getElementById('ui-font-size');
const uiContrast = document.getElementById('ui-contrast');

// Prediction controls
const predThresholdEl = document.getElementById('pred-threshold');

// Detection controls
const detDetectConfEl = document.getElementById('det-detect-conf');
const detTrackConfEl = document.getElementById('det-track-conf');
const detModelEl = document.getElementById('det-model');
const detMaxHandsEl = document.getElementById('det-max-hands');

// Camera controls
const camFacingEl = document.getElementById('cam-facing');

// Overlay controls
const ovShowConnectorsEl = document.getElementById('ov-show-connectors');
const ovShowLandmarksEl = document.getElementById('ov-show-landmarks');
const ovLineColorEl = document.getElementById('ov-line-color');
const ovPointColorEl = document.getElementById('ov-point-color');
const ovLineWidthEl = document.getElementById('ov-line-width');
const ovPointSizeEl = document.getElementById('ov-point-size');
const ovFlipEl = document.getElementById('ov-flip');

// Server controls
const serverUrlEl = document.getElementById('server-url');
const serverTestBtn = document.getElementById('server-test');

// Performance controls
const perfShowEl = document.getElementById('perf-show');

// Data controls
const dataAutoMsEl = document.getElementById('data-auto-ms');
const dataTargetEl = document.getElementById('data-target');
const dataCountdownEl = document.getElementById('data-countdown');

// Settings tools
const settingsResetBtn = document.getElementById('settings-reset');
const settingsExportBtn = document.getElementById('settings-export');
const settingsImportBtn = document.getElementById('settings-import');

// Helper: style range inputs with filled track
function setupRangeFill(rangeEl, minOverride, maxOverride) {
  if (!rangeEl) return;
  try {
    rangeEl.classList.add('with-fill');
    const updateFill = () => {
      const min = minOverride != null ? minOverride : parseFloat(rangeEl.min || '0');
      const max = maxOverride != null ? maxOverride : parseFloat(rangeEl.max || '1');
      const val = parseFloat(rangeEl.value);
      const pct = ((val - min) / (max - min)) * 100;
      rangeEl.style.setProperty('--fill', pct + '%');
    };
    rangeEl.addEventListener('input', updateFill);
    updateFill();
  } catch {}
}

const defaultSettings = {
  theme: 'dark',
  uiFontSize: 'normal',
  uiContrast: false,
  prediction: { threshold: 0.6 },
  detection: { detect: 0.7, track: 0.7, model: 1, maxHands: 2 },
  camera: { facing: isMobile ? 'environment' : 'user' },
  overlay: { connectors: true, landmarks: true, lineColor: '#00ff00', pointColor: '#ff0000', lineWidth: 5, pointSize: 2, flip: true },
  server: { url: 'http://localhost:8000' },
  performance: { showFps: false },
  data: { autoMs: 0, target: 0, countdown: 0 }
};

let settings = { ...defaultSettings };

function loadSettings() {
  try {
    const raw = localStorage.getItem('h2v-settings');
    if (raw) settings = { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
}

function saveSettings() {
  localStorage.setItem('h2v-settings', JSON.stringify(settings));
}

function applyTheme(theme) {
  const rootEl = document.documentElement;
  const isLight = theme === 'light';
  rootEl.classList.toggle('theme-light', isLight);

  // Update meta theme-color
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', isLight ? '#f8fbff' : '#0e1320');
  }
}

function loadThemePreference() {
  const saved = settings.theme;
  const theme = saved || 'dark';
  applyTheme(theme);
  themeToggle.checked = theme === 'light';
}

function saveThemePreference(theme) {
  settings.theme = theme;
  saveSettings();
}

settingsBtn.addEventListener('click', () => {
  const isOpen = settingsPanel.classList.toggle('open');
  settingsPanel.setAttribute('aria-hidden', String(!isOpen));
});

themeToggle.addEventListener('change', (e) => {
  const theme = e.target.checked ? 'light' : 'dark';
  applyTheme(theme);
  saveThemePreference(theme);
});

// UI scale/contrast
function applyUiPrefs() {
  document.body.style.fontSize = settings.uiFontSize === 'large' ? '18px' : settings.uiFontSize === 'xl' ? '20px' : '';
  const container = document.querySelector('.container');
  if (container) container.style.filter = settings.uiContrast ? 'contrast(1.1) saturate(1.05)' : '';
}

function bindUiControls() {
  uiFontSize.value = settings.uiFontSize;
  uiContrast.checked = settings.uiContrast;
  uiFontSize.addEventListener('change', () => { settings.uiFontSize = uiFontSize.value; applyUiPrefs(); saveSettings(); });
  uiContrast.addEventListener('change', () => { settings.uiContrast = uiContrast.checked; applyUiPrefs(); saveSettings(); });
}

// Prediction controls binding
function bindPredictionControls() {
  predThresholdEl.value = settings.prediction.threshold;
  predThresholdEl.addEventListener('input', () => { settings.prediction.threshold = parseFloat(predThresholdEl.value); saveSettings(); });
  // Style range fill for visibility
  setupRangeFill(predThresholdEl);
}

// Detection controls binding and application
function applyHandsOptions() {
  hands.setOptions({
    maxNumHands: settings.detection.maxHands,
    modelComplexity: settings.detection.model,
    minDetectionConfidence: settings.detection.detect,
    minTrackingConfidence: settings.detection.track
  });
}

function bindDetectionControls() {
  detDetectConfEl.value = settings.detection.detect;
  detTrackConfEl.value = settings.detection.track;
  detModelEl.value = String(settings.detection.model);
  detMaxHandsEl.value = String(settings.detection.maxHands);
  detDetectConfEl.addEventListener('input', () => { settings.detection.detect = parseFloat(detDetectConfEl.value); applyHandsOptions(); saveSettings(); });
  detTrackConfEl.addEventListener('input', () => { settings.detection.track = parseFloat(detTrackConfEl.value); applyHandsOptions(); saveSettings(); });
  detModelEl.addEventListener('change', () => {
    settings.detection.model = parseInt(detModelEl.value, 10);
    applyHandsOptions();
    saveSettings();
  });
  detMaxHandsEl.addEventListener('change', () => { settings.detection.maxHands = parseInt(detMaxHandsEl.value, 10); applyHandsOptions(); saveSettings(); });
  setupRangeFill(detDetectConfEl);
  setupRangeFill(detTrackConfEl);
}

// Camera handling
let camera;
let inFlight = false;

async function restartCamera() {
  if (camera) {
    try { camera.stop(); } catch {}
  }
  const config = {
    onFrame: async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await hands.send({ image: videoElement });
      } finally {
        inFlight = false;
      }
    }
  };
  const facingMode = settings.camera.facing;
  if (facingMode) config.facingMode = { ideal: facingMode };
  // Don't specify width/height to allow native camera resolution
  camera = new Camera(videoElement, config);
  camera.start();
}

// Wake lock removed

function bindCameraControls() {
  camFacingEl.value = settings.camera.facing;
  camFacingEl.addEventListener('change', () => { settings.camera.facing = camFacingEl.value; saveSettings(); restartCamera(); });
}

// Overlay controls
let drawOptions = { showConnectors: true, showLandmarks: true, lineColor: '#00FF00', pointColor: '#FF0000', lineWidth: 5, pointSize: 2 };

function applyOverlaySettings() {
  drawOptions.showConnectors = settings.overlay.connectors;
  drawOptions.showLandmarks = settings.overlay.landmarks;
  drawOptions.lineColor = settings.overlay.lineColor;
  drawOptions.pointColor = settings.overlay.pointColor;
  drawOptions.lineWidth = settings.overlay.lineWidth;
  drawOptions.pointSize = settings.overlay.pointSize;
  canvasElement.style.transform = settings.overlay.flip ? 'scaleX(-1)' : 'none';
  videoElement.style.transform = settings.overlay.flip ? 'scaleX(-1)' : 'none';
}

function bindOverlayControls() {
  ovShowConnectorsEl.checked = settings.overlay.connectors;
  ovShowLandmarksEl.checked = settings.overlay.landmarks;
  ovLineColorEl.value = settings.overlay.lineColor;
  ovPointColorEl.value = settings.overlay.pointColor;
  ovLineWidthEl.value = settings.overlay.lineWidth;
  ovPointSizeEl.value = settings.overlay.pointSize;
  ovFlipEl.checked = settings.overlay.flip;
  ovShowConnectorsEl.addEventListener('change', () => { settings.overlay.connectors = ovShowConnectorsEl.checked; applyOverlaySettings(); saveSettings(); });
  ovShowLandmarksEl.addEventListener('change', () => { settings.overlay.landmarks = ovShowLandmarksEl.checked; applyOverlaySettings(); saveSettings(); });
  ovLineColorEl.addEventListener('input', () => { settings.overlay.lineColor = ovLineColorEl.value; applyOverlaySettings(); saveSettings(); });
  ovPointColorEl.addEventListener('input', () => { settings.overlay.pointColor = ovPointColorEl.value; applyOverlaySettings(); saveSettings(); });
  ovLineWidthEl.addEventListener('input', () => { settings.overlay.lineWidth = parseInt(ovLineWidthEl.value, 10); applyOverlaySettings(); saveSettings(); });
  ovPointSizeEl.addEventListener('input', () => { settings.overlay.pointSize = parseInt(ovPointSizeEl.value, 10); applyOverlaySettings(); saveSettings(); });
  ovFlipEl.addEventListener('change', () => { settings.overlay.flip = ovFlipEl.checked; applyOverlaySettings(); saveSettings(); });
  setupRangeFill(ovLineWidthEl, 1, 8);
  setupRangeFill(ovPointSizeEl, 1, 6);
}

// Server controls removed

// Reset only
function bindSettingsTools() {
  settingsResetBtn.addEventListener('click', () => {
    settings = { ...defaultSettings };
    saveSettings();
    location.reload();
  });
}

// Detect if mobile (already declared above)

// Responsive canvas sizing
function resizeCanvas() {
  const container = document.querySelector('.container');
  const maxWidth = Math.min(container.clientWidth - 30, 640);
  const aspectRatio = 480 / 640;
  
  canvasElement.style.width = maxWidth + 'px';
  canvasElement.style.height = (maxWidth * aspectRatio) + 'px';
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => {
  setTimeout(resizeCanvas, 100);
});
resizeCanvas();

// Setup Hands model
const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }
});

hands.setOptions({
  maxNumHands: 2,
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
    // Draw all detected hands based on overlay settings
    results.multiHandLandmarks.forEach((landmarks) => {
      if (drawOptions.showConnectors) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: drawOptions.lineColor, lineWidth: drawOptions.lineWidth });
      }
      if (drawOptions.showLandmarks) {
        drawLandmarks(canvasCtx, landmarks, { color: drawOptions.pointColor, lineWidth: Math.max(1, drawOptions.pointSize - 1) });
      }
    });
    
    // Use the first detected hand for prediction/capture
    const landmarks = results.multiHandLandmarks[0];
    const flatCoords = landmarks.map(lm => [lm.x, lm.y, lm.z]).flat();
    const flatCoordsStr = flatCoords.map(v => v.toFixed(4)).join(',');

    landmarksOutput.textContent = `Landmarks (Hand 1/${results.multiHandLandmarks.length}): ${flatCoordsStr.substring(0, 100)}...`;

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
    predictionOutput.innerHTML = `<div style="color: #ff6b6b;">⚠️ Server error: ${error.message}</div>`;
  }
}

function displayPrediction(data) {
  const confidencePercent = (data.confidence * 100).toFixed(1);
  const confidenceColor = data.confidence > 0.7 ? '#3DFF9B' : data.confidence > 0.5 ? '#FFC857' : '#FF6B6B';
  
  const CONFIDENCE_THRESHOLD = settings.prediction.threshold ?? 0.6;
  
  let html = '';
  
  if (data.confidence < CONFIDENCE_THRESHOLD) {
    html = `
      <div style="margin: 10px 0;">
        <div style="font-size: 32px; color: #a8b0c7; margin: 10px 0;">
          Unclear Gesture
        </div>
        <div style="font-size: 16px; color: #b6bed3;">
          Best guess: ${data.gesture} (${confidencePercent}%)
        </div>
        <div style="font-size: 14px; color: #8e96ad; margin-top: 10px;">
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
        <div style="font-size: 18px; color: #cbd3ea;">
          Confidence: ${confidencePercent}%
        </div>
        <div style="width: 100%; height: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; margin: 10px 0; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);">
          <div style="width: ${confidencePercent}%; height: 100%; background: ${confidenceColor}; transition: width 0.4s ease; box-shadow: 0 0 16px ${confidenceColor}55;"></div>
        </div>
      </div>
    `;
  }
  
  const sorted = Object.entries(data.all_probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  html += '<div style="font-size: 12px; color: #a0a8c2; margin-top: 10px;">Other possibilities:</div>';
  sorted.forEach(([gesture, prob]) => {
    if (gesture !== data.gesture) {
      html += `<div style=\"font-size: 14px; color: #c3cbe3;\">${gesture}: ${(prob * 100).toFixed(1)}%</div>`;
    }
  });
  
  predictionOutput.innerHTML = html;
}

// ===== UI CONTROLS =====

const modeButton = document.createElement('button');
modeButton.id = 'mode-btn-mobile';
modeButton.className = 'control-button';
modeButton.textContent = isMobile ? '🎥 Predict' : '🎥 Start Prediction Mode';
document.body.appendChild(modeButton);

// place prediction button on the left side for mobile
if (isMobile) {
  Object.assign(modeButton.style, {
    position: 'fixed',
    left: '12px',      // moved to left
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: '1100',
    width: '52px',
    height: '52px',
    padding: '0',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    lineHeight: '1',
  });
  // ensure any right value from CSS is cleared and force left
  modeButton.style.setProperty('right', 'auto', 'important');
  modeButton.style.setProperty('left', '12px', 'important');

  // compact label for small screens
  modeButton.textContent = '🎥';
}

modeButton.addEventListener('click', () => {
  isPredicting = !isPredicting;
  
  if (isPredicting) {
    modeButton.textContent = isMobile ? '⏸️ Stop' : '⏸️ Stop Prediction';
    modeButton.style.background = '#f44336';
    controlsDiv.style.display = 'none';
  } else {
    modeButton.textContent = isMobile ? '🎥 Predict' : '🎥 Start Prediction Mode';
    modeButton.style.background = '#4CAF50';
    controlsDiv.style.display = 'flex';
    predictionOutput.innerHTML = '<div style="color: #999;">Prediction paused</div>';
  }
});

// Container for capture controls
const controlsDiv = document.createElement('div');
controlsDiv.id = 'capture-controls';
document.body.appendChild(controlsDiv);

// Batch mode toggle
const batchToggle = document.createElement('button');
batchToggle.textContent = isMobile ? '⚡ Batch' : '⚡ Start Batch Mode';
batchToggle.style.background = '#9E9E9E';
controlsDiv.appendChild(batchToggle);

// Label input (hidden initially)
const labelInput = document.createElement('input');
labelInput.type = 'text';
labelInput.placeholder = 'Label (e.g., A)';
labelInput.style.display = 'none';
controlsDiv.appendChild(labelInput);

// Capture button
const captureBtn = document.createElement('button');
captureBtn.textContent = '📸 Capture';
captureBtn.style.background = '#2196F3';
controlsDiv.appendChild(captureBtn);

// Status display
const statusDiv = document.createElement('div');
statusDiv.style.background = '#f0f0f0';
statusDiv.style.color = '#333';
statusDiv.style.padding = '10px';
statusDiv.style.borderRadius = '8px';
statusDiv.style.fontSize = 'clamp(12px, 3vw, 14px)';
statusDiv.style.textAlign = 'center';
statusDiv.textContent = 'Total: 0';
controlsDiv.appendChild(statusDiv);

// Download button
const downloadBtn = document.createElement('button');
downloadBtn.textContent = '💾 Download';
downloadBtn.style.background = '#FF9800';
controlsDiv.appendChild(downloadBtn);

// Batch mode toggle
batchToggle.addEventListener('click', () => {
  batchMode = !batchMode;
  
  if (batchMode) {
    batchToggle.textContent = isMobile ? '⏹️ Stop' : '⏹️ Stop Batch Mode';
    batchToggle.style.background = '#f44336';
    labelInput.style.display = 'block';
    labelInput.focus();
    batchCount = 0;
  } else {
    batchToggle.textContent = isMobile ? '⚡ Batch' : '⚡ Start Batch Mode';
    batchToggle.style.background = '#9E9E9E';
    labelInput.style.display = 'none';
    labelInput.value = '';
    batchLabel = '';
    if (batchCount > 0) {
      alert(`Batch complete! Captured ${batchCount} samples.`);
    }
    batchCount = 0;
    captureBtn.textContent = isMobile ? '📸 Capture' : '📸 Capture Frame';
  }
});

// Update batch label when typing
labelInput.addEventListener('input', (e) => {
  batchLabel = e.target.value.trim();
  if (batchLabel) {
    captureBtn.textContent = isMobile ? `📸 ${batchLabel}` : `📸 Capture "${batchLabel}"`;
  } else {
    captureBtn.textContent = isMobile ? '📸 Capture' : '📸 Capture Frame';
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

// Initialize camera via settings-aware flow
restartCamera();

// Check server connection
async function checkServerConnection() {
  try {
    const response = await fetch(`${API_URL}/`);
    const data = await response.json();
    console.log('Server connected:', data);
    
    const gesturesResponse = await fetch(`${API_URL}/gestures`);
    const gesturesData = await gesturesResponse.json();
    console.log('✓ Available gestures:', gesturesData.gestures);
  } catch (error) {
    console.warn(' Server not connected.');
    if (isMobile) {
      console.warn('http://192.168.1.100:8000'); // API URL
    }
  }
}

// Settings boot sequence
loadSettings();
loadThemePreference();
applyUiPrefs();
bindUiControls();
bindPredictionControls();
bindDetectionControls();
bindCameraControls();
bindOverlayControls();
// Server controls removed
bindSettingsTools();
applyOverlaySettings();
applyHandsOptions();
manageWakeLock();

// Performance overlay removed

checkServerConnection();