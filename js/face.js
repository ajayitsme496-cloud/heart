// face.js
// Everything here runs ON-DEVICE. No image or face data is ever sent to any server.
// Uses face-api.js (loaded via CDN script tag in index.html).

const FaceEngine = (() => {
  const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";
  const STORAGE_KEY = "heart_face_descriptor"; // JSON array of 128 floats, stored locally only
  let modelsLoaded = false;

  async function loadModels() {
    if (modelsLoaded) return;
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
    modelsLoaded = true;
  }

  async function startCamera(videoEl) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 320, height: 320 },
      audio: false
    });
    videoEl.srcObject = stream;
    return new Promise(resolve => {
      videoEl.onloadedmetadata = () => resolve(stream);
    });
  }

  function stopCamera(videoEl) {
    const stream = videoEl.srcObject;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      videoEl.srcObject = null;
    }
  }

  // Detect a single face with landmarks + descriptor + expressions
  async function detectOnce(videoEl) {
    const result = await faceapi
      .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor()
      .withFaceExpressions();
    return result || null;
  }

  function saveEnrolledDescriptor(descriptor) {
    // descriptor is a Float32Array of length 128 — store as plain array, on-device only
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(descriptor)));
  }

  function getEnrolledDescriptor() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return new Float32Array(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function hasEnrollment() {
    return !!getEnrolledDescriptor();
  }

  function clearEnrollment() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Lower distance = more similar. ~0.5 is a commonly used match threshold.
  function isMatch(descriptor, threshold = 0.5) {
    const enrolled = getEnrolledDescriptor();
    if (!enrolled) return false;
    const distance = faceapi.euclideanDistance(enrolled, descriptor);
    return distance < threshold;
  }

  // Turns the expressions object into a single friendly label
  function topExpression(expressions) {
    if (!expressions) return null;
    let best = null, bestScore = 0;
    for (const [label, score] of Object.entries(expressions)) {
      if (score > bestScore) { best = label; bestScore = score; }
    }
    return best; // e.g. "happy", "sad", "angry", "surprised", "neutral", "fearful", "disgusted"
  }

  return {
    loadModels,
    startCamera,
    stopCamera,
    detectOnce,
    saveEnrolledDescriptor,
    getEnrolledDescriptor,
    hasEnrollment,
    clearEnrollment,
    isMatch,
    topExpression
  };
})();
