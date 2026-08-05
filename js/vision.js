const Vision = (() => {
  let model = null;
  let isDetecting = false;
  let detectedObjects = [];
  let detectionCallback = () => {};

  async function loadModel() {
    try {
      model = await cocoSsd.load();
      return true;
    } catch (e) {
      console.error("Failed to load COCO-SSD model:", e);
      return false;
    }
  }

  function setDetectionCallback(fn) {
    detectionCallback = fn;
  }

  async function detectFromVideo(video) {
    if (!model || !video || video.paused) return [];
    try {
      const predictions = await model.estimateObjects(video);
      detectedObjects = predictions
        .filter(p => p.score > 0.5)
        .map(p => p.class)
        .slice(0, 8);
      detectionCallback(detectedObjects);
      return detectedObjects;
    } catch (e) {
      return [];
    }
  }

  async function detectFromImage(imageSrc) {
    if (!model) return [];
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = async () => {
        const predictions = await model.estimateObjects(img);
        detectedObjects = predictions
          .filter(p => p.score > 0.5)
          .map(p => p.class)
          .slice(0, 8);
        detectionCallback(detectedObjects);
      };
      img.src = imageSrc;
      return detectedObjects;
    } catch (e) {
      return [];
    }
  }

  function getDetected() {
    return detectedObjects;
  }

  function startDetection(video, intervalMs = 1500) {
    isDetecting = true;
    const loop = async () => {
      if (!isDetecting) return;
      await detectFromVideo(video);
      setTimeout(loop, intervalMs);
    };
    loop();
  }

  function stopDetection() {
    isDetecting = false;
  }

  return { loadModel, detectFromVideo, detectFromImage, setDetectionCallback, getDetected, startDetection, stopDetection };
})();
