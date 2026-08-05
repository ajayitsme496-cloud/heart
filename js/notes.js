// notes.js — save and organize study notes

const Notes = (() => {
  const STORAGE_KEY = "heart_study_notes";
  let allNotes = [];

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      allNotes = raw ? JSON.parse(raw) : [];
    } catch (e) {
      allNotes = [];
    }
    return allNotes;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotes));
  }

  function add(text, topic = "General") {
    const note = {
      id: Date.now(),
      text,
      topic,
      createdAt: new Date().toLocaleString(),
      editedAt: null
    };
    allNotes.unshift(note);
    save();
    return note;
  }

  function update(id, text, topic) {
    const note = allNotes.find(n => n.id === id);
    if (note) {
      note.text = text;
      note.topic = topic;
      note.editedAt = new Date().toLocaleString();
      save();
    }
    return note;
  }

  function remove(id) {
    allNotes = allNotes.filter(n => n.id !== id);
    save();
  }

  function search(query) {
    if (!query.trim()) return allNotes;
    const q = query.toLowerCase();
    return allNotes.filter(n => n.text.toLowerCase().includes(q) || n.topic.toLowerCase().includes(q));
  }

  function getAll() {
    return allNotes;
  }

  return { load, add, update, remove, search, getAll };
})();
