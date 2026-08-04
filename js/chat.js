// chat.js
//
// This uses Google's Gemini API (generativelanguage.googleapis.com), which has
// a free tier — good for a personal app like this with no billing required.
//
// SECURITY NOTE: This key is embedded in the app and visible to anyone who
// finds your page's URL. Keep this project personal — don't share the link.
// Get your key at https://aistudio.google.com/apikey

const GEMINI_API_KEY = "AQ.Ab8RN6JLuFZ88WrgnzkOXJeHp4vs06CnToxMzN5kOCzW4Hr24w";
const GEMINI_MODEL = "gemini-2.0-flash";

const Chat = (() => {
  const STORAGE_KEY = "heart_chat_history";
  let history = []; // {role: 'user'|'assistant', content, ts}
  let getMoodContext = () => null;

  function setMoodContextProvider(fn) {
    getMoodContext = fn;
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
    let system = "You are Heart, a warm, capable, all-purpose personal assistant. " +
      "You help with anything: planning, learning, brainstorming, emotional check-ins, or casual conversation. " +
      "Be concise, direct, and genuinely helpful. Adapt your tone to what the person needs in the moment.";
    if (moodNote) {
      system += ` For context only (never mention this explicitly unless relevant): the person's current facial expression reads as "${moodNote}". Let it inform your tone subtly, don't diagnose or call attention to it.`;
    }

    // Gemini expects roles "user" and "model" (not "assistant")
    const contents = history.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const reply = parts.map(p => p.text).join("\n").trim() || "I didn't quite catch that — could you try again?";
    pushAssistant(reply);
    return reply;
  }

  return { load, save, clear, pushUser, pushAssistant, send, setMoodContextProvider, getHistory: () => history };
})();
