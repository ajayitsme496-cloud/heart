const setupScreen = document.getElementById('setupScreen');
const lockScreen = document.getElementById('lockScreen');
const enrollScreen = document.getElementById('enrollScreen');
const mainScreen = document.getElementById('mainScreen');

const setupStatus = document.getElementById('setupStatus');
const enableFaceIdBtn = document.getElementById('enableFaceIdBtn');
const skipSetupBtn = document.getElementById('skipSetupBtn');

const unlockBtn = document.getElementById('unlockBtn');
const lockStatus = document.getElementById('lockStatus');

const enrollVideo = document.getElementById('enrollVideo');
const enrollBox = document.getElementById('enrollBox');
const enrollStatus = document.getElementById('enrollStatus');
const captureBtn = document.getElementById('captureBtn');
const skipEnrollBtn = document.getElementById('skipEnrollBtn');

const chatEl = document.getElementById('chat');
const emptyState = document.getElementById('emptyState');
const textInput = document.getElementById('textInput');
const sendBtn = document.getElementById('sendBtn');
const micBtn = document.getElementById('micBtn');
const clearBtn = document.getElementById('clearBtn');
const pulseWrap = document.getElementById('pulseWrap');
const cameraToggleBtn = document.getElementById('cameraToggleBtn');
const miniCameraWrap = document.getElementById('mini-camera-wrap');
const liveVideo = document.getElementById('liveVideo');
const moodLabel = document.getElementById('moodLabel');
const moodDot = document.getElementById('moodDot');
const avatarEl = document.getElementById('avatar');
const voiceToggleBtn = document.getElementById('voiceToggleBtn');
const notesToggleBtn = document.getElementById('notesToggleBtn');
const notesSection = document.getElementById('notesSection');
const notesNewBtn = document.getElementById('notesNewBtn');
const notesSearch = document.getElementById('notesSearch');
const notesList = document.getElementById('notesList');

let currentMood = null;
let moodPollTimer = null;
let livenessOn = false;
let notesMode = false;

function showScreen(el) {
  [setupScreen, lockScreen, enrollScreen, mainScreen].forEach(s => s.style.display = 'none');
  el.style.display = 'flex';
}

function boot() {
  if (!WebAuthnLock.supported()) {
    proceedToFaceEnrollOrMain();
    return;
  }
  if (WebAuthnLock.hasEnrollment()) {
    showScreen(lockScreen);
  } else {
    showScreen(setupScreen);
  }
}

enableFaceIdBtn.addEventListener('click', async () => {
  setupStatus.textContent = "Follow the Face ID prompt…";
  try {
    await WebAuthnLock.enroll();
    proceedToFaceEnrollOrMain();
  } catch (e) {
    setupStatus.textContent = "Couldn't set up Face ID (this needs HTTPS hosting). You can skip for now.";
  }
});

skipSetupBtn.addEventListener('click', proceedToFaceEnrollOrMain);

unlockBtn.addEventListener('click', async () => {
  lockStatus.textContent = "Authenticating…";
  const ok = await WebAuthnLock.unlock();
  if (ok) {
    proceedToFaceEnrollOrMain();
  } else {
    lockStatus.textContent = "Couldn't verify — try again.";
  }
});

function proceedToFaceEnrollOrMain() {
  if (FaceEngine.hasEnrollment()) {
    startMain();
  } else {
    startEnrollment();
  }
}

async function startEnrollment() {
  showScreen(enrollScreen);
  enrollStatus.textContent = "Loading face model…";
  try {
    await FaceEngine.loadModels();
    await FaceEngine.startCamera(enrollVideo);
    enrollStatus.textContent = "Looking for your face…";
    pollEnrollPreview();
  } catch (e) {
    enrollStatus.textContent = "Camera unavailable (needs HTTPS + camera permission). You can skip.";
  }
}

async function pollEnrollPreview() {
  if (enrollScreen.style.display === 'none') return;
  const result = await FaceEngine.detectOnce(enrollVideo);
  if (result) {
    enrollBox.classList.add('detected');
    enrollStatus.textContent = "Face found — hold still and capture.";
    captureBtn.disabled = false;
  } else {
    enrollBox.classList.remove('detected');
    enrollStatus.textContent = "Looking for your face…";
    captureBtn.disabled = true;
  }
  setTimeout(pollEnrollPreview, 400);
}

