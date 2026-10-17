import { searchYouTube } from "./youtube";
afterEach(() => { jest.useRealTimers(); delete global.fetch; });
test.each([[403, "quotaExceeded", /límite/], [403, "forbidden", /clave y los permisos/], [500, "", /no está disponible/]])(
  "explains HTTP %s (%s)", async (status, reason, message) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status, json: async () => ({ error: { errors: [{ reason }] } }) });
    await expect(searchYouTube("galaxias", "key")).rejects.toThrow(message);
  }
);
test("explains missing configuration without a request", async () => {
  global.fetch = jest.fn();
  await expect(searchYouTube("galaxias", "")).rejects.toThrow(/no está configurada/);
  expect(global.fetch).not.toHaveBeenCalled();
});
test("aborts a slow request and clears its timeout", async () => {
  jest.useFakeTimers();
  let signal;
  global.fetch = jest.fn((url, options) => {
    signal = options.signal;
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  });
  const result = expect(searchYouTube("galaxias", "key", 10000)).rejects.toThrow(/tardó demasiado/);
  jest.advanceTimersByTime(10000);
  await result;
  expect(signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
