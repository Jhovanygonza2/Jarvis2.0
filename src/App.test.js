import userEvent from "@testing-library/user-event";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("./Orb3D", () => () => <div data-testid="orb" />);
jest.mock("./useVoiceControls", () => ({
  __esModule: true,
  default: (onCommand) => ({
    transcript: "", listening: false, micEnabled: false, speaking: false,
    muted: false, busy: false, micError: "", voiceError: "", analyser: null,
    browserSupportsSpeechRecognition: false,
    hablar: jest.fn(), execute: onCommand, toggleMic: jest.fn(),
    toggleMuted: jest.fn(), stopSpeaking: jest.fn(),
  }),
}));

process.env.REACT_APP_YOUTUBE_API_KEY = "test-key";
const App = require("./App").default;

function send(text) {
  fireEvent.change(screen.getByLabelText("Escribe un comando"), { target: { value: text } });
  fireEvent.submit(screen.getByRole("button", { name: "Enviar" }).closest("form"));
}

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      items: Array.from({ length: 5 }, (_, i) => ({
        id: { videoId: "video-" + (i + 1) },
        snippet: { title: "Resultado " + (i + 1), channelTitle: "Canal", thumbnails: { medium: { url: "thumbnail.jpg" } } },
      })),
    }),
  });
});
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

test("can submit text without speech recognition and clears the input", async () => {
  render(<App />);
  expect(screen.getByRole("button", { name: "Activar micrófono" })).toBeDisabled();
  send("Hola");
  expect(await screen.findByText("Hola. ¿En qué puedo ayudarte?")).toBeInTheDocument();
  expect(screen.getByLabelText("Escribe un comando")).toHaveValue("");
});

test("ignores blank commands", () => {
  render(<App />);
  send("   ");
  expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  expect(screen.getByText("0 ENTRADAS")).toBeInTheDocument();
});

