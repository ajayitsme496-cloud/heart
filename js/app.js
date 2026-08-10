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
const imageUploadBtn = document.getElementById('imageUploadBtn');
const notesToggleBtn = document.getElementById('notesToggleBtn');
const notesSection = document.getElementById('notesSection');
const notesNewBtn = document.getElementById('notesNewBtn');
const notesSearch = document.getElementById('notesSearch');
const notesList = document.getElementById('notesList');
const chatsToggleBtn = document.getElementById('chatsToggleBtn');
const chatsSection = document.getElementById('chatsSection');
const chatsSearch = document.getElementById('chatsSearch');
const chatsList = document.getElementById('chatsList');
const newChatBtn = document.getElementById('newChatBtn');

let currentMood = null;
let moodPollTimer = null;
let livenessOn = false;
let notesMode = false;
let chatsMode = false;

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
  renderActiveChat();
  Chat.setMoodContextProvider(() => currentMood);
  Chat.setTextEmotionProvider(() => TextEmotion.analyze);
}

function renderActiveChat() {
  chatEl.innerHTML = '';
  chatEl.appendChild(emptyState);
  emptyState.style.display = 'block';
  const msgs = Chat.load();
  msgs.forEach(m => renderMessage(m.role, m.content, m.ts));
  if (msgs.length) emptyState.style.display = 'none';
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMessage(role, content, ts, isError) {
  emptyState.style.display = 'none';
 const wrap = document.createElement('div');
  wrap.className = 'msg-wrap-enter';
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = role === 'user' ? 'flex-end' : 'flex-start';
  const bubble = document.createElement('div');
  bubble.className = 'msg ' + (isError ? 'error' : role);

  if (role === 'assistant' && !isError && typeof marked !== 'undefined') {
    bubble.innerHTML = marked.parse(content);
  } else {
    bubble.textContent = content;
  }

  const time = document.createElement('div');
  time.className = 'timestamp' + (role === 'user' ? '' : ' left');
  time.textContent = fmtTime(ts);

  wrap.appendChild(bubble);
  wrap.appendChild(time);

if (role === 'assistant' && !isError) {
    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '6px';
    actionsRow.style.marginTop = '8px';
    actionsRow.style.flexWrap = 'wrap';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'note-save-btn';
    saveBtn.textContent = '💾 Save';
    saveBtn.style.fontSize = '12px';
    saveBtn.style.padding = '4px 8px';
    saveBtn.style.background = 'var(--pulse-dim)';
    saveBtn.style.border = 'none';
    saveBtn.style.color = '#0b1615';
    saveBtn.style.borderRadius = '999px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.onclick = () => {
      const topic = prompt('Topic for this note?') || 'General';
      Notes.add(content, topic);
      saveBtn.textContent = '✓ Saved';
      saveBtn.style.background = 'var(--good)';
      setTimeout(() => { saveBtn.textContent = '💾 Save'; saveBtn.style.background = 'var(--pulse-dim)'; }, 2000);
    };
    actionsRow.appendChild(saveBtn);

    const currentMode = Chat.detectMode(
      Chat.getHistory().length >= 2 ? Chat.getHistory()[Chat.getHistory().length - 2].content : '',
      false
    );

    function makeFeedbackBtn(label, tag) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.fontSize = '11px';
      btn.style.padding = '4px 8px';
      btn.style.background = 'var(--surface)';
      btn.style.border = '1px solid var(--line)';
      btn.style.color = 'var(--text-mid)';
      btn.style.borderRadius = '999px';
      btn.style.cursor = 'pointer';
      btn.onclick = () => {
        Chat.logFeedback(currentMode, tag);
        btn.textContent = '✓';
        btn.style.color = 'var(--good)';
        setTimeout(() => { btn.textContent = label; btn.style.color = 'var(--text-mid)'; }, 1200);
      };
      return btn;
    }

    actionsRow.appendChild(makeFeedbackBtn('👍', 'up'));
    actionsRow.appendChild(makeFeedbackBtn('👎', 'down'));
    actionsRow.appendChild(makeFeedbackBtn('Simplify', 'simplify'));
    actionsRow.appendChild(makeFeedbackBtn('More depth', 'more_depth'));

    wrap.appendChild(actionsRow);
  }if (role === 'assistant' && !isError) {
    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.gap = '6px';
    actionsRow.style.marginTop = '8px';
    actionsRow.style.flexWrap = 'wrap';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'note-save-btn';
    saveBtn.textContent = '💾 Save';
    saveBtn.style.fontSize = '12px';
    saveBtn.style.padding = '4px 8px';
    saveBtn.style.background = 'var(--pulse-dim)';
    saveBtn.style.border = 'none';
    saveBtn.style.color = '#0b1615';
    saveBtn.style.borderRadius = '999px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.onclick = () => {
      const topic = prompt('Topic for this note?') || 'General';
      Notes.add(content, topic);
      saveBtn.textContent = '✓ Saved';
      saveBtn.style.background = 'var(--good)';
      setTimeout(() => { saveBtn.textContent = '💾 Save'; saveBtn.style.background = 'var(--pulse-dim)'; }, 2000);
    };
    actionsRow.appendChild(saveBtn);

    const currentMode = Chat.detectMode(
      Chat.getHistory().length >= 2 ? Chat.getHistory()[Chat.getHistory().length - 2].content : '',
      false
    );

    function makeFeedbackBtn(label, tag) {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.style.fontSize = '11px';
      btn.style.padding = '4px 8px';
      btn.style.background = 'var(--surface)';
      btn.style.border = '1px solid var(--line)';
      btn.style.color = 'var(--text-mid)';
      btn.style.borderRadius = '999px';
      btn.style.cursor = 'pointer';
      btn.onclick = () => {
        Chat.logFeedback(currentMode, tag);
        btn.textContent = '✓';
        btn.style.color = 'var(--good)';
        setTimeout(() => { btn.textContent = label; btn.style.color = 'var(--text-mid)'; }, 1200);
      };
      return btn;
    }

    actionsRow.appendChild(makeFeedbackBtn('👍', 'up'));
    actionsRow.appendChild(makeFeedbackBtn('👎', 'down'));
    actionsRow.appendChild(makeFeedbackBtn('Simplify', 'simplify'));
    actionsRow.appendChild(makeFeedbackBtn('More depth', 'more_depth'));

    wrap.appendChild(actionsRow);
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
  if (!confirm('Clear this chat? This deletes its messages permanently.')) return;
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

imageUploadBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;

      const imgPreview = document.createElement('div');
      imgPreview.style.marginBottom = '8px';
      const img = document.createElement('img');
      img.src = base64;
      img.style.maxWidth = '200px';
      img.style.borderRadius = '8px';
      img.style.display = 'block';
      imgPreview.appendChild(img);
      chatEl.appendChild(imgPreview);
      chatEl.scrollTop = chatEl.scrollHeight;

      setThinking(true);
      try {
        const reply = await Chat.send("What do you see in this image? Please describe it and identify anything notable.", base64);
        renderMessage('assistant', reply, Date.now());
        Voice.speak(reply);
      } catch (err) {
        renderMessage('assistant', 'Something went wrong analyzing the image. Try again.', Date.now(), true);
      } finally {
        setThinking(false);
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
});

Notes.load();

notesToggleBtn.addEventListener('click', () => {
  notesMode = !notesMode;
  chatsMode = false;
  chatsSection.style.display = 'none';
  chatsToggleBtn.classList.remove('active');
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

  const groups = {};
  notes.forEach(note => {
    if (!groups[note.topic]) groups[note.topic] = [];
    groups[note.topic].push(note);
  });

  Object.keys(groups).sort().forEach(topic => {
    const groupEl = document.createElement('div');
    groupEl.className = 'note-group';

    const header = document.createElement('div');
    header.className = 'note-group-header';
    header.innerHTML = `
      <span class="note-group-title">${topic}</span>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="note-group-count">${groups[topic].length}</span>
        <span class="note-group-arrow">▶</span>
      </div>
    `;
    header.addEventListener('click', () => {
      groupEl.classList.toggle('open');
    });

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'note-group-items';

    groups[topic].forEach(note => {
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
      itemsWrap.appendChild(noteEl);
    });

    groupEl.appendChild(header);
    groupEl.appendChild(itemsWrap);
    notesList.appendChild(groupEl);
  });

  if (query && query.trim()) {
    document.querySelectorAll('.note-group').forEach(g => g.classList.add('open'));
  }
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

chatsToggleBtn.addEventListener('click', () => {
  chatsMode = !chatsMode;
  notesMode = false;
  notesSection.style.display = 'none';
  notesToggleBtn.classList.remove('active');
  chatsToggleBtn.classList.toggle('active', chatsMode);
  chatEl.style.display = chatsMode ? 'none' : 'flex';
  chatsSection.style.display = chatsMode ? 'flex' : 'none';
  if (chatsMode) renderChatsList();
});

newChatBtn.addEventListener('click', () => {
  Chat.newChat();
  chatsMode = false;
  chatsSection.style.display = 'none';
  chatsToggleBtn.classList.remove('active');
  chatEl.style.display = 'flex';
  renderActiveChat();
});

chatsSearch.addEventListener('input', () => renderChatsList());

function renderChatsList() {
  const query = chatsSearch.value;
  const chats = Chat.listChats(query);
  const activeId = Chat.getActiveChatId();
  chatsList.innerHTML = '';
  if (!chats.length) {
    chatsList.innerHTML = '<p style="color: var(--text-dim); padding: 16px; text-align: center;">No chats yet</p>';
    return;
  }
  chats.forEach(chat => {
    const lastMsg = chat.messages[chat.messages.length - 1];
    const preview = lastMsg ? lastMsg.content.substring(0, 90) : 'No messages yet';
    const chatItem = document.createElement('div');
    chatItem.className = 'note-item';
    if (chat.id === activeId) chatItem.style.borderColor = 'var(--heart)';
    chatItem.innerHTML = `
      <div class="note-header">
        <span class="note-topic">${chat.title}${chat.id === activeId ? ' • current' : ''}</span>
        <span class="note-date">${new Date(chat.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
      </div>
      <div class="note-text">${preview}${preview.length >= 90 ? '...' : ''}</div>
      <div class="note-actions">
        <button data-action="open">Open</button>
        <button data-action="rename">Rename</button>
        <button data-action="delete">Delete</button>
      </div>
    `;
    chatItem.querySelector('[data-action="open"]').onclick = () => {
      Chat.switchChat(chat.id);
      chatsMode = false;
      chatsSection.style.display = 'none';
      chatsToggleBtn.classList.remove('active');
      chatEl.style.display = 'flex';
      renderActiveChat();
    };
    chatItem.querySelector('[data-action="rename"]').onclick = (e) => {
      e.stopPropagation();
      const newTitle = prompt('Rename chat:', chat.title);
      if (newTitle) {
        Chat.renameChat(chat.id, newTitle);
        renderChatsList();
      }
    };
    chatItem.querySelector('[data-action="delete"]').onclick = (e) => {
      e.stopPropagation();
      if (confirm('Delete this chat permanently?')) {
        Chat.deleteChat(chat.id);
        renderChatsList();
        renderActiveChat();
      }
    };
    chatsList.appendChild(chatItem);
  });
}

boot();
