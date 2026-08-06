const FaceEngine = (() => {
  const DESCRIPTOR_KEY = "heart_face_descriptor";
  let descriptor = null;
  let modelsLoaded = false;

  async function loadModels() {
    if (modelsLoaded) return;
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),
        faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'),
        faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/')
      ]);
      modelsLoaded = true;
      loadEnrolledDescriptor();
    } catch (e) {
      console.error("Face model loading error:", e);
      throw e;
    }
  }

  function loadEnrolledDescriptor() {
    try {
      const raw = localStorage.getItem(DESCRIPTOR_KEY);
      if (raw) descriptor = JSON.parse(raw);
    } catch (e) {
      descriptor = null;
    }
  }

  async function detectOnce(video) {
    if (!modelsLoaded) return null;
    try {
      const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceExpressions()
        .withFaceDescriptor();
      return detections || null;
    } catch (e) {
      return null;
    }
  }

  async function startCamera(video) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    video.srcObject = stream;
  }

  function stopCamera(video) {
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }

  function saveEnrolledDescriptor(desc) {
    descriptor = desc;
    localStorage.setItem(DESCRIPTOR_KEY, JSON.stringify(desc.data));
  }

  function hasEnrollment() {
    return descriptor !== null;
  }

  function isMatch(detectedDescriptor) {
    if (!descriptor || !detectedDescriptor) return false;
    const distance = faceapi.euclideanDistance(descriptor, detectedDescriptor.data);
    return distance < 0.6;
  }

  function topExpression(expressions) {
    if (!expressions) return 'neutral';
    const entries = Object.entries(expressions);
    const top = entries.reduce((a, b) => a[1] > b[1] ? a : b);
    return top[1] > 0.1 ? top[0] : 'neutral';
  }

  return { loadModels, detectOnce, startCamera, stopCamera, saveEnrolledDescriptor, hasEnrollment, isMatch, topExpression };
})();