test.each([["1", 1], ["2", 2], ["3", 3], ["4", 4], ["5", 5], ["reproduce el primero", 1]])(
  "selects %s before attempting another search", async (command, number) => {
    render(<App />);
    send("buscar en jarvis galaxias");
    await screen.findByText("Encontré 5 videos de \"galaxias\". Di el número para reproducir.");
    send(command);
    await waitFor(() => {
      const frame = document.querySelector("iframe");
      expect(frame).toHaveAttribute("src", "https://www.youtube.com/embed/video-" + number + "?autoplay=1");
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  }
);

test("explains a missing result without searching for an ordinal", async () => {
  render(<App />);
  send("reproduce el primero");
  const log = screen.getByRole("log");
  expect(await within(log).findByText(/No hay un video en esa posición/)).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test.each([undefined, { isActive: false }])("opens WhatsApp in the same tab with activation %j", async (activation) => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "userActivation");
  Object.defineProperty(navigator, "userActivation", { configurable: true, value: activation });
  try {
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<App />);
  send("abre WhatsApp ahora");
  expect(await screen.findByText(/Intentando abrir WhatsApp Web/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Abrir WhatsApp Web" })).toHaveAttribute("href", "https://web.whatsapp.com");
  expect(click).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("link", { name: "Abrir WhatsApp Web" })).toHaveAttribute("target", "_self");
  expect(click.mock.instances[0].href).toBe("https://web.whatsapp.com/");
  expect(click.mock.instances[0].target).toBe("_self");
  send("hola");
  await waitFor(() => expect(screen.queryByRole("link", { name: "Abrir WhatsApp Web" })).not.toBeInTheDocument());
  } finally {
    if (descriptor) Object.defineProperty(navigator, "userActivation", descriptor);
    else delete navigator.userActivation;
  }
});
test("explains unknown commands", async () => {
  render(<App />);
  send("enciende las luces");
  expect(await screen.findByText(/No reconocí ese comando/)).toBeInTheDocument();
});
test("selects a video with the keyboard", async () => {
  render(<App />);
  send("buscar en jarvis galaxias");
  const button = await screen.findByRole("button", { name: "Reproducir video 1: Resultado 1" });
  button.focus();
  userEvent.keyboard("{Enter}");
  expect(document.querySelector("iframe")).toHaveAttribute("title", "Resultado 1");
});
test("clears previous results when the next search is empty", async () => {
  render(<App />);
  send("buscar en jarvis galaxias");
  await screen.findByRole("button", { name: "Reproducir video 1: Resultado 1" });
  global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });
  send("buscar en jarvis nada");
  await waitFor(() => expect(screen.getAllByText(/No encontré videos/).length).toBeGreaterThan(0));
  expect(screen.queryByRole("button", { name: "Reproducir video 1: Resultado 1" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reintentar búsqueda" })).not.toBeInTheDocument();
});
test("allows retry after a connection error", async () => {
  global.fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  render(<App />);
  send("buscar en jarvis galaxias");
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar búsqueda" }));
  expect(await screen.findByRole("button", { name: "Reproducir video 1: Resultado 1" })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(2);
});


test.each([
  ["Android", "abre WhatsApp"],
  ["iPhone", "abre whats app"],
  ["iPad", "ponme WhatsApp"],
  ["Android", "abre wasap"],
])("offers the native app on %s for %s", async (device, command) => {
  jest.spyOn(navigator, "userAgent", "get").mockReturnValue(device);
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<App />);
  send(command);
  const link = await screen.findByRole("link", { name: "Abrir WhatsApp" });
  expect(link).toHaveAttribute("href", "whatsapp://send");
  expect(link).toHaveAttribute("target", "_self");
  expect(screen.getByRole("link", { name: /descárgalo aquí/ })).toHaveAttribute("href", "https://www.whatsapp.com/download");
  expect(screen.getByText(/Intentando abrir WhatsApp/)).toBeInTheDocument();
  expect(click).toHaveBeenCalledTimes(1);
  expect(global.fetch).not.toHaveBeenCalled();
});

test("attempts native launch when the browser has active user interaction", async () => {
  jest.spyOn(navigator, "userAgent", "get").mockReturnValue("Android");
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "userActivation");
  Object.defineProperty(navigator, "userActivation", { configurable: true, value: { isActive: true } });
  const launched = [];
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    launched.push({ url: this.getAttribute("href"), target: this.target });
  });
  try {
    render(<App />);
    send("abre WhatsApp");
    expect(await screen.findByText(/Intentando abrir WhatsApp/)).toBeInTheDocument();
    expect(launched).toEqual([{ url: "whatsapp://send", target: "_self" }]);
  } finally {
    if (descriptor) Object.defineProperty(navigator, "userActivation", descriptor);
    else delete navigator.userActivation;
  }
});


test.each([
  ["clima", "clima actual"],
  ["clima de Monterrey", "clima monterrey"],
  ["dime el clima en Puebla", "clima puebla"],
  ["busca el clima de Ciudad de Mexico", "clima ciudad de mexico"],
  ["tiempo en Guadalajara", "clima guadalajara"],
  ["clima en Cancun por favor", "clima cancun"],
])("opens weather automatically for %s without active interaction", async (command, query) => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "userActivation");
  Object.defineProperty(navigator, "userActivation", { configurable: true, value: { isActive: false } });
  const launched = [];
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    launched.push({ url: this.href, target: this.target });
  });
  try {
    render(<App />);
    send(command);
    await screen.findByText(/Buscando el clima/);
    expect(launched).toEqual([{
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      target: "_self",
    }]);
    expect(global.fetch).not.toHaveBeenCalled();
  } finally {
    if (descriptor) Object.defineProperty(navigator, "userActivation", descriptor);
    else delete navigator.userActivation;
  }
});

test("shows the configured location forecast through a text command", async () => {
  const hour = Math.floor(Date.now() / 3600000) * 3600;
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({
    hourly_units: { temperature_2m: "°C" },
    hourly: { time: [hour], temperature_2m: [28.5] },
  }) });
  render(<App />);
  send("dime la temperatura");
  expect(await screen.findByText(/28.5 grados Celsius/)).toBeInTheDocument();
  expect(fetch.mock.calls[0][0]).toContain("ensemble-api.open-meteo.com");
});
test("reports a weather failure and accepts the next command", async () => {
  fetch.mockRejectedValueOnce(new Error("offline"));
  render(<App />);
  send("dime la temperatura");
  expect(await screen.findByText(/No pude consultar la temperatura/)).toBeInTheDocument();
  send("hola");
  expect(await screen.findByText(/puedo ayudarte/)).toBeInTheDocument();
});

