const ImageAnalysis = (() => {
  let currentImageData = null;
  let analysisCallback = () => {};

  function setAnalysisCallback(fn) {
    analysisCallback = fn;
  }

  async function analyzeImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;
        currentImageData = base64;
        
        try {
          const response = await fetch('https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning', {
            headers: { Authorization: 'Bearer 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' },
            method: 'POST',
            body: base64.split(',')[1],
          });

          if (response.ok) {
            const result = await response.json();
            const caption = result[0]?.generated_text || 'Image uploaded';
            analysisCallback(caption);
            resolve(caption);
          } else {
            analysisCallback('Image uploaded - describe it and I can help!');
            resolve('Image uploaded');
          }
        } catch (err) {
          analysisCallback('Image uploaded - describe it and I can help!');
          resolve('Image uploaded');
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function getCurrentImage() {
    return currentImageData;
  }

  function clearImage() {
    currentImageData = null;
  }

  return { analyzeImage, setAnalysisCallback, getCurrentImage, clearImage };
})();
