// voice.js — text-to-speech using the browser's built-in speech synthesis (free, on-device)

const Voice = (() => {
  let enabled = true;
  let onSpeakStart = () => {};
  let onSpeakEnd = () => {};

  function setCallbacks(startFn, endFn) {
    onSpeakStart = startFn;
    onSpeakEnd = endFn;
  }

  function toggle() {
    enabled = !enabled;
    if (!enabled) window.speechSynthesis.cancel();
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  function speak(text) {
    if (!enabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // stop any previous speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.05;
    utterance.onstart = () => onSpeakStart();
    utterance.onend = () => onSpeakEnd();
    utterance.onerror = () => onSpeakEnd();
    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    window.speechSynthesis.cancel();
    onSpeakEnd();
  }

  return { speak, stop, toggle, isEnabled, setCallbacks };
})();
