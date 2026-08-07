const TextEmotion = (() => {
  const patterns = {
    stressed: /\b(stressed|overwhelmed|so much to do|can't keep up|pressure|deadline|panicking|freaking out)\b/i,
    sad: /\b(sad|down|upset|hurt|lonely|crying|heartbroken|miss(ing)? (him|her|them)|depress)\b/i,
    anxious: /\b(anxious|nervous|worried|scared|afraid|dread|what if)\b/i,
    frustrated: /\b(frustrated|annoyed|angry|pissed|fed up|sick of|hate this)\b/i,
    tired: /\b(exhausted|tired|drained|burnt out|burned out|can't focus|no energy)\b/i,
    excited: /\b(excited|can't wait|thrilled|pumped|so happy|amazing news|yes+!)\b/i,
    proud: /\b(proud|nailed it|finally did it|accomplished|passed|aced)\b/i
  };

  function analyze(text) {
    if (!text || !text.trim()) return null;
    for (const [emotion, regex] of Object.entries(patterns)) {
      if (regex.test(text)) return emotion;
    }
    return null;
  }

  return { analyze };
})();const TextEmotion = (() => {
  const patterns = {
    stressed: /\b(stressed|overwhelmed|so much to do|can't keep up|pressure|deadline|panicking|freaking out)\b/i,
    sad: /\b(sad|down|upset|hurt|lonely|crying|heartbroken|miss(ing)? (him|her|them)|depress)\b/i,
    anxious: /\b(anxious|nervous|worried|scared|afraid|dread|what if)\b/i,
    frustrated: /\b(frustrated|annoyed|angry|pissed|fed up|sick of|hate this)\b/i,
    tired: /\b(exhausted|tired|drained|burnt out|burned out|can't focus|no energy)\b/i,
    excited: /\b(excited|can't wait|thrilled|pumped|so happy|amazing news|yes+!)\b/i,
    proud: /\b(proud|nailed it|finally did it|accomplished|passed|aced)\b/i
  };

  function analyze(text) {
    if (!text || !text.trim()) return null;
    for (const [emotion, regex] of Object.entries(patterns)) {
      if (regex.test(text)) return emotion;
    }
    return null;
  }

  return { analyze };
})();
