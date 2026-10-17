export const spanishVoices = (voices = []) => voices.filter(v => /^es(?:[-_]|$)/i.test(v.lang));

export function chooseVoice(voices, preferred = "") {
  const spanish = spanishVoices(voices);
  const selected = spanish.find(v => v.voiceURI === preferred);
  if (selected) return selected;
  const score = v => (/natural|neural|premium|enhanced|mejorada/i.test(v.name) ? 100 : 0)
    + (/^es[-_]MX$/i.test(v.lang) ? 20 : 0) + (v.default ? 5 : 0);
  return spanish.reduce((best, v) => !best || score(v) > score(best) ? v : best, null);
}
