import { act, renderHook } from "@testing-library/react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import useVoiceControls from "./useVoiceControls";

jest.mock("react-speech-recognition", () => {
  const manager = { listening: false };
  return {
    __esModule: true,
    default: {
      getRecognitionManager: () => manager,
      startListening: jest.fn(async () => { manager.listening = true; }),
      abortListening: jest.fn(async () => { manager.listening = false; }),
    },
    useSpeechRecognition: jest.fn(),
  };
});

let recognition;
let track;
let command;
let utterances;
const flush = async () => { await act(async () => {}); };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  SpeechRecognition.getRecognitionManager().listening = false;
  SpeechRecognition.startListening.mockImplementation(async () => { SpeechRecognition.getRecognitionManager().listening = true; });
  SpeechRecognition.abortListening.mockImplementation(async () => { SpeechRecognition.getRecognitionManager().listening = false; });
  SpeechRecognition.getRecognitionManager().recognition = new EventTarget();
  recognition = {
    finalTranscript: "", transcript: "", listening: false, resetTranscript: jest.fn(() => { recognition.transcript = ""; }),
    browserSupportsSpeechRecognition: true, browserSupportsContinuousListening: true, isMicrophoneAvailable: true,
  };
  useSpeechRecognition.mockImplementation(() => recognition);
  track = { stop: jest.fn() };
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
    getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [track] }),
  } });
  utterances = [];
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    cancel: jest.fn(), speak: jest.fn((utterance) => utterances.push(utterance)),
  } });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
  command = jest.fn().mockResolvedValue(undefined);
});
afterEach(() => { jest.useRealTimers(); });

test("does not request a microphone or speak on mount", () => {
  renderHook(() => useVoiceControls(command));
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  expect(SpeechRecognition.startListening).not.toHaveBeenCalled();
  expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
});

test("stops recognition before speaking and resumes after the response", async () => {
  const { result } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  expect(SpeechRecognition.startListening).toHaveBeenCalledTimes(1);
  let endRecognition;
  SpeechRecognition.abortListening.mockImplementationOnce(() => new Promise((resolve) => {
    endRecognition = () => { SpeechRecognition.getRecognitionManager().listening = false; resolve(); };
  }));
  act(() => { void result.current.hablar("Hola"); });
  await flush();
  expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  await act(async () => { endRecognition(); });
  expect(utterances[0].text).toBe("Hola");
  expect(track.stop).toHaveBeenCalled();
  await act(async () => { utterances[0].onend(); });
  expect(SpeechRecognition.startListening).toHaveBeenCalledTimes(2);
});

test("pausing during a response prevents automatic microphone restart", async () => {
  const { result } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  await act(async () => { await result.current.hablar("Hola"); });
  await act(async () => { result.current.toggleMic(); });
  await act(async () => { utterances[0].onend(); });
  expect(SpeechRecognition.startListening).toHaveBeenCalledTimes(1);
  expect(result.current.micEnabled).toBe(false);
});

test("stopping a response resumes enabled listening and ignores late events", async () => {
  const { result } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  await act(async () => { await result.current.hablar("Hola"); });
  await act(async () => { result.current.stopSpeaking(); });
  expect(result.current.speaking).toBe(false);
  expect(SpeechRecognition.startListening).toHaveBeenCalledTimes(2);
  await act(async () => { utterances[0].onend(); });
  expect(SpeechRecognition.startListening).toHaveBeenCalledTimes(2);
});

test("mute cancels the response and suppresses future speech", async () => {
  const { result } = renderHook(() => useVoiceControls(command));
  await act(async () => { await result.current.hablar("Hola"); });
  await act(async () => { result.current.toggleMuted(); });
  await act(async () => { await result.current.hablar("Otra respuesta"); });
  expect(result.current.muted).toBe(true);
  expect(result.current.speaking).toBe(false);
  expect(utterances).toHaveLength(1);
});

test("permission denial leaves text commands usable", async () => {
  navigator.mediaDevices.getUserMedia.mockRejectedValueOnce({ name: "NotAllowedError" });
  const { result } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  expect(result.current.micError).toMatch(/Permiso de micrófono denegado/);
  expect(result.current.micEnabled).toBe(false);
  await act(async () => { await result.current.execute("hola"); });
  expect(command).toHaveBeenCalledWith("hola");
});

test("a pending microphone request cannot reactivate after pausing", async () => {
  let grant;
  navigator.mediaDevices.getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
  const { result } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  act(() => { result.current.toggleMic(); });
  await act(async () => { grant({ getTracks: () => [track] }); });
  expect(track.stop).toHaveBeenCalled();
  expect(SpeechRecognition.startListening).not.toHaveBeenCalled();
});

test("pausing cancels the pending transcript command", async () => {
  const { result, rerender } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  recognition.transcript = "hola";
  rerender();
  await act(async () => { result.current.toggleMic(); });
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(command).not.toHaveBeenCalled();
});

test("a voice command is processed once after silence", async () => {
  const { result, rerender } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  recognition.transcript = "dime la hora";
  rerender();
  await act(async () => { jest.advanceTimersByTime(1500); });
  expect(command).toHaveBeenCalledTimes(1);
  expect(command).toHaveBeenCalledWith("dime la hora");
});

