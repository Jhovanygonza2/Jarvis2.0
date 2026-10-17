import { chooseVoice } from "./speechVoices";
const mx = { voiceURI: "mx", lang: "es-MX", name: "Español" };
const enhanced = { voiceURI: "premium", lang: "es-ES", name: "Español Premium" };
test("prefers enhanced Spanish without selecting English", () => {
  expect(chooseVoice([{ lang: "en-US", name: "Natural" }, mx, enhanced])).toBe(enhanced);
  expect(chooseVoice([enhanced, mx], "mx")).toBe(mx);
  expect(chooseVoice([mx], "removed")).toBe(mx);
  expect(chooseVoice([{ lang: "en-US" }])).toBeNull();
});
