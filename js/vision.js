const Vision = (() => {
  let model = null;
  let isDetecting = false;
  let detectedObjects = [];
  let detectionCallback = () => {};

  async function loadModel() {
    if (model) return true;
    try {
      if (typeof cocoSsd === 'undefined') {
        console.warn("COCO-SSD not loaded yet, skipping vision");
        return false;
      }
      model = await cocoSsd.load();
      console.log("Vision model loaded successfully");
      return true;
    } catch (e) {
      console.warn("Vision model skipped (optional feature):", e.message);
      return false;
    }
  }

  function setDetectionCallback(fn) {
    detectionCallback = fn;
  }

  async function detectFromVideo(video) {
    if (!model || !video) return [];
    try {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return [];
      const predictions = await model.estimateObjects(video, false);
      detectedObjects = predictions
        .filter(p => p.score > 0.4)
        .map(p => p.class)
        .slice(0, 5);
      if (detectionCallback) detectionCallback(detectedObjects);
      return detectedObjects;
    } catch (e) {
      return [];
    }
  }

  function getDetected() {
    return detectedObjects;
  }

  function startDetection(video, intervalMs = 2000) {
    if (!model) return;
    isDetecting = true;
    const loop = async () => {
      if (!isDetecting || !video) return;
      await detectFromVideo(video);
      setTimeout(loop, intervalMs);
    };
    loop();
  }

  function stopDetection() {
    isDetecting = false;
  }

  return { loadModel, detectFromVideo, setDetectionCallback, getDetected, startDetection, stopDetection };
})();
