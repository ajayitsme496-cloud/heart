const GROQ_API_KEY = "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";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const Chat = (() => {
  const STORAGE_KEY = "heart_chat_history";
  let history = [];
  let getMoodContext = () => null;
  let getImageContext = () => null;

  function setMoodContextProvider(fn) {
    getMoodContext = fn;
  }

  function setImageContextProvider(fn) {
    getImageContext = fn;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      history = raw ? JSON.parse(raw) : [];
    } catch (e) {
      history = [];
    }
    return history;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }

  function clear() {
    history = [];
    save();
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

  async function send(text) {
    pushUser(text);

    const moodNote = getMoodContext();
    const imageNote = getImageContext();
    
    let system = "You are Heart, a warm, capable, all-purpose personal assistant. You help with anything: planning, learning, brainstorming, emotional check-ins, or casual conversation. Be concise, direct, and genuinely helpful. Adapt your tone to what the person needs in the moment. " +
      "Express emotional awareness in your responses: if discussing a challenging topic, acknowledge it warmly; if they're excited about something, match their energy; if they're studying something complex, be encouraging and patient. " +
      "When the person asks about medical, physiological, or biochemical topics (exam prep, coursework, study questions), switch into tutor mode: explain mechanisms step-by-step (e.g. receptor → signaling pathway → physiological effect), use correct clinical/scientific terminology alongside a plain-language gloss, structure longer answers with clear headers or numbered steps, mention relevant pathways, hormones, enzymes, or structures by name, and where useful, note classic exam distinctions (e.g. EPSP vs IPSP, upper vs lower motor neuron signs). Offer mnemonics when they'd genuinely help retention. This is for academic study — engage with full technical depth rather than simplifying for a general audience, but if the person seems to be asking about their own personal health situation rather than studying, answer helpfully but note they should confirm anything health-decision-relevant with a real clinician.";
    
    if (moodNote) {
      system += ` For context only (never mention this explicitly unless relevant): the person's current facial expression reads as "${moodNote}". Let it inform your tone subtly, don't diagnose or call attention to it.`;
    }
    
    if (imageNote) {
      system += ` The person just uploaded an image. It appears to contain: ${imageNote}. Reference this in your response and help them understand, identify, or learn about what's in it.`;
    }

    const messages = [
      { role: "system", content: system },
      ...history.map(m => ({ role: m.role, content: m.content }))
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
    const reply = data.choices?.[0]?.message?.content?.trim() || "I didn't quite catch that — could you try again?";
    pushAssistant(reply);
    return reply;
  }

  return { load, save, clear, pushUser, pushAssistant, send, setMoodContextProvider, setImageContextProvider, getHistory: () => history };
})();
