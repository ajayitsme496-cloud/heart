// chat.js
//
// IMPORTANT SECURITY NOTE:
// This app calls the Anthropic API directly from the device with an embedded API key.
// That is only reasonable for a strictly personal app that you build and run yourself,
// never distributed to others (an API key baked into an app anyone else could install
// or decompile is a real exposure risk). If you ever want to share this app with other
// people, route requests through your own small backend server that holds the key
// instead, and have the app call your server.
//
// Put your key below before building. Get one at https://console.anthropic.com

const ANTHROPIC_API_KEY = "YOUR_API_KEY_HERE";

const Chat = (() => {
  const STORAGE_KEY = "heart_chat_history";
  let history = []; // {role, content, ts}
  let getMoodContext = () => null; // app.js can override this to inject current mood

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

    const apiMessages = history.map(m => ({ role: m.role, content: m.content }));

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages: apiMessages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const textBlocks = (data.content || []).filter(b => b.type === "text").map(b => b.text);
    const reply = textBlocks.join("\n").trim() || "I didn't quite catch that — could you try again?";
    pushAssistant(reply);
    return reply;
  }

  return { load, save, clear, pushUser, pushAssistant, send, setMoodContextProvider, getHistory: () => history };
})();
