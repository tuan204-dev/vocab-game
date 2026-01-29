// Camera and head tracking module
let faceMesh = null;
let camera = null;
let isTracking = false;
let onTiltCallback = null;
let lastTiltDirection = null;
let tiltDebounceTimer = null;

const TILT_THRESHOLD = 12; // Degrees (lowered for easier detection)
const DEBOUNCE_MS = 800; // Prevent rapid switches

// Initialize MediaPipe Face Mesh
export async function initFaceTracking(videoElement, canvasElement) {
  // Stop any existing camera and faceMesh first
  if (camera) {
    try {
      camera.stop();
    } catch (e) {
      console.warn('Error stopping camera:', e);
    }
    camera = null;
  }
  
  // Close existing FaceMesh instance
  if (faceMesh) {
    try {
      faceMesh.close();
    } catch (e) {
      console.warn('Error closing FaceMesh:', e);
    }
    faceMesh = null;
  }
  
  // Reset tracking state
  isTracking = false;
  clearTiltCallback();
  
  return new Promise((resolve, reject) => {
    const FaceMesh = window.FaceMesh;
    
    if (!FaceMesh) {
      console.error('FaceMesh not loaded from CDN');
      reject(new Error('FaceMesh not loaded'));
      return;
    }

    faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    faceMesh.onResults((results) => {
      processResults(results, canvasElement);
    });

    const Camera = window.Camera;
    if (!Camera) {
      console.error('Camera utils not loaded from CDN');
      reject(new Error('Camera utils not loaded'));
      return;
    }

    camera = new Camera(videoElement, {
      onFrame: async () => {
        if (isTracking && faceMesh) {
          try {
            await faceMesh.send({ image: videoElement });
          } catch (e) {
            console.error('FaceMesh send error:', e);
          }
        }
      },
      width: 640,
      height: 480
    });

    camera.start()
      .then(() => {
        isTracking = true;
        console.log('Camera started successfully, tracking enabled');
        resolve();
      })
      .catch((error) => {
        console.error('Camera start failed:', error);
        reject(error);
      });
  });
}

// Process face detection results
function processResults(results, canvasElement) {
  const ctx = canvasElement?.getContext('2d');
  
  if (ctx && canvasElement.width > 0) {
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  }
  
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    updateTiltIndicator('No face detected', null);
    return;
  }

  const landmarks = results.multiFaceLandmarks[0];
  
  // Calculate head tilt using key facial landmarks
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  
  // Calculate the angle between eyes to determine head tilt
  const eyeDeltaX = rightEye.x - leftEye.x;
  const eyeDeltaY = rightEye.y - leftEye.y;
  const tiltAngle = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);
  
  // Determine tilt direction
  // Camera is mirrored (selfie view), so we check the raw angle
  // When user tilts head to THEIR left, right eye goes down, negative angle
  // When user tilts head to THEIR right, left eye goes down, positive angle
  let tiltDirection = null;
  
  // Since camera is mirrored (selfie view), we need to invert the direction
  // Negative angle -> user tilting to their RIGHT (appears as left in mirror)
  // Positive angle -> user tilting to their LEFT (appears as right in mirror)
  if (tiltAngle < -TILT_THRESHOLD) {
    tiltDirection = 'right';  // User's right
  } else if (tiltAngle > TILT_THRESHOLD) {
    tiltDirection = 'left'; // User's left
  }
  
  // Update visual indicator
  updateTiltIndicator(tiltAngle, tiltDirection);
  
  // Trigger callback with debounce - only when direction changes
  if (tiltDirection && onTiltCallback) {
    if (!tiltDebounceTimer) {
      console.log(`Tilt detected: ${tiltDirection}, angle: ${tiltAngle.toFixed(1)}°`);
      
      // Call the callback
      onTiltCallback(tiltDirection);
      
      // Set debounce timer
      tiltDebounceTimer = setTimeout(() => {
        tiltDebounceTimer = null;
      }, DEBOUNCE_MS);
    }
  }
  
  // Draw face outline on canvas (optional visual feedback)
  if (ctx && canvasElement && canvasElement.width > 0) {
    drawFaceOutline(ctx, landmarks, canvasElement, tiltDirection);
  }
}

// Draw face outline for visual feedback
function drawFaceOutline(ctx, landmarks, canvas, tiltDirection) {
  const scaleX = canvas.width;
  const scaleY = canvas.height;
  
  // Draw a simple indicator circle around the face
  const noseTip = landmarks[1];
  const centerX = (1 - noseTip.x) * scaleX; // Mirror for selfie view
  const centerY = noseTip.y * scaleY;
  
  ctx.beginPath();
  ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
  
  if (tiltDirection === 'left') {
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 4;
  } else if (tiltDirection === 'right') {
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 4;
  } else {
    ctx.strokeStyle = '#6C63FF';
    ctx.lineWidth = 2;
  }
  
  ctx.stroke();
  
  // Draw direction arrow
  if (tiltDirection) {
    ctx.font = '40px Arial';
    ctx.fillStyle = '#4CAF50';
    ctx.textAlign = 'center';
    const arrow = tiltDirection === 'left' ? '⬅️' : '➡️';
    ctx.fillText(arrow, centerX, centerY - 50);
  }
}

// Update tilt indicator text
function updateTiltIndicator(angle, direction) {
  const indicator = document.getElementById('tilt-indicator');
  const arrow = document.getElementById('direction-arrow');
  
  if (indicator) {
    if (typeof angle === 'string') {
      indicator.textContent = angle;
      indicator.className = 'tilt-indicator';
    } else if (direction === 'left') {
      indicator.textContent = `⬅️ Tilting LEFT (${Math.abs(angle).toFixed(0)}°)`;
      indicator.className = 'tilt-indicator left';
    } else if (direction === 'right') {
      indicator.textContent = `➡️ Tilting RIGHT (${Math.abs(angle).toFixed(0)}°)`;
      indicator.className = 'tilt-indicator right';
    } else {
      indicator.textContent = `Keep your head straight (${Math.abs(angle).toFixed(0)}°)`;
      indicator.className = 'tilt-indicator';
    }
  }
  
  if (arrow) {
    arrow.className = 'direction-arrow';
    if (direction === 'left') {
      arrow.classList.add('show-left');
    } else if (direction === 'right') {
      arrow.classList.add('show-right');
    }
  }
}

// Set callback for when user tilts head
export function setTiltCallback(callback) {
  onTiltCallback = callback;
  lastTiltDirection = null;
  if (tiltDebounceTimer) {
    clearTimeout(tiltDebounceTimer);
    tiltDebounceTimer = null;
  }
  console.log('Tilt callback set');
}

// Clear tilt callback
export function clearTiltCallback() {
  onTiltCallback = null;
  lastTiltDirection = null;
  if (tiltDebounceTimer) {
    clearTimeout(tiltDebounceTimer);
    tiltDebounceTimer = null;
  }
}

// Stop tracking
export function stopTracking() {
  isTracking = false;
  clearTiltCallback();
  if (camera) {
    camera.stop();
  }
}

// Resume tracking
export function resumeTracking() {
  isTracking = true;
  if (camera) {
    camera.start();
  }
}

// Request camera permission
export async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user'
      } 
    });
    // Stop the stream immediately - we just wanted to check permission
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Camera permission denied:', error);
    return false;
  }
}

// Check if camera is available
export function isCameraAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