test("answers the weather in Escarcega without navigating away", async () => {
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const hour = Math.floor(Date.now() / 3600000) * 3600;
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({
    hourly_units: { temperature_2m: "°C", precipitation_probability: "%" },
    hourly: { time: [hour], temperature_2m: [30], weather_code: [3], precipitation_probability: [65] },
  }) });
  render(<App />);
  send("dime el clima de Escárcega");
  expect(await screen.findByText(/Open-Meteo prevé 30 grados/)).toBeInTheDocument();
  expect(screen.getByText(/65 por ciento/)).toBeInTheDocument();
  expect(click).not.toHaveBeenCalled();
});
test("a failed Escarcega query leaves commands usable", async () => {
  fetch.mockRejectedValueOnce(new Error("offline"));
  render(<App />);
  send("clima de Escárcega");
  expect(await screen.findByText(/No pude consultar el clima de Escárcega/)).toBeInTheDocument();
  send("hola");
  expect(await screen.findByText(/puedo ayudarte/)).toBeInTheDocument();
});

test.each([
  ["video de galaxias", "galaxias"],
  ["busca en youtube gatos", "gatos"],
  ["reproduce musica relajante", "musica relajante"],
  ["ponme rock", "rock"],
])("opens YouTube directly for %s without requiring active interaction", async (command, query) => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "userActivation");
  Object.defineProperty(navigator, "userActivation", { configurable: true, value: { isActive: false } });
  const launched = [];
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
    launched.push({ url: this.href, target: this.target });
  });
  try {
    render(<App />);
    send(command);
    expect(await screen.findByText(/Abriendo YouTube para buscar/)).toBeInTheDocument();
    expect(launched).toEqual([{ url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, target: "_self" }]);
    expect(screen.getByRole("link", { name: "Abrir YouTube" })).toHaveAttribute("target", "_self");
    expect(fetch).not.toHaveBeenCalled();
    expect(document.querySelector("iframe")).toBeNull();
  } finally {
    if (descriptor) Object.defineProperty(navigator, "userActivation", descriptor);
    else delete navigator.userActivation;
  }
});

test.each([
  ["YouTube música relajante", "música relajante"],
  ["YouTube WhatsApp tutorial", "WhatsApp tutorial"],
  ["YouTube clima de Escárcega", "clima de Escárcega"],
  ["abre youtube y busca gatos", "gatos"],
  ["busca galaxias en youtube", "galaxias"],
])("opens the requested YouTube topic: %s", async (command, query) => {
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<App />);
  send(command);
  const link = await screen.findByRole("link", { name: "Abrir YouTube" });
  expect(link).toHaveAttribute("href", "https://www.youtube.com/results?search_query=" + encodeURIComponent(query));
  expect(link).toHaveAttribute("target", "_self");
  expect(click).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
});
test("opens the YouTube homepage only when no topic is provided", async () => {
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<App />);
  send("YouTube");
  expect(await screen.findByRole("link", { name: "Abrir YouTube" })).toHaveAttribute("href", "https://www.youtube.com");
});


test("mobile commands click the native destination and offer an explicit web fallback", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "userAgent");
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Android" });
  try {
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<App />);
    await act(async () => { send("YouTube rock & roll"); });
    expect(click.mock.instances[0].href).toContain("intent://www.youtube.com/results?search_query=rock%20%26%20roll#Intent;");
    expect(screen.getByRole("link", { name: "Abrir YouTube en el navegador" })).toHaveAttribute("href", "https://www.youtube.com/results?search_query=rock%20%26%20roll");
    await act(async () => { send("ponme jazz en spotify"); });
    expect(click.mock.instances[1].href).toContain("intent://open.spotify.com/search/jazz#Intent;");
    expect(screen.getByRole("link", { name: "Abrir Spotify" })).toBeInTheDocument();
  } finally {
    if (descriptor) Object.defineProperty(navigator, "userAgent", descriptor);
    else delete navigator.userAgent;
  }
});