captureBtn.addEventListener('click', async () => {
  const result = await FaceEngine.detectOnce(enrollVideo);
  if (!result) return;
  FaceEngine.saveEnrolledDescriptor(result.descriptor);
  FaceEngine.stopCamera(enrollVideo);
  startMain();
});

skipEnrollBtn.addEventListener('click', () => {
  FaceEngine.stopCamera(enrollVideo);
  startMain();
});

function startMain() {
  showScreen(mainScreen);
  Chat.load().forEach(m => renderMessage(m.role, m.content, m.ts));
  if (Chat.getHistory().length) emptyState.style.display = 'none';
  Chat.setMoodContextProvider(() => currentMood);
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMessage(role, content, ts, isError) {
  emptyState.style.display = 'none';
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = role === 'user' ? 'flex-end' : 'flex-start';

  const bubble = document.createElement('div');
  bubble.className = 'msg ' + (isError ? 'error' : role);
  bubble.textContent = content;

  const time = document.createElement('div');
  time.className = 'timestamp' + (role === 'user' ? '' : ' left');
  time.textContent = fmtTime(ts);

  wrap.appendChild(bubble);
  wrap.appendChild(time);
  
  if (role === 'assistant' && !isError) {
    const saveBtn = document.createElement('button');
    saveBtn.className = 'note-save-btn';
    saveBtn.textContent = '💾 Save';
    saveBtn.style.marginTop = '8px';
    saveBtn.style.fontSize = '12px';
    saveBtn.style.padding = '4px 8px';
    saveBtn.style.background = 'var(--heart-dim)';
    saveBtn.style.border = 'none';
    saveBtn.style.color = '#fff';
    saveBtn.style.borderRadius = '12px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.onclick = () => {
      const topic = prompt('Topic for this note?') || 'General';
      Notes.add(content, topic);
      saveBtn.textContent = '✓ Saved';
      saveBtn.style.background = 'var(--good)';
      setTimeout(() => {
        saveBtn.textContent = '💾 Save';
        saveBtn.style.background = 'var(--heart-dim)';
      }, 2000);
    };
    wrap.appendChild(saveBtn);
  }

  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setThinking(on) {
  pulseWrap.classList.toggle('active', on);
  sendBtn.disabled = on;
}

async function handleSend(text) {
  if (!text.trim()) return;
  renderMessage('user', text, Date.now());
  textInput.value = '';
  textInput.style.height = 'auto';
  setThinking(true);
  try {
    const reply = await Chat.send(text);
    renderMessage('assistant', reply, Date.now());
    Voice.speak(reply);
  } catch (err) {
    renderMessage('assistant', 'Something went wrong reaching Heart. Check your API key and connection, then try again.', Date.now(), true);
  } finally {
    setThinking(false);
  }
}

sendBtn.addEventListener('click', () => handleSend(textInput.value));
textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend(textInput.value);
  }
});
textInput.addEventListener('input', () => {
  textInput.style.height = 'auto';
  textInput.style.height = Math.min(textInput.scrollHeight, 120) + 'px';
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => handleSend(chip.dataset.prompt));
});

clearBtn.addEventListener('click', () => {
  Chat.clear();
  chatEl.innerHTML = '';
  chatEl.appendChild(emptyState);
  emptyState.style.display = 'block';
});

let recognizing = false;
let recognition = null;
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  recognition.onresult = e => {
    const transcript = e.results[0][0].transcript;
    textInput.value = (textInput.value ? textInput.value + ' ' : '') + transcript;
    textInput.dispatchEvent(new Event('input'));
  };
  recognition.onend = () => { recognizing = false; micBtn.classList.remove('listening'); };
  recognition.onerror = () => { recognizing = false; micBtn.classList.remove('listening'); };
  micBtn.addEventListener('click', () => {
    if (recognizing) { recognition.stop(); return; }
    recognizing = true;
    micBtn.classList.add('listening');
    try { recognition.start(); } catch (e) { recognizing = false; micBtn.classList.remove('listening'); }
  });
} else {
  micBtn.style.display = 'none';
}

