const Voice = (() => {
  let enabled = true;
  let onSpeakStart = () => {};
  let onSpeakEnd = () => {};
  let selectedVoice = null;
  let voicesReady = false;

  function pickBestVoice() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const preferredNames = [
      'Google UK English Female',
      'Google US English',
      'Microsoft Aria',
      'Microsoft Jenny',
      'Samantha',
      'Google हिन्दी'
    ];

    for (const name of preferredNames) {
      const match = voices.find(v => v.name === name);
      if (match) return match;
    }

    const googleEn = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'));
    if (googleEn) return googleEn;

    const anyEn = voices.find(v => v.lang.startsWith('en') && v.localService === false);
    if (anyEn) return anyEn;

    const anyEnLocal = voices.find(v => v.lang.startsWith('en'));
    if (anyEnLocal) return anyEnLocal;

    return voices[0];
  }

  function loadVoices() {
    selectedVoice = pickBestVoice();
    voicesReady = true;
  }

  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

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

  function getVoiceName() {
    return selectedVoice ? selectedVoice.name : 'Default';
  }

  function listVoices() {
    return window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
  }

  function setVoiceByName(name) {
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find(v => v.name === name);
    if (match) selectedVoice = match;
  }

  function speak(text) {
    if (!enabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const cleaned = text.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleaned);

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = 1.02;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => onSpeakStart();
    utterance.onend = () => onSpeakEnd();
    utterance.onerror = () => onSpeakEnd();

    window.speechSynthesis.speak(utterance);
  }

  function stop() {
    window.speechSynthesis.cancel();
    onSpeakEnd();
  }

  return { speak, stop, toggle, isEnabled, setCallbacks, getVoiceName, listVoices, setVoiceByName };
})();
