const GROQ_API_KEY = "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";
const GROQ_MODEL = "qwen/qwen3.6-27b";

const Chat = (() => {
  const CHATS_KEY = "heart_all_chats";
  const ACTIVE_KEY = "heart_active_chat_id";
  let allChats = [];
  let activeChatId = null;
  let history = [];
  let getMoodContext = () => null;

  function setMoodContextProvider(fn) {
    getMoodContext = fn;
  }

  function loadAllChats() {
    try {
      const raw = localStorage.getItem(CHATS_KEY);
      allChats = raw ? JSON.parse(raw) : [];
    } catch (e) {
      allChats = [];
    }
    return allChats;
  }

  function persistAllChats() {
    localStorage.setItem(CHATS_KEY, JSON.stringify(allChats));
  }

  function makeTitle(firstMessage) {
    if (!firstMessage) return "New chat";
    const trimmed = firstMessage.trim().replace(/\s+/g, ' ');
    return trimmed.length > 42 ? trimmed.slice(0, 42) + '…' : trimmed;
  }

  function load() {
    loadAllChats();
    activeChatId = localStorage.getItem(ACTIVE_KEY);
    let active = allChats.find(c => c.id === activeChatId);
    if (!active) {
      if (allChats.length) {
        active = allChats[0];
        activeChatId = active.id;
      } else {
        active = createChatObject();
        allChats.unshift(active);
        activeChatId = active.id;
        persistAllChats();
      }
      localStorage.setItem(ACTIVE_KEY, activeChatId);
    }
    history = active.messages;
    return history;
  }

  function createChatObject() {
    return {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      title: "New chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  function save() {
    const active = allChats.find(c => c.id === activeChatId);
    if (!active) return;
    active.messages = history;
    active.updatedAt = Date.now();
    if (active.title === "New chat" && history.length) {
      const firstUser = history.find(m => m.role === 'user');
      if (firstUser) active.title = makeTitle(firstUser.content);
    }
    persistAllChats();
  }

  function clear() {
    history = [];
    save();
  }

  function newChat() {
    const chat = createChatObject();
    allChats.unshift(chat);
    activeChatId = chat.id;
    history = chat.messages;
    localStorage.setItem(ACTIVE_KEY, activeChatId);
    persistAllChats();
    return history;
  }

  function switchChat(id) {
    const chat = allChats.find(c => c.id === id);
    if (!chat) return null;
    activeChatId = id;
    history = chat.messages;
    localStorage.setItem(ACTIVE_KEY, activeChatId);
    return history;
  }

  function deleteChat(id) {
    allChats = allChats.filter(c => c.id !== id);
    persistAllChats();
    if (activeChatId === id) {
      if (allChats.length) {
        switchChat(allChats[0].id);
      } else {
        newChat();
      }
    }
  }

  function renameChat(id, newTitle) {
    const chat = allChats.find(c => c.id === id);
    if (chat && newTitle.trim()) {
      chat.title = newTitle.trim();
      persistAllChats();
    }
  }

  function listChats(query) {
    let list = [...allChats].sort((a, b) => b.updatedAt - a.updatedAt);
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some(m => m.content.toLowerCase().includes(q))
      );
    }
    return list;
  }

  function getActiveChatId() {
    return activeChatId;
  }

  function pushUser(text) {
    const entry = { role: "user", content: text, ts: Date.now() };
    history.push(entry);
    save();
    return entry;
  }

  function pushAssistant(text) {
    const entry = { role: "assistant", content: text, ts: Date.now() };
    history.push(entry);
    save();
    return entry;
  }

  async function send(text, imageBase64) {
    pushUser(text);

    const moodNote = getMoodContext();
    let system = "You are Heart, a warm, capable, all-purpose personal assistant. You help with anything: planning, learning, brainstorming, emotional check-ins, or casual conversation. Be concise, direct, and genuinely helpful. Adapt your tone to what the person needs in the moment. " +
      "Express emotional awareness in your responses: if discussing a challenging topic, acknowledge it warmly; if they're excited about something, match their energy; if they're studying something complex, be encouraging and patient. " +
      "When the person asks about medical, physiological, or biochemical topics (exam prep, coursework, study questions), switch into tutor mode: explain mechanisms step-by-step (e.g. receptor → signaling pathway → physiological effect), use correct clinical/scientific terminology alongside a plain-language gloss, structure longer answers with clear headers or numbered steps, mention relevant pathways, hormones, enzymes, or structures by name, and where useful, note classic exam distinctions (e.g. EPSP vs IPSP, upper vs lower motor neuron signs). Offer mnemonics when they'd genuinely help retention. This is for academic study — engage with full technical depth rather than simplifying for a general audience, but if the person seems to be asking about their own personal health situation rather than studying, answer helpfully but note they should confirm anything health-decision-relevant with a real clinician. " +
      "If the person shares an image, actually look at it and describe what you genuinely see — objects, people, text, diagrams, anatomy, anything relevant — before answering their question about it.";

    if (moodNote) {
      system += ` For context only (never mention this explicitly unless relevant): the person's current facial expression reads as "${moodNote}". Let it inform your tone subtly, don't diagnose or call attention to it.`;
    }

    const priorMessages = history.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

    let currentUserMessage;
    if (imageBase64) {
      currentUserMessage = {
        role: "user",
        content: [
          { type: "text", text: text },
          { type: "image_url", image_url: { url: imageBase64 } }
        ]
      };
    } else {
      currentUserMessage = { role: "user", content: text };
    }

    const messages = [
      { role: "system", content: system },
      ...priorMessages,
      currentUserMessage
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content?.trim() || "I didn't quite catch that — could you try again?";
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    pushAssistant(reply);
    return reply;
  }

  return {
    load, save, clear, pushUser, pushAssistant, send, setMoodContextProvider,
    getHistory: () => history,
    newChat, switchChat, deleteChat, renameChat, listChats, getActiveChatId
  };
})();