cameraToggleBtn.addEventListener('click', async () => {
  livenessOn = !livenessOn;
  cameraToggleBtn.classList.toggle('active', livenessOn);
  if (livenessOn) {
    miniCameraWrap.style.display = 'block';
    try {
      await FaceEngine.loadModels();
      await FaceEngine.startCamera(liveVideo);
      pollMood();
    } catch (e) {
      moodLabel.textContent = 'no camera';
      livenessOn = false;
      cameraToggleBtn.classList.remove('active');
      miniCameraWrap.style.display = 'none';
    }
  } else {
    FaceEngine.stopCamera(liveVideo);
    miniCameraWrap.style.display = 'none';
    currentMood = null;
    moodDot.className = 'status-dot';
    moodDot.title = 'No face detected';
    avatarEl.classList.remove('happy', 'sad', 'angry', 'fearful', 'disgusted', 'thinking', 'neutral');
    avatarEl.classList.add('neutral');
    clearTimeout(moodPollTimer);
  }
});

async function pollMood() {
  if (!livenessOn) return;
  const result = await FaceEngine.detectOnce(liveVideo);
  let moodClass = 'neutral';
  if (result) {
    const expr = FaceEngine.topExpression(result.expressions);
    currentMood = expr;
    moodLabel.textContent = expr || '—';
    
    if (expr === 'happy' || expr === 'surprised') {
      moodClass = 'happy';
    } else if (expr === 'sad') {
      moodClass = 'sad';
    } else if (expr === 'angry') {
      moodClass = 'angry';
    } else if (expr === 'fearful') {
      moodClass = 'fearful';
    } else if (expr === 'disgusted') {
      moodClass = 'disgusted';
    } else if (expr === 'neutral') {
      moodClass = 'thinking';
    } else {
      moodClass = 'neutral';
    }
    
    moodDot.className = 'status-dot ' + moodClass;
    moodDot.title = expr ? `Reading: ${expr}` : 'No face detected';
    if (FaceEngine.hasEnrollment()) {
      const isYou = FaceEngine.isMatch(result.descriptor);
      moodDot.title += isYou ? ' (recognized: you)' : ' (unrecognized face)';
    }
  } else {
    moodLabel.textContent = '—';
    moodDot.className = 'status-dot';
    moodDot.title = 'No face detected';
  }
  avatarEl.classList.remove('happy', 'sad', 'angry', 'fearful', 'disgusted', 'thinking', 'neutral');
  avatarEl.classList.add(moodClass);
  moodPollTimer = setTimeout(pollMood, 1200);
}

Voice.setCallbacks(
  () => avatarEl.classList.add('speaking'),
  () => avatarEl.classList.remove('speaking')
);

voiceToggleBtn.addEventListener('click', () => {
  const on = Voice.toggle();
  voiceToggleBtn.textContent = on ? '🔊' : '🔇';
});

Notes.load();

notesToggleBtn.addEventListener('click', () => {
  notesMode = !notesMode;
  notesToggleBtn.classList.toggle('active', notesMode);
  chatEl.style.display = notesMode ? 'none' : 'flex';
  notesSection.style.display = notesMode ? 'flex' : 'none';
  if (notesMode) renderNotesList();
});

notesNewBtn.addEventListener('click', () => {
  const topic = prompt('Topic (e.g. Physiology, Biochem):') || 'General';
  const text = prompt('Note text:');
  if (text) {
    Notes.add(text, topic);
    renderNotesList();
  }
});

notesSearch.addEventListener('input', () => renderNotesList());

function renderNotesList() {
  const query = notesSearch.value;
  const notes = Notes.search(query);
  notesList.innerHTML = '';
  if (!notes.length) {
    notesList.innerHTML = '<p style="color: var(--text-dim); padding: 16px; text-align: center;">No notes yet</p>';
    return;
  }
  notes.forEach(note => {
    const noteEl = document.createElement('div');
    noteEl.className = 'note-item';
    noteEl.innerHTML = `
      <div class="note-header">
        <span class="note-topic">${note.topic}</span>
        <span class="note-date">${note.createdAt}</span>
      </div>
      <div class="note-text">${note.text.substring(0, 150)}${note.text.length > 150 ? '...' : ''}</div>
      <div class="note-actions">
        <button onclick="editNote(${note.id})">Edit</button>
        <button onclick="deleteNote(${note.id})">Delete</button>
      </div>
    `;
    notesList.appendChild(noteEl);
  });
}

window.editNote = (id) => {
  const note = Notes.getAll().find(n => n.id === id);
  if (!note) return;
  const newTopic = prompt('Topic:', note.topic) || note.topic;
  const newText = prompt('Note text:', note.text);
  if (newText) {
    Notes.update(id, newText, newTopic);
    renderNotesList();
  }
};

window.deleteNote = (id) => {
  if (confirm('Delete this note?')) {
    Notes.remove(id);
    renderNotesList();
  }
};

boot();
