import { useCallback, useEffect, useRef, useState } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

import { chooseVoice, spanishVoices } from "./speechVoices";

function microphoneMessage(error) {
  if (error?.name === "InsecureContextError") {
    return "Para usar el micrófono, abre Jarvis mediante HTTPS o localhost. Mientras tanto, puedes escribir tus comandos.";
  }
  if (["NotAllowedError", "SecurityError"].includes(error?.name)) {
    return "Permiso de micrófono denegado. Habilítalo en tu navegador y vuelve a activar el micrófono.";
  }
  if (error?.name === "NotFoundError") return "No se encontró un micrófono. Puedes escribir tu comando.";
  if (error?.name === "NotReadableError") return "No se pudo acceder al micrófono. Revisa si otra aplicación lo está usando.";
  return "No se pudo activar el micrófono. Puedes escribir tu comando e intentarlo de nuevo.";
}

export default function useVoiceControls(onCommand) {
  const [micEnabled, setMicEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micError, setMicError] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [analyser, setAnalyser] = useState(null);
  const [voices, setVoices] = useState([]);
  const [preferredVoice, setPreferredVoice] = useState(() => {
    try { return localStorage.getItem("jarvis.voice") || ""; } catch { return ""; }
  });
  const selectVoice = useCallback((value) => {
    setPreferredVoice(value);
    try { localStorage.setItem("jarvis.voice", value); } catch { /* Storage is optional. */ }
  }, []);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const refresh = () => setVoices(spanishVoices(synth.getVoices?.() || []));
    refresh();
    synth.addEventListener?.("voiceschanged", refresh);
    return () => synth.removeEventListener?.("voiceschanged", refresh);
  }, []);
  const {
    transcript, resetTranscript, listening, browserSupportsSpeechRecognition,
    isMicrophoneAvailable, browserSupportsContinuousListening: supportsContinuous,
  } = useSpeechRecognition({ transcribing: micEnabled && !speaking && !busy });

  // Mobile recognition owns the microphone; do not open a competing visualizer stream.
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const browserSupportsContinuousListening = supportsContinuous === true && !mobile;

  const state = useRef({
    mounted: false, enabled: false, speaking: false, muted: false, busy: false,
    speechId: 0, timer: null, stream: null, audioContext: null,
    queue: Promise.resolve(), heardSession: false,
  });
  const commandRef = useRef(onCommand);
  commandRef.current = onCommand;
  const resetRef = useRef(resetTranscript);
  resetRef.current = resetTranscript;

  const clearPending = useCallback(() => {
    clearTimeout(state.current.timer);
    state.current.timer = null;
  }, []);

  const releaseAudio = useCallback(() => {
    const current = state.current;
    current.stream?.getTracks().forEach((track) => track.stop());
    current.stream = null;
    if (current.audioContext) {
      current.audioContext.close().catch(() => {});
      current.audioContext = null;
    }
    if (current.mounted) setAnalyser(null);
  }, []);

  // Serialize start/abort operations, then recheck user intent after every await.
  const syncMicrophone = useCallback(() => {
    const current = state.current;
    const shouldListen = () => current.mounted && current.enabled && !current.speaking && !current.busy;
    current.queue = current.queue.catch(() => {}).then(async () => {
      if (!shouldListen()) {
        clearPending();
        releaseAudio();
        // In this library abortListening never resolves when already stopped.
        if (SpeechRecognition.getRecognitionManager().listening) {
          await SpeechRecognition.abortListening();
        }
        if (current.mounted) resetRef.current();
        return;
      }
      if (browserSupportsContinuousListening && !current.stream) {
        if (window.isSecureContext === false) {
          const error = new Error("HTTPS required");
          error.name = "InsecureContextError";
          throw error;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Microphone unavailable");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!shouldListen()) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        current.stream = stream;
        // The visualizer is optional; recognition can work without Web Audio.
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          try {
            const context = new AudioContext();
            current.audioContext = context;
            const nextAnalyser = context.createAnalyser();
            nextAnalyser.fftSize = 256;
            context.createMediaStreamSource(stream).connect(nextAnalyser);
            setAnalyser(nextAnalyser);
          } catch {
            if (current.audioContext) current.audioContext.close().catch(() => {});
            current.audioContext = null;
          }
        }
      }
      if (!shouldListen()) return;
      if (!SpeechRecognition.getRecognitionManager().listening) {
        resetRef.current();
        await SpeechRecognition.startListening({ continuous: browserSupportsContinuousListening === true, language: "es-MX" });
      }
    }).catch((error) => {
      releaseAudio();
      if (!current.mounted || !current.enabled) return;
      current.enabled = false;
      setMicEnabled(false);
      setMicError(microphoneMessage(error));
    });
    return current.queue;
  }, [clearPending, releaseAudio, browserSupportsContinuousListening]);

  const toggleMic = useCallback(() => {
    const current = state.current;
    current.enabled = !current.enabled;
    setMicEnabled(current.enabled);
    setMicError("");
    clearPending();
    if (current.enabled && window.isSecureContext === false) {
      current.enabled = false;
      setMicEnabled(false);
      setMicError(microphoneMessage({ name: "InsecureContextError" }));
      return;
    }
    if (current.enabled && !browserSupportsContinuousListening && !current.busy && !current.speaking) {
      // Start within the button gesture, before any permission request or queue await.
      resetRef.current();
      // v4 retains this duplicate-result flag across single-phrase sessions.
      // A new session must accept its first final result, even without interim text.
      SpeechRecognition.getRecognitionManager().previousResultWasFinalOnly = false;
      current.queue = SpeechRecognition.startListening({ continuous: false, language: "es-MX" })
        .then(() => {
          if (current.mounted && current.enabled && !SpeechRecognition.getRecognitionManager().listening) {
            throw new Error("Recognition did not start");
          }
        })
        .catch((error) => {
          if (!current.mounted || !current.enabled) return;
          current.enabled = false;
          setMicEnabled(false);
          setMicError(microphoneMessage(error));
        });
      return;
    }
    void syncMicrophone();
  }, [clearPending, syncMicrophone, browserSupportsContinuousListening]);

  const stopSpeaking = useCallback(() => {
    const current = state.current;
    current.speechId += 1;
    current.speaking = false;
    window.speechSynthesis?.cancel();
    if (current.mounted) setSpeaking(false);
    void syncMicrophone();
  }, [syncMicrophone]);

  const toggleMuted = useCallback(() => {
    state.current.muted = !state.current.muted;
    setMuted(state.current.muted);
    if (state.current.muted) stopSpeaking();
  }, [stopSpeaking]);

  const hablar = useCallback(async (text) => {
    const current = state.current;
    if (!current.mounted || current.muted) return;
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      setVoiceError("La voz de respuesta no está disponible. Puedes leer las respuestas en el registro.");
      return;
    }
    const id = ++current.speechId;
    current.speaking = true;
    setSpeaking(true);
    setVoiceError("");
    clearPending();
    window.speechSynthesis.cancel();
    await syncMicrophone();
    if (!current.mounted || id !== current.speechId || current.muted) return;

    const finish = (error = false) => {
      if (!current.mounted || id !== current.speechId) return;
      current.speaking = false;
      setSpeaking(false);
      if (error) setVoiceError("No se pudo reproducir la respuesta. Puedes leerla en el registro.");
      void syncMicrophone();
    };
    try {
      const utterance = new window.SpeechSynthesisUtterance(text);
      const voice = chooseVoice(window.speechSynthesis.getVoices?.() || [], preferredVoice);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "es-MX";
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = () => finish();
      utterance.onerror = () => finish(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      finish(true);
    }
  }, [clearPending, syncMicrophone, preferredVoice]);

  const execute = useCallback(async (text) => {
    const command = text.trim();
    const current = state.current;
    if (!command || current.busy) return false;
    current.busy = true;
    if (browserSupportsContinuousListening !== true) {
      current.enabled = false;
      setMicEnabled(false);
    }
    setBusy(true);
    clearPending();
    stopSpeaking();
    await syncMicrophone();
    if (!current.mounted) return false;
    try {
      await commandRef.current(command);
    } finally {
      current.busy = false;
      if (current.mounted) setBusy(false);
      void syncMicrophone();
    }
    return true;
  }, [clearPending, stopSpeaking, syncMicrophone, browserSupportsContinuousListening]);

  // The library only exposes permission denial; preserve its handlers while
  // surfacing the other native failures instead of leaving an enabled, idle mic.
  useEffect(() => {
    const recognition = SpeechRecognition.getRecognitionManager().recognition;
    if (!recognition?.addEventListener) return;
    const onError = (event) => {
      const current = state.current;
      if (!current.mounted || !current.enabled || event.error === "aborted") return;
      const messages = {
        network: "Falló la conexión del reconocimiento de voz. Revisa Internet y vuelve a activar el micrófono.",
        "no-speech": "No se escuchó un comando. Toca Activar micrófono y vuelve a intentarlo.",
        "audio-capture": "No se pudo acceder al micrófono. Revisa si otra aplicación lo está usando.",
        "not-allowed": "Permiso de micrófono denegado. Habilítalo en tu navegador y recarga la página.",
        "service-not-allowed": "El navegador bloqueó el servicio de voz. Abre Jarvis en un navegador compatible y permite el micrófono.",
        "language-not-supported": "El servicio de voz no admite español de México en este dispositivo.",
      };
      current.enabled = false;
      setMicEnabled(false);
      setMicError(messages[event.error] || "No se pudo reconocer tu voz. Vuelve a activar el micrófono.");
      clearPending();
      releaseAudio();
    };
    recognition.addEventListener("error", onError);
    return () => recognition.removeEventListener("error", onError);
  }, [clearPending, releaseAudio]);

  // Mobile browsers may end recognition after one phrase or a silence.
  // Finish that session explicitly instead of leaving an inactive mic enabled.
  useEffect(() => {
    const current = state.current;
    const wasListening = current.heardSession;
    current.heardSession = listening;
    if (browserSupportsContinuousListening === true || listening || !wasListening
      || !current.enabled || current.speaking || current.busy) return;
    current.enabled = false;
    setMicEnabled(false);
    clearPending();
    releaseAudio();
    if (!transcript.trim()) {
      setMicError("No se escuchó un comando. Toca Activar micrófono y vuelve a intentarlo.");
      void syncMicrophone();
    }
  }, [listening, transcript, browserSupportsContinuousListening, clearPending, releaseAudio, syncMicrophone]);

  useEffect(() => {
    if (isMicrophoneAvailable !== false) return;
    state.current.enabled = false;
    setMicEnabled(false);
    setMicError("El reconocimiento no puede acceder al micrófono. Revisa los permisos del navegador y recarga la página. Puedes escribir tu comando.");
    clearPending();
    releaseAudio();
    // The library disables its event handlers on permission denial.
    // Do not wait for an abort event that it will no longer deliver.
  }, [isMicrophoneAvailable, clearPending, releaseAudio]);

  useEffect(() => {
    const current = state.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.enabled = false;
      current.speechId += 1;
      clearPending();
      window.speechSynthesis?.cancel();
      releaseAudio();
      void syncMicrophone();
    };
  }, [clearPending, releaseAudio, syncMicrophone]);

  return {
    transcript, listening, micEnabled, speaking, muted, busy, micError, voiceError,
    analyser, browserSupportsSpeechRecognition, browserSupportsContinuousListening, hablar, execute, toggleMic,
    toggleMuted, stopSpeaking, voices, preferredVoice, selectVoice,
  };
}
