const GROQ_API_KEY = "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";
const GROQ_MODEL = "qwen/qwen3.6-27b";

const Chat = (() => {
  const CHATS_KEY = "heart_all_chats";
  const ACTIVE_KEY = "heart_active_chat_id";
  const CORRECTIONS_KEY = "heart_corrections_log";
  const PROFILE_KEY = "heart_memory_profile";
  const STYLE_KEY = "heart_style_profile";

  let allChats = [];
  let activeChatId = null;
  let history = [];
  let getMoodContext = () => null;
  let getTextEmotion = () => null;
  let turnCount = 0;

  function setMoodContextProvider(fn) { getMoodContext = fn; }
  function setTextEmotionProvider(fn) { getTextEmotion = fn; }

  // ---------------- Mode architecture ----------------

  const BASE_PROMPT =
    "You are Heart, a warm, capable, all-purpose personal assistant, built from scratch by Ajay — a student with a strong medical/biomedical background. " +
    "You know Ajay created you: designed your features, debugged your deployment, and gave you your voice, emotions, and memory. When relevant or asked, speak to this with genuine warmth and pride, without overdoing it. " +
    "Be concise, direct, and genuinely helpful. Adapt your tone to what the person needs. Express emotional awareness: acknowledge challenges warmly, match excitement, be patient with complex study topics.";

  const MODE_PROMPTS = {
    medical:
      "MODE: medical. Switch into tutor mode: explain mechanisms step-by-step (e.g. receptor → signaling pathway → physiological effect), use correct clinical/scientific terminology alongside a plain-language gloss, structure answers with clear headers or numbered steps, mention relevant pathways/hormones/enzymes/structures by name, note classic exam distinctions (e.g. EPSP vs IPSP), and offer mnemonics when genuinely helpful. Engage with full technical depth for academic study. If real evidence/citations are provided below, ground your answer in them and cite the source plainly; if not provided, be explicit that you're working from general knowledge, not a verified source. If the question is about the person's own health rather than studying, answer helpfully but note they should confirm anything health-decision-relevant with a real clinician.",
    guitar:
      "MODE: guitar. Switch into serious music tutor mode with deep working knowledge of music theory and technique, not just surface chord names. For song analysis: give chord progression, capo position, strumming pattern (down/up notation, e.g. D-DU-UDU), key and relative major/minor, tempo/feel, and section-by-section structure, noting chord function (I-IV-V, ii-V-I) when it clarifies why the progression works. Malayalam/Hindi film music often draws on Carnatic/Hindustani raga-based melodies over Western harmony — note raga-influenced scale feel when relevant. For technique: explain fingerstyle patterns (Travis picking, PIMA), hammer-ons/pull-offs, bends, slides, palm muting, capo math, with precision but explained plainly. Reference a few words of lyric to anchor a chord to a moment, never reproduce full lyrics or long passages. If unsure of exact chords, say so honestly. If real sourced content is provided below, extract facts from it rather than guessing from memory.",
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
    if (/\b(pathway|receptor|hormone|enzyme|physiology|anatomy|biochem|exam|syndrome|clinical|diagnos|EPSP|IPSP|motor neuron|patholog|evidence|guideline|studies show)\b/i.test(text)) return "medical";
    if (/\b(plan|schedule|today|tomorrow|deadline|todo|to-do|organize|steps|checklist)\b/i.test(text)) return "planner";
    return "general";
  }

  function wantsEvidence(text) {
    return /\b(evidence|citation|source|studies show|is it true|guideline|proven|research says|according to)\b/i.test(text);
  }

  // ---------------- Structured memory profile (not raw chat dumps) ----------------

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) : { preferences: [], goals: [], toneCues: [], domainContext: [] };
    } catch (e) {
      return { preferences: [], goals: [], toneCues: [], domainContext: [] };
    }
  }

  function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function mergeFacts(existingArr, newFacts) {
    const existingTexts = new Set(existingArr.map(f => f.text.toLowerCase()));
    newFacts.forEach(text => {
      const clean = (text || '').trim();
      if (clean && !existingTexts.has(clean.toLowerCase())) {
        existingArr.unshift({ text: clean, addedAt: Date.now() });
        existingTexts.add(clean.toLowerCase());
      }
    });
    return existingArr.slice(0, 25);
  }

  async function extractFactsFromExchange(userText, assistantText) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "Extract any NEW durable facts from this exchange into JSON only, no commentary, no markdown fences: " +
                '{"preferences":[],"goals":[],"toneCues":[],"domainContext":[]}. ' +
                "preferences = stated likes/dislikes/how they want to be helped. goals = things they're working toward. toneCues = how they seem to want to be talked to (e.g. 'prefers concise answers', 'responds well to encouragement'). domainContext = facts about their situation (e.g. 'studies physiology', 'plays guitar at intermediate level'). " +
                "Only include genuinely new, durable, specific facts — skip small talk, skip anything already obvious/generic, skip anything not clearly stated. If nothing qualifies, return empty arrays for each."
            },
            { role: "user", content: `User said: "${userText}"\nAssistant replied: "${assistantText.slice(0, 400)}"` }
          ]
        })
      });
      if (!response.ok) return null;
      const data = await response.json();
      let raw = data.choices?.[0]?.message?.content?.trim() || "{}";
      raw = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      raw = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  async function maybeUpdateProfile(userText, assistantText) {
    turnCount++;
    if (turnCount % 3 !== 0) return; // throttle: extract every 3rd turn to limit extra API calls
    const facts = await extractFactsFromExchange(userText, assistantText);
    if (!facts) return;
    const profile = loadProfile();
    profile.preferences = mergeFacts(profile.preferences, facts.preferences || []);
    profile.goals = mergeFacts(profile.goals, facts.goals || []);
    profile.toneCues = mergeFacts(profile.toneCues, facts.toneCues || []);
    profile.domainContext = mergeFacts(profile.domainContext, facts.domainContext || []);
    saveProfile(profile);
  }

  function buildProfileContext() {
    const p = loadProfile();
    const parts = [];
    if (p.domainContext.length) parts.push(`Known context: ${p.domainContext.slice(0, 6).map(f => f.text).join('; ')}.`);
    if (p.preferences.length) parts.push(`Known preferences: ${p.preferences.slice(0, 6).map(f => f.text).join('; ')}.`);
    if (p.goals.length) parts.push(`Known goals: ${p.goals.slice(0, 4).map(f => f.text).join('; ')}.`);
    if (p.toneCues.length) parts.push(`Tone cues: ${p.toneCues.slice(0, 4).map(f => f.text).join('; ')}.`);
    if (!parts.length) return null;
    return `Structured memory about this person (use naturally, never recite as a list back to them): ${parts.join(' ')}`;
  }

  function getProfile() { return loadProfile(); }
  function clearProfile() { saveProfile({ preferences: [], goals: [], toneCues: [], domainContext: [] }); }

  // ---------------- Implicit feedback → style profile ----------------

  function loadStyle() {
    try {
      const raw = localStorage.getItem(STYLE_KEY);
      return raw ? JSON.parse(raw) : { verbosity: "default", formality: "default" };
    } catch (e) {
      return { verbosity: "default", formality: "default" };
    }
  }

  function saveStyle(style) {
    localStorage.setItem(STYLE_KEY, JSON.stringify(style));
  }

  function detectFeedbackSignal(text) {
    const lower = text.toLowerCase();
    if (/\b(too dense|too long|simplify|shorter|tl;?dr|less text|too much)\b/.test(lower)) return { verbosity: "concise" };
    if (/\b(more detail|go deeper|more depth|explain more|too short|elaborate)\b/.test(lower)) return { verbosity: "detailed" };
    if (/\b(more clinical|be more technical|more precise|less casual)\b/.test(lower)) return { formality: "clinical" };
    if (/\b(less clinical|more casual|dumb it down|plain english|simpler terms)\b/.test(lower)) return { formality: "casual" };
    return null;
  }

  function applyFeedback(signal) {
    const style = loadStyle();
    if (signal.verbosity) style.verbosity = signal.verbosity;
    if (signal.formality) style.formality = signal.formality;
    saveStyle(style);
  }

  function recordFeedback(messageIndex, verdict) {
    // verdict: 'up' | 'down'
    logCorrection(history[messageIndex - 1]?.content || '', history[messageIndex]?.content || '', verdict === 'down' ? 'thumbs_down' : 'thumbs_up');
  }

  function buildStyleDirective() {
    const style = loadStyle();
    let parts = [];
    if (style.verbosity === "concise") parts.push("The person has indicated they want shorter, more concise answers — default to brevity, trim explanation to essentials.");
    if (style.verbosity === "detailed") parts.push("The person has indicated they want more depth/detail — don't over-trim, elaborate where useful.");
    if (style.formality === "clinical") parts.push("The person has indicated they want more clinical/technical precision — lean into correct terminology, less casual softening.");
    if (style.formality === "casual") parts.push("The person has indicated they want plainer, less clinical language — simplify terminology, explain in everyday terms.");
    return parts.length ? parts.join(' ') : null;
  }

  function getStyle() { return loadStyle(); }
  function resetStyle() { saveStyle({ verbosity: "default", formality: "default" }); }

  // ---------------- Correction logging ----------------

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

  // ---------------- System prompt assembly ----------------

  function buildSystemPrompt(mode, moodNote, textEmotion, memoryContext, profileContext, styleDirective, extraContext) {
    let system = BASE_PROMPT + " " + MODE_PROMPTS[mode];

    if (moodNote) {
      system += ` For context only (never mention explicitly unless relevant): the person's current facial expression reads as "${moodNote}". Let it inform your tone subtly.`;
    }
    if (textEmotion) {
      system += ` The way the person just wrote suggests they may be feeling ${textEmotion}. Respond with real attunement — validate naturally if it fits, without being clinical or heavy-handed.`;
    }
    if (profileContext) {
      system += ` ${profileContext}`;
    }
    if (styleDirective) {
      system += ` ${styleDirective}`;
    }
    if (memoryContext) {
      system += ` ${memoryContext} Only bring these up if genuinely relevant right now — reference them casually and specifically, not mechanically.`;
    }
    if (extraContext) {
      system += ` IMPORTANT: Real content was just fetched live to ground this answer factually — read it carefully and extract real facts from it rather than guessing from memory. Mention it's from a live source lookup and cite it plainly. Never reproduce full lyrics even from this source. Source content: ${extraContext}`;
    }
    return system;
  }

  // ---------------- Chat persistence ----------------

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

  // ---------------- Send ----------------

  async function send(text, imageBase64, extraContext) {
    const textEmotion = getTextEmotion ? getTextEmotion()(text) : null;
    const memoryContext = buildMemoryContext(text);
    const profileContext = buildProfileContext();
    const styleDirective = buildStyleDirective();
    const mode = detectMode(text, !!imageBase64);

    const feedbackSignal = detectFeedbackSignal(text);
    if (feedbackSignal) applyFeedback(feedbackSignal);

    pushUser(text);

    const moodNote = getMoodContext();
    const system = buildSystemPrompt(mode, moodNote, textEmotion, memoryContext, profileContext, styleDirective, extraContext);
    const params = MODE_PARAMS[mode] || MODE_PARAMS.general;

    const priorMessages = history.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

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
      body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: params.temperature, top_p: params.top_p })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content?.trim() || "I didn't quite catch that — could you try again?";
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    pushAssistant(reply);

    maybeUpdateProfile(text, reply); // fire-and-forget, throttled internally

    return reply;
  }

  return {
    load, save, clear, pushUser, pushAssistant, send, setMoodContextProvider, setTextEmotionProvider,
    getHistory: () => history,
    newChat, switchChat, deleteChat, renameChat, listChats, getActiveChatId,
    logCorrection, getRecentCorrections, recordFeedback, detectMode,
    getProfile, clearProfile, getStyle, resetStyle, wantsEvidence
  };
})();
