import { getTemperature, getEscarcegaWeather } from "./weather";

const start = Date.parse("2026-10-02T18:00:00Z") / 1000;
const fixture = () => ({
  hourly_units: { temperature_2m: "°C" },
  hourly: { time: [start - 3600, start, start + 3600], temperature_2m: [21, 29.4, 31], temperature_2m_spread: [1, 2, 3] },
});
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => fixture() });
});
afterEach(() => { delete global.fetch; jest.useRealTimers(); });

test("selects this hour in Mexico City regardless of the device timezone", async () => {
  const message = await getTemperature((start + 1800) * 1000);
  expect(message).toContain("12:00");
  expect(message).toContain("29.4 grados Celsius");
  expect(message).toContain("18.6089, -90.7454");
  expect(message).toContain("no una medicion");
  expect(fetch.mock.calls[0][0]).toContain("timeformat=unixtime");
});
test.each(["missing", "null", "stale", "http", "network"])("handles %s without inventing a temperature", async (mode) => {
  const data = fixture();
  if (mode === "missing") delete data.hourly;
  if (mode === "null") data.hourly.temperature_2m[1] = null;
  if (mode === "stale") data.hourly.time = [start - 7200];
  if (mode === "network") fetch.mockRejectedValueOnce(new Error("offline"));
  else fetch.mockResolvedValueOnce({ ok: mode !== "http", json: async () => data });
  await expect(getTemperature(start * 1000)).rejects.toThrow("No pude consultar");
});
test("aborts an unresponsive request", async () => {
  jest.useFakeTimers();
  fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")));
  }));
  const outcome = expect(getTemperature(start * 1000)).rejects.toThrow("No pude consultar");
  jest.advanceTimersByTime(12000);
  await outcome;
});

describe("weather in Escarcega", () => {
  const forecast = () => ({
    hourly_units: { temperature_2m: "°C", precipitation_probability: "%", relative_humidity_2m: "%", wind_speed_10m: "km/h" },
    hourly: { time: [start - 3600, start], temperature_2m: [20, 31.2], weather_code: [0, 63],
      precipitation_probability: [0, 80], relative_humidity_2m: [40, 75], wind_speed_10m: [5, 12.5] },
  });
  test("reports this hour, conditions, rain probability, humidity and wind for Campeche", async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => forecast() });
    const message = await getEscarcegaWeather(start * 1000);
    expect(message).toContain("Escárcega, Campeche");
    expect(message).toContain("31.2 grados");
    expect(message).toContain("12:00");
    expect(message).toContain("lluvia moderada");
    expect(message).toContain("80 por ciento");
    expect(message).toContain("75 por ciento");
    expect(message).toContain("12.5 kilómetros");
    expect(fetch.mock.calls[0][0]).toContain("api.open-meteo.com/v1/forecast");
  });
  test("omits unavailable optional fields instead of treating null as zero or clear skies", async () => {
    const d = forecast();
    for (const key of ["weather_code", "precipitation_probability", "relative_humidity_2m", "wind_speed_10m"]) d.hourly[key][1] = null;
    fetch.mockResolvedValueOnce({ ok: true, json: async () => d });
    const message = await getEscarcegaWeather(start * 1000);
    expect(message).toContain("31.2 grados");
    expect(message).not.toMatch(/Condiciones|Probabilidad|Humedad|Viento/);
  });
  test.each(["stale", "missing", "http", "network"])("handles %s data", async (mode) => {
    const d = forecast();
    if (mode === "stale") d.hourly.time = [start - 7200];
    if (mode === "missing") d.hourly.temperature_2m[1] = null;
    if (mode === "network") fetch.mockRejectedValueOnce(new Error("offline"));
    else fetch.mockResolvedValueOnce({ ok: mode !== "http", json: async () => d });
    await expect(getEscarcegaWeather(start * 1000)).rejects.toThrow("No pude consultar el clima de Escárcega");
  });
  test("times out", async () => {
    jest.useFakeTimers();
    fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const outcome = expect(getEscarcegaWeather(start * 1000)).rejects.toThrow("No pude consultar");
    jest.advanceTimersByTime(12000);
    await outcome;
  });
});
