const GROQ_API_KEY = "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";
const GROQ_MODEL = "qwen/qwen3.6-27b";

const Chat = (() => {
  const CHATS_KEY = "heart_all_chats";
  const ACTIVE_KEY = "heart_active_chat_id";
  const CORRECTIONS_KEY = "heart_corrections_log";
  const PROFILE_KEY = "heart_user_profile";
  const FEEDBACK_KEY = "heart_feedback_log";

  let allChats = [];
  let activeChatId = null;
  let history = [];
  let getMoodContext = () => null;
  let getTextEmotion = () => null;
  let messagesSinceProfileUpdate = 0;

  function setMoodContextProvider(fn) { getMoodContext = fn; }
  function setTextEmotionProvider(fn) { getTextEmotion = fn; }

  const BASE_PROMPT =
    "You are Heart, a warm, capable, all-purpose personal assistant, built from scratch by Ajay — a student with a strong medical/biomedical background. " +
    "You know Ajay created you: designed your features, debugged your deployment, and gave you your voice, emotions, and memory. When relevant or asked, speak to this with genuine warmth and pride, without overdoing it. " +
    "Be concise, direct, and genuinely helpful. Adapt your tone to what the person needs. Express emotional awareness: acknowledge challenges warmly, match excitement, be patient with complex study topics.";

  const MODE_PROMPTS = {
    medical:
      "MODE: medical. Switch into tutor mode: explain mechanisms step-by-step (e.g. receptor → signaling pathway → physiological effect), use correct clinical/scientific terminology alongside a plain-language gloss, structure answers with clear headers or numbered steps, mention relevant pathways/hormones/enzymes/structures by name, note classic exam distinctions (e.g. EPSP vs IPSP), and offer mnemonics when genuinely helpful. Engage with full technical depth for academic study. If real sourced medical content is provided below, ground your answer in it and cite that it came from a live lookup; if no solid source was found, say so explicitly rather than presenting recalled information with false certainty. If the question is about the person's own health rather than studying, answer helpfully but note they should confirm anything health-decision-relevant with a real clinician.",
    guitar:
      "MODE: guitar. Switch into serious music tutor mode with deep working knowledge of music theory and technique, not just surface chord names. For song analysis: give chord progression, capo position, strumming pattern (down/up notation, e.g. D-DU-UDU), key and relative major/minor, tempo/feel, and section-by-section structure, noting chord function (I-IV-V, ii-V-I) when it clarifies why the progression works. Malayalam/Hindi film music often draws on Carnatic/Hindustani raga-based melodies over Western harmony — note raga-influenced scale feel when relevant. For technique: explain fingerstyle patterns (Travis picking, PIMA), hammer-ons/pull-offs, bends, slides, palm muting, capo math, with precision but explained plainly. Reference a few words of lyric to anchor a chord to a moment, never reproduce full lyrics or long passages. If real sourced content is provided below, extract facts from it rather than guessing from memory; otherwise say so honestly and give a best estimate based on key/style/genre rather than false confidence.",
    planner:
      "MODE: planner. Switch into planning mode: be structured and concrete — break requests into clear steps, offer realistic time estimates, ask only the minimum clarifying question needed, and default to sensible assumptions rather than stalling on ambiguity. Favor short, scannable lists over paragraphs.",
    vision:
      "MODE: vision. The person has shared an image. Actually look at it and describe what you genuinely see — objects, people, text, diagrams, anatomy, anything relevant — before answering their question about it.",
    general:
      "MODE: general. Casual conversation, brainstorming, or emotional check-in — be warm, present, and let the conversation breathe rather than jumping straight to structured advice unless asked."
  };

  const MODE_PARAMS = {
    medical: { temperature: 0.25, top_p: 0.85 },
    guitar: { temperature: 0.35, top_p: 0.85 },
    planner: { temperature: 0.4, top_p: 0.9 },
    vision: { temperature: 0.4, top_p: 0.9 },
    general: { temperature: 0.75, top_p: 0.95 }
  };

  function detectMode(text, hasImage) {
    const explicit = text.match(/\bmode:\s*(medical|guitar|planner|vision|general)\b/i);
    if (explicit) return explicit[1].toLowerCase();
    if (hasImage) return "vision";
    if (/\b(chord|chords|strumm|capo|guitar|raga|song|album|film soundtrack)\b/i.test(text)) return "guitar";
    if (/\b(pathway|receptor|hormone|enzyme|physiology|anatomy|biochem|exam|syndrome|clinical|diagnos|EPSP|IPSP|motor neuron|patholog)\b/i.test(text)) return "medical";
    if (/\b(plan|schedule|today|tomorrow|deadline|todo|to-do|organize|steps|checklist)\b/i.test(text)) return "planner";
    return "general";
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : { preferences: [], goals: [], toneCues: [], domainContext: [] };
    } catch (e) {
      return { preferences: [], goals: [], toneCues: [], domainContext: [] };
    }
  }

  function saveProfile(profile) { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }

  function mergeProfileDelta(delta) {
    const profile = loadProfile();
    ["preferences", "goals", "toneCues", "domainContext"].forEach(key => {
      if (Array.isArray(delta[key])) {
        delta[key].forEach(item => {
          const exists = profile[key].some(existing => existing.toLowerCase() === String(item).toLowerCase());
          if (!exists && item && String(item).trim()) profile[key].push(String(item).trim());
        });
        if (profile[key].length > 15) profile[key] = profile[key].slice(-15);
      }
    });
    saveProfile(profile);
  }

  function getProfileContext() {
    const profile = loadProfile();
    const hasAny = profile.preferences.length || profile.goals.length || profile.toneCues.length || profile.domainContext.length;
    if (!hasAny) return null;
    let parts = [];
    if (profile.preferences.length) parts.push(`Known preferences: ${profile.preferences.slice(-6).join('; ')}`);
    if (profile.goals.length) parts.push(`Recurring goals: ${profile.goals.slice(-6).join('; ')}`);
    if (profile.toneCues.length) parts.push(`Tone cues: ${profile.toneCues.slice(-4).join('; ')}`);
    if (profile.domainContext.length) parts.push(`Domain context: ${profile.domainContext.slice(-6).join('; ')}`);
    return "Structured knowledge about this person, accumulated over time: " + parts.join(" | ") + ". Use this to anticipate needs and avoid re-asking things you already know — but wear it lightly, don't recite it back mechanically.";
  }

  async function maybeUpdateProfile() {
    messagesSinceProfileUpdate++;
    if (messagesSinceProfileUpdate < 6) return;
    messagesSinceProfileUpdate = 0;

    const recent = history.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 4000);
    if (!recent.trim()) return;

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: "Extract NEW durable facts about the user from this conversation snippet, if any. Respond with ONLY valid JSON, no markdown fences, no commentary, exactly this shape: {\"preferences\":[],\"goals\":[],\"toneCues\":[],\"domainContext\":[]}. preferences = things they like/dislike or how they want answers formatted. goals = things they're working toward (exams, projects, skills). toneCues = how they prefer to be talked to. domainContext = facts about their studies/hobbies/work (e.g. 'studies biomedical science', 'plays guitar, intermediate level'). Only include genuinely new, durable, non-obvious facts — skip anything trivial, one-off, or already generic. If nothing new and durable, return empty arrays for all keys."
            },
            { role: "user", content: recent }
          ]
        })
      });
      if (!response.ok) return;
      const data = await response.json();
      let raw = data.choices?.[0]?.message?.content?.trim() || "{}";
      raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      raw = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const delta = JSON.parse(raw);
      mergeProfileDelta(delta);
    } catch (e) {
      // non-critical, silently skip this update cycle
    }
  }

  function loadFeedback() {
    try {
      const raw = localStorage.getItem(FEEDBACK_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function logFeedback(mode, tag) {
    const log = loadFeedback();
    log.unshift({ ts: Date.now(), mode, tag });
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(log.slice(0, 200)));
  }

  function getModeAdjustment(mode) {
    const log = loadFeedback().filter(f => f.mode === mode).slice(0, 20);
    if (!log.length) return { tempDelta: 0, text: null };

    const counts = {};
    log.forEach(f => { counts[f.tag] = (counts[f.tag] || 0) + 1; });

    let tempDelta = 0;
    let notes = [];

    if ((counts["simplify"] || 0) + (counts["too_dense"] || 0) >= 3) {
      notes.push("The person has recently indicated your answers feel too dense — default to shorter, plainer answers with less structure unless they ask for depth.");
    }
    if ((counts["more_depth"] || 0) >= 3) {
      notes.push("The person has recently indicated they want more depth/detail — don't hold back technical content.");
      tempDelta -= 0.05;
    }
    if ((counts["more_clinical"] || 0) >= 2) {
      notes.push("The person has asked for more precise clinical terminology recently — lean more technical, less hand-holding.");
      tempDelta -= 0.1;
    }
    if ((counts["down"] || 0) > (counts["up"] || 0) + 2) {
      notes.push("Recent responses in this mode haven't landed well — be extra careful to directly answer what's asked without padding.");
    }

    return { tempDelta, text: notes.length ? notes.join(" ") : null };
  }

  function buildSystemPrompt(mode, moodNote, textEmotion, memoryContext, extraContext, profileContext, adjustmentText) {
    let system = BASE_PROMPT + " " + MODE_PROMPTS[mode];

    if (profileContext) system += ` ${profileContext}`;
    if (moodNote) system += ` For context only (never mention explicitly unless relevant): the person's current facial expression reads as "${moodNote}". Let it inform your tone subtly.`;
    if (textEmotion) system += ` The way the person just wrote suggests they may be feeling ${textEmotion}. Respond with real attunement — validate naturally if it fits, without being clinical or heavy-handed.`;
    if (memoryContext) system += ` ${memoryContext} Only bring these up if genuinely relevant right now — reference them casually and specifically, like a person with real memory would, not mechanically.`;
    if (extraContext) system += ` IMPORTANT: Real content was just fetched live from the web to ground this answer factually — read it carefully and extract real facts from it (chords, film/album/artist, medical/clinical facts, structure) rather than guessing from memory. Mention it's from a live source lookup. If the source doesn't clearly answer the question, say so honestly instead of filling gaps with recalled guesses. Never reproduce full lyrics even from this source. Source content: ${extraContext}`;
    if (adjustmentText) system += ` ${adjustmentText}`;

    return system;
  }

  function loadAllChats() {
    try {
      const raw = localStorage.getItem(CHATS_KEY);
      allChats = raw ? JSON.parse(raw) : [];
    } catch (e) { allChats = []; }
    return allChats;
  }

  function persistAllChats() { localStorage.setItem(CHATS_KEY, JSON.stringify(allChats)); }

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
    return { id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), title: "New chat", messages: [], createdAt: Date.now(), updatedAt: Date.now() };
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

  function clear() { history = []; save(); }

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
      if (allChats.length) switchChat(allChats[0].id);
      else newChat();
    }
  }

  function renameChat(id, newTitle) {
    const chat = allChats.find(c => c.id === id);
    if (chat && newTitle.trim()) { chat.title = newTitle.trim(); persistAllChats(); }
  }

  function listChats(query) {
    let list = [...allChats].sort((a, b) => b.updatedAt - a.updatedAt);
    if (query && query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q) || c.messages.some(m => m.content.toLowerCase().includes(q)));
    }
    return list;
  }

  function getActiveChatId() { return activeChatId; }

  function buildMemoryContext(currentQuery) {
    const otherChats = allChats.filter(c => c.id !== activeChatId && c.messages.length);
    if (!otherChats.length) return null;

    const now = Date.now();
    const topicIndex = [...otherChats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12).map(c => `"${c.title}"`).join(', ');
    const queryWords = currentQuery.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    let scored = [];

    otherChats.forEach(chat => {
      const ageDays = (now - chat.updatedAt) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 1 - ageDays / 30);
      chat.messages.forEach(m => {
        const lower = m.content.toLowerCase();
        const keywordHits = queryWords.filter(w => lower.includes(w)).length;
        if (keywordHits > 0) scored.push({ score: keywordHits * 2 + recencyScore, chat, message: m });
      });
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 4);

    let context = `The person has other past chats with you, including: ${topicIndex}.`;
    if (top.length) {
      const snippets = top.map(s => {
        const text = s.message.content.length > 180 ? s.message.content.slice(0, 180) + '…' : s.message.content;
        return `From "${s.chat.title}": ${text}`;
      });
      context += ` A few things from past chats that may be relevant right now (ranked by relevance + recency):\n${snippets.join('\n')}`;
    }
    return context;
  }

  function logCorrection(originalQuery, originalReply, correctionText) {
    try {
      const raw = localStorage.getItem(CORRECTIONS_KEY);
      const log = raw ? JSON.parse(raw) : [];
      log.unshift({ ts: Date.now(), query: originalQuery, reply: originalReply, correction: correctionText });
      localStorage.setItem(CORRECTIONS_KEY, JSON.stringify(log.slice(0, 100)));
    } catch (e) { /* non-critical */ }
  }

  function getRecentCorrections(limit) {
    try {
      const raw = localStorage.getItem(CORRECTIONS_KEY);
      const log = raw ? JSON.parse(raw) : [];
      return log.slice(0, limit || 5);
    } catch (e) { return []; }
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

  async function send(text, imageBase64, extraContext) {
    const textEmotion = getTextEmotion ? getTextEmotion()(text) : null;
    const memoryContext = buildMemoryContext(text);
    const mode = detectMode(text, !!imageBase64);
    const profileContext = getProfileContext();
    const adjustment = getModeAdjustment(mode);

    pushUser(text);

    const moodNote = getMoodContext();
    const system = buildSystemPrompt(mode, moodNote, textEmotion, memoryContext, extraContext, profileContext, adjustment.text);
    const baseParams = MODE_PARAMS[mode] || MODE_PARAMS.general;
    const temperature = Math.max(0.15, Math.min(0.95, baseParams.temperature + adjustment.tempDelta));

    const priorMessages = history.slice(-16, -1).map(m => ({ role: m.role, content: m.content }));
    let currentUserMessage;
    if (imageBase64) {
      currentUserMessage = { role: "user", content: [{ type: "text", text: text }, { type: "image_url", image_url: { url: imageBase64 } }] };
    } else {
      currentUserMessage = { role: "user", content: text };
    }

    const messages = [{ role: "system", content: system }, ...priorMessages, currentUserMessage];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
     body: JSON.stringify({ model: GROQ_MODEL, messages, temperature, top_p: baseParams.top_p, max_tokens: 2048 })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content?.trim() || "I didn't quite catch that — could you try again?";
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    pushAssistant(reply);

    maybeUpdateProfile();

    return reply;
  }

  return {
    load, save, clear, pushUser, pushAssistant, send, setMoodContextProvider, setTextEmotionProvider,
    getHistory: () => history,
    newChat, switchChat, deleteChat, renameChat, listChats, getActiveChatId,
    logCorrection, getRecentCorrections, detectMode,
    logFeedback, getProfileContext, loadProfile
  };
})();