test("unmount releases microphone and cancels speech", async () => {
  const { result, unmount } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  unmount();
  await flush();
  expect(track.stop).toHaveBeenCalled();
  expect(SpeechRecognition.abortListening).toHaveBeenCalled();
  expect(window.speechSynthesis.cancel).toHaveBeenCalled();
});

 test.each(["dime la hora", ""])("mobile session ends cleanly with transcript %s", async (text) => {
  recognition.browserSupportsContinuousListening = false;
  const { result, rerender } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  expect(SpeechRecognition.startListening).toHaveBeenCalledWith({ continuous: false, language: "es-MX" });
  recognition.listening = true;
  rerender();
  recognition.transcript = text;
  recognition.listening = false;
  SpeechRecognition.getRecognitionManager().listening = false;
  rerender();
  await flush();
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(result.current.micEnabled).toBe(false);
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  expect(command).toHaveBeenCalledTimes(text ? 1 : 0);
  if (text) expect(command).toHaveBeenCalledWith(text);
  expect(SpeechRecognition.startListening).toHaveBeenCalledTimes(1);
  await act(async () => { result.current.toggleMic(); });
  expect(SpeechRecognition.startListening).toHaveBeenCalledTimes(2);
});

 test("mobile recognition starts in the tap without waiting for audio capture", async () => {
  recognition.browserSupportsContinuousListening = false;
  const { result } = renderHook(() => useVoiceControls(command));
  act(() => {
    result.current.toggleMic();
    expect(SpeechRecognition.startListening).toHaveBeenCalledTimes(1);
  });
  await flush();
  expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
});

test("mobile waits for phrase completion instead of executing partial text", async () => {
  recognition.browserSupportsContinuousListening = false;
  const { result, rerender } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  recognition.listening = true;
  recognition.transcript = "busca";
  rerender();
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(command).not.toHaveBeenCalled();
  recognition.transcript = "busca galaxias";
  recognition.listening = false;
  SpeechRecognition.getRecognitionManager().listening = false;
  rerender();
  await flush();
  expect(command).toHaveBeenCalledTimes(1);
  expect(command).toHaveBeenCalledWith("busca galaxias");
});

test("mobile rejects insecure origins before requesting recognition", async () => {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
  try {
    recognition.browserSupportsContinuousListening = false;
    const { result } = renderHook(() => useVoiceControls(command));
    await act(async () => { result.current.toggleMic(); });
    expect(SpeechRecognition.startListening).not.toHaveBeenCalled();
    expect(result.current.micError).toMatch(/HTTPS/);
    expect(result.current.micEnabled).toBe(false);
  } finally {
    delete window.isSecureContext;
  }
});

test("mobile executes a final phrase before the service disconnects, only once", async () => {
  recognition.browserSupportsContinuousListening = false;
  const { result, rerender } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  recognition.listening = true;
  rerender();
  recognition.transcript = recognition.finalTranscript = "dime la hora";
  rerender();
  await flush();
  expect(command).toHaveBeenCalledTimes(1);
  expect(command).toHaveBeenCalledWith("dime la hora");
  expect(result.current.micEnabled).toBe(false);
  recognition.listening = false;
  rerender();
  await flush();
  expect(command).toHaveBeenCalledTimes(1);
});

test("a new mobile session accepts a final-only result after the previous session", async () => {
  recognition.browserSupportsContinuousListening = false;
  const manager = SpeechRecognition.getRecognitionManager();
  const { result } = renderHook(() => useVoiceControls(command));
  manager.previousResultWasFinalOnly = true;
  act(() => {
    result.current.toggleMic();
    expect(manager.previousResultWasFinalOnly).toBe(false);
  });
  await flush();
});

test.each(["network", "audio-capture", "service-not-allowed"])(
  "mobile shows recognition error %s and leaves text commands usable", async (error) => {
    recognition.browserSupportsContinuousListening = false;
    const { result } = renderHook(() => useVoiceControls(command));
    await act(async () => { result.current.toggleMic(); });
    const event = new Event("error");
    event.error = error;
    act(() => { SpeechRecognition.getRecognitionManager().recognition.dispatchEvent(event); });
    expect(result.current.micEnabled).toBe(false);
    expect(result.current.micError).not.toBe("");
    await act(async () => { await result.current.execute("hola"); });
    expect(command).toHaveBeenCalledWith("hola");
  }
);

test("mobile reports a start failure swallowed by the recognition library", async () => {
  recognition.browserSupportsContinuousListening = false;
  SpeechRecognition.startListening.mockResolvedValueOnce(undefined);
  const { result } = renderHook(() => useVoiceControls(command));
  await act(async () => { result.current.toggleMic(); });
  expect(result.current.micEnabled).toBe(false);
  expect(result.current.micError).toMatch(/No se pudo activar/);
});


test("loads delayed Spanish voices and uses the chosen voice with normal pitch", async () => {
  localStorage.clear();
  const synth = window.speechSynthesis;
  const events = new EventTarget();
  synth.addEventListener = events.addEventListener.bind(events);
  synth.removeEventListener = events.removeEventListener.bind(events);
  synth.getVoices = jest.fn(() => []);
  const { result, unmount } = renderHook(() => useVoiceControls(command));
  const voice = { voiceURI: "test-es", lang: "es-MX", name: "Spanish" };
  synth.getVoices.mockReturnValue([voice, { lang: "en-US", name: "English" }]);
  act(() => events.dispatchEvent(new Event("voiceschanged")));
  expect(result.current.voices).toEqual([voice]);
  act(() => result.current.selectVoice("test-es"));
  await act(async () => { await result.current.hablar("Hola"); });
  expect(utterances[0].voice).toBe(voice);
  expect(utterances[0].pitch).toBe(1);
  expect(utterances[0].rate).toBe(1);
  expect(localStorage.getItem("jarvis.voice")).toBe("test-es");
  unmount();
  localStorage.clear();
});
