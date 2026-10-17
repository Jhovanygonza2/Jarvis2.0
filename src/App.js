import React, { useEffect, useRef, useState } from "react";
import useVoiceControls from "./useVoiceControls";
import { youtubeSearchQuery, isEscarcegaWeatherCommand, informationIntent, normalizeCommand, videoSelectionIndex } from "./commands";
import { searchYouTube } from "./youtube";
import { getTemperature, getEscarcegaWeather } from "./weather";
import Orb3D from "./Orb3D";
import InstallApp from "./InstallApp";
import { appTarget, whatsappTarget } from "./externalLinks";
import FrameworksView from "./FrameworksView";
import "./App.css";
import "./AppDesign.css";

const YT_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;
const CONVERSATIONS_KEY = "jarvis.conversations.v1";

function loadConversations() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONVERSATIONS_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}

function makeConversation() {
  const now = new Date().toISOString();
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title: "Nuevo chat", updatedAt: now, messages: [] };
}

function App() {
  const historialRef   = useRef(null);
  const messagesRef = useRef([]);
  const clockRef       = useRef(null);
  // Refs para evitar closures stale en el effect de voz
  const resultadosRef  = useRef([]);


  const [historial,   setHistorial]   = useState([]);
  const [conversations, setConversations] = useState(loadConversations);
  const [conversationId, setConversationId] = useState(() => loadConversations()[0]?.id || makeConversation().id);
  const [cargando,    setCargando]    = useState(false);
  const [estado,      setEstado]      = useState("EN ESPERA");
  const [resultados,  setResultados]  = useState([]);
  const [videoActivo, setVideoActivo] = useState(null);
  const [ytFeedback, setYtFeedback] = useState("");
  const [ytQuery, setYtQuery] = useState("");
  const [ytRetry, setYtRetry] = useState(false);
  const [panelYT,     setPanelYT]     = useState(false);
  const [horaActual,  setHoraActual]  = useState("");
  const [fechaActual, setFechaActual] = useState("");
  const [textoComando, setTextoComando] = useState("");
  const [externalLink, setExternalLink] = useState(null);
  const [view,        setView]        = useState("hud"); // 'hud' o 'frameworks'

  useEffect(() => {
    try { localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations)); } catch { /* Storage is optional. */ }
  }, [conversations]);

  useEffect(() => {
    const active = conversations.find((conversation) => conversation.id === conversationId);
    const messages = active?.messages || [];
    messagesRef.current = messages;
    setHistorial(messages);
  }, [conversationId, conversations]);

  function updateConversation(messages, id = conversationId) {
    const conversation = conversations.find((item) => item.id === id);
    const firstUserMessage = messages.find((item) => item.usuario)?.usuario;
    const title = firstUserMessage ? firstUserMessage.slice(0, 36) : "Nuevo chat";
    const updatedAt = new Date().toISOString();
    setConversations((previous) => {
      const exists = previous.some((item) => item.id === id);
      const next = exists ? previous.map((item) => item.id === id
        ? { ...item, title: item.title === "Nuevo chat" ? title : item.title, updatedAt, messages }
        : item) : [{ ...(conversation || makeConversation()), id, title, updatedAt, messages }, ...previous];
      return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  function appendHistory(item) {
    const next = [...messagesRef.current, item];
    messagesRef.current = next;
    setHistorial(next);
    updateConversation(next);
  }

  function startConversation() {
    const conversation = makeConversation();
    setConversations((previous) => [conversation, ...previous]);
    setConversationId(conversation.id);
    messagesRef.current = [];
    setHistorial([]);
    if (micEnabled) toggleMic();
    stopSpeaking();
  }

  function deleteConversation(id) {
    const remaining = conversations.filter((conversation) => conversation.id !== id);
    setConversations(remaining);
    if (id === conversationId) {
      if (remaining.length) setConversationId(remaining[0].id);
      else {
        const conversation = makeConversation();
        setConversations([conversation]);
        setConversationId(conversation.id);
        messagesRef.current = [];
        setHistorial([]);
      }
    }
  }

  const {
    transcript, listening, micEnabled, speaking, muted, busy, micError, voiceError,
    analyser, browserSupportsSpeechRecognition, browserSupportsContinuousListening, hablar, execute, toggleMic,
    toggleMuted, stopSpeaking, voices = [], preferredVoice = "", selectVoice,
  } = useVoiceControls(ejecutarComando);

  // Mantener resultadosRef sincronizado con el estado
  useEffect(() => { resultadosRef.current = resultados; }, [resultados]);

  /* ============================= */
  /* CLOCK                         */
  /* ============================= */
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setHoraActual(now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setFechaActual(now.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase());
    };
    tick();
    clockRef.current = setInterval(tick, 1000);
    return () => clearInterval(clockRef.current);
  }, []);

  /* ============================= */
  /* ABRIR URL Y OFRECER ENLACE     */
  /* ============================= */
  function abrirURL(url, options = {}) {
    const link = appTarget(url, options);
    setExternalLink(link);
    // Same-tab destinations can be attempted directly from voice commands.
    // Keep the interaction requirement for services opening a new tab.
    if (link.target !== "_self" && navigator.userActivation?.isActive !== true) return false;
    const a = document.createElement("a");
    a.href = link.url;
    a.target = link.target;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  /* ============================= */
  /* RESPONDER                     */
  /* ============================= */
  function responder(texto) {
    appendHistory({ usuario: "", jarvis: texto });
    hablar(texto);
  }

  /* ============================= */
  /* YOUTUBE: BUSCAR               */
  /* ============================= */
  async function buscarYouTube(query) {
    setCargando(true);
    setEstado("BUSCANDO...");
    setPanelYT(true);
    setVideoActivo(null);
    setResultados([]);
    resultadosRef.current = [];
    setYtQuery(query);
    setYtFeedback("");
    setYtRetry(false);
    try {
      const videos = await searchYouTube(query, YT_API_KEY);
      setResultados(videos);
      resultadosRef.current = videos;
      if (videos.length) {
        responder(`Encontré ${videos.length} videos de "${query}". Di el número para reproducir.`);
      } else {
        const message = `No encontré videos de "${query}". Prueba con otras palabras.`;
        setYtFeedback(message);
        responder(message);
      }
    } catch (error) {
      setYtFeedback(error.message);
      setYtRetry(Boolean(YT_API_KEY));
      responder(error.message);
    } finally {
      setCargando(false);
      setEstado("EN ESPERA");
    }
  }

  /* ============================= */
  /* YOUTUBE: REPRODUCIR           */
  /* ============================= */
  function reproducirVideo(video) {
    setVideoActivo(video);
    setResultados([]);
    hablar("Reproduciendo " + video.titulo);
    appendHistory({ usuario: "▶ " + video.titulo, jarvis: "Reproduciendo ahora." });
  }

  function cerrarVideo() {
    setVideoActivo(null);
    setPanelYT(false);
    setResultados([]);
    hablar("Video cerrado.");
  }

  /* ============================= */
  /* COMANDOS DE VOZ               */
  /* ============================= */
  async function procesarComando(comando) {
    const mensajeOriginal = comando.trim();
    const youtubeQuery = youtubeSearchQuery(comando);
    if (youtubeQuery !== null && /^(?:(?:abre|abrir)\s+youtube(?:\s|$)|youtube\.?$|(?:busca|buscar)\s+en\s+youtube(?:\s|$)|(?:busca|buscar)\s+.+\s+en\s+youtube\.?$)/i.test(comando.trim())) {
      const url = youtubeQuery
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeQuery)}`
        : "https://www.youtube.com";
      abrirURL(url, { label: "YouTube", target: "_self" });
      responder(youtubeQuery ? `Abriendo YouTube para buscar ${youtubeQuery}.` : "Abriendo YouTube.");
      return;
    }

    comando = normalizeCommand(comando).replace(/\b(?:whats?\s*app|wats?\s*app|wasap|guasap)\b/g, "whatsapp");
    setCargando(true);
    setEstado("PROCESANDO...");

    // Resolve selections before broad YouTube search commands.
    const selectedIndex = videoSelectionIndex(comando);
    if (selectedIndex !== -1) {
      const video = resultadosRef.current[selectedIndex];
      if (video) reproducirVideo(video);
      else responder("No hay un video en esa posición. Primero busca videos en YouTube.");
      return;
    }

    // Opening WhatsApp takes priority over broad commands such as "ponme".
    if (/^(?:abre|abrir)\s+.*whatsapp\b/.test(comando) && !/\b(?:busca|buscar|video)\b/.test(comando)) {
      const destination = whatsappTarget();
      const attempted = abrirURL(destination.url, destination);
      responder(attempted
        ? `Intentando abrir ${destination.label}. Si no se abre, toca el enlace.`
        : `Toca Abrir ${destination.label} para continuar. El navegador necesita ese toque para abrirlo.`);
      return;
    }

    // Resolve Spotify before generic music commands such as "ponme".
    if (/^(?:abre|abrir|pon|ponme|reproduce|busca|buscar)\s+.*\bspotify\b/.test(comando)) {
      const query = comando.replace(/^(?:abre|abrir|pon|ponme|reproduce|busca|buscar)\s+/, "")
        .replace(/\b(?:en\s+)?spotify\b/, "").trim();
      abrirURL(query ? `https://open.spotify.com/search/${encodeURIComponent(query)}` : "https://open.spotify.com/",
        { label: "Spotify" });
      responder(query ? `Buscando ${query} en Spotify.` : "Abriendo Spotify.");
      return;
    }

    // Keep the existing embedded search available through an explicit command.
    if (comando.startsWith("buscar en jarvis ")) {
      await buscarYouTube(comando.slice("buscar en jarvis ".length).trim());
      return;
    }

    // Video requests open YouTube directly, including voice without activation.
    if (
      /^(?:busca|buscar)\s+.*\ben youtube\b/.test(comando) ||
      /^(?:video de|pon musica de|reproduce|ponme)\b/.test(comando)
    ) {
      const q = comando
        .replace(/video de|busca en youtube|buscar en youtube|pon musica de|reproduce|ponme/g, "")
        .trim();
      const query = q || "música";
      abrirURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        { label: "YouTube", target: "_self" });
      responder(`Abriendo YouTube para buscar ${query}.`);
      return;
    }

    // Cerrar video
    if (/^(?:cerrar|detener|parar|cierra|para) (?:el )?video$/.test(comando)) {
      cerrarVideo();
      setCargando(false);
      setEstado("EN ESPERA");
      return;
    }

    let respuesta = "";
    if (informationIntent(comando) === "time") {
      respuesta = "Son las " + new Date().toLocaleTimeString("es-MX");
    } else if (informationIntent(comando) === "date") {
      respuesta = "Hoy es " + new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    } else if (informationIntent(comando) === "temperature") {
      try { respuesta = await getTemperature(); }
      catch (error) { respuesta = error.message; }
    } else if (isEscarcegaWeatherCommand(comando)) {
      try { respuesta = await getEscarcegaWeather(); }
      catch (error) { respuesta = error.message; }
    } else if (/^(?:(?:dime|dame|consulta|consultar|busca|buscar)\s+)?(?:el\s+)?(?:clima|tiempo)\b|^que tiempo hace\b/.test(comando)) {
      const ciudad = comando.replace(/^.*?\b(?:clima|tiempo en)\b/, "")
        .replace(/^\s*(?:hace\s+)?(?:(?:de|en|para)\s+)?/, "").replace(/\s+por favor$/, "").trim();
      abrirURL(`https://www.google.com/search?q=${encodeURIComponent(ciudad ? `clima ${ciudad}` : "clima actual")}`,
        { label: "pronostico del clima", target: "_self" });
      respuesta = ciudad ? `Buscando el clima de ${ciudad}.` : "Buscando el clima actual.";
    } else if (/^(?:abre|abrir) youtube$/.test(comando)) {
      abrirURL("https://www.youtube.com", { label: "YouTube", target: "_self" });
      respuesta = "Abriendo YouTube.";
    } else if (/^(?:buscar|busca)\s+/.test(comando)) {
      const q = comando.replace("buscar", "").replace("busca", "").trim();
      abrirURL(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
      respuesta = `Buscando ${q} en Google.`;
    } else if (/^(?:abre|abrir)\s+(?:gmail|correo)$/.test(comando)) {
      abrirURL("https://mail.google.com");
      respuesta = "Abriendo Gmail.";
    } else if (/^(?:abre|abrir)\s+(?:google )?drive$/.test(comando)) {
      abrirURL("https://drive.google.com");
      respuesta = "Abriendo Google Drive.";

    } else if (/^(?:abre|abrir)\s+(?:google )?(?:mapas|maps)$/.test(comando)) {
      abrirURL("https://maps.google.com");
      respuesta = "Abriendo Google Maps.";
    } else if (/^(?:abre|abrir) calculadora$/.test(comando)) {
      abrirURL("https://www.google.com/search?q=calculadora");
      respuesta = "Calculadora activada.";
    } else if (/^(?:abre|abrir) (?:el )?traductor$/.test(comando)) {
      abrirURL("https://translate.google.com");
      respuesta = "Traductor activado.";
    } else if (/^(?:abre|abrir) netflix$/.test(comando)) {
      abrirURL("https://www.netflix.com");
      respuesta = "Abriendo Netflix.";
    } else if (/^(?:abre|abrir) instagram$/.test(comando)) {
      abrirURL("https://www.instagram.com");
      respuesta = "Abriendo Instagram.";
    } else if (/^(?:abre|abrir) (?:twitter|twiter|x)$/.test(comando)) {
      abrirURL("https://x.com");
      respuesta = "Abriendo X.";
    } else if (/^(?:abre|abrir) github$/.test(comando)) {
      abrirURL("https://github.com");
      respuesta = "Abriendo GitHub.";
    } else {
      const context = [...historial.flatMap((item) => [
        ...(item.usuario ? [{ role: "user", content: item.usuario }] : []),
        ...(item.jarvis ? [{ role: "assistant", content: item.jarvis }] : []),
      ]), { role: "user", content: mensajeOriginal }].slice(-20);
      try {
        const response = await fetch(process.env.REACT_APP_CHAT_API_URL || "/.netlify/functions/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: context }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "El chat no está disponible. Inicia la app mediante Netlify Dev e inténtalo de nuevo.");
        if (!data?.reply) throw new Error("El chat devolvió una respuesta vacía. Inténtalo de nuevo.");
        respuesta = data.reply;
      } catch (error) {
        respuesta = error.message || "No pude conectar con el chat. Revisa la configuración del servidor e inténtalo de nuevo.";
      }
    }

    appendHistory({ usuario: mensajeOriginal, jarvis: respuesta });
    hablar(respuesta);
    setCargando(false);
    setEstado("EN ESPERA");
  }

  async function ejecutarComando(comando) {
    setExternalLink(null);
    try {
      await procesarComando(comando);
    } catch {
      responder("No pude completar el comando. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
      setEstado("EN ESPERA");
    }
  }

  function enviarTexto(event) {
    event.preventDefault();
    if (!textoComando.trim() || busy) return;
    void execute(textoComando);
    setTextoComando("");
  }

  /* ============================= */
  /* EFECTO — SCROLL HISTORIAL     */
  /* ============================= */
  useEffect(() => {
    if (historialRef.current)
      historialRef.current.scrollTop = historialRef.current.scrollHeight;
  }, [historial]);

  /* ============================= */
  /* STATUS CONFIG                 */
  /* ============================= */
  const statusMode = cargando ? "proc" : listening ? "live" : "idle";
  const statusLabels = { proc: "PROCESANDO", live: "ESCUCHANDO", idle: speaking ? "HABLANDO" : micEnabled ? estado : "MICRÓFONO APAGADO" };

  /* ============================= */
  /* RENDER                        */
  /* ============================= */
  return (
    <div className="root booted">

      {/* ── Fondo decorativo ── */}
      <div className="bg-hex" aria-hidden="true" />
      <div className="bg-vignette" aria-hidden="true" />

      {/* ══════════════════════════════════
          SIDEBAR IZQUIERDO
      ══════════════════════════════════ */}
      <aside className="sidebar-left">
        <div className="brand-lockup"><div className="sbl-logo">
          <span className="sbl-logo-letter">J</span>
          <span className="sbl-logo-dot" />
        </div><div className="brand-copy"><strong>JARVIS</strong><small>Tu asistente personal</small></div></div>

        <div className="sbl-divider" />

        <nav className="sbl-nav">
          <button
            className={`nav-btn ${view === 'hud' ? 'active' : ''}`}
            onClick={() => setView('hud')}
          >
            <span className="btn-icon">💠</span>
            <span className="btn-label">Asistente</span>
          </button>
          <button
            className={`nav-btn ${view === 'frameworks' ? 'active' : ''}`}
            onClick={() => { if (micEnabled) toggleMic(); stopSpeaking(); setView("frameworks"); }}
          >
            <span className="btn-icon">📚</span>
            <span className="btn-label">Explorar</span>
          </button>
        </nav>

        <section className="conversation-sidebar" aria-label="Conversaciones guardadas">
          <button className="new-chat-button" type="button" disabled={busy || cargando} onClick={startConversation}>＋ Nuevo chat</button>
          <p className="conversation-sidebar-title">Recientes</p>
          <div className="conversation-list">
            {conversations.map((conversation) => (
              <div className={`conversation-row ${conversation.id === conversationId ? "selected" : ""}`} key={conversation.id}>
                <button type="button" className="conversation-select" disabled={busy || cargando} onClick={() => setConversationId(conversation.id)}>
                  {conversation.title}
                </button>
                <button type="button" className="conversation-delete" disabled={busy || cargando} aria-label={`Borrar ${conversation.title}`} onClick={() => deleteConversation(conversation.id)}>×</button>
              </div>
            ))}
          </div>
        </section>

        <div className="sbl-divider" />

        <div className="sbl-clock">
          <span className="sbl-time">{horaActual}</span>
          <span className="sbl-date">{fechaActual}</span>
        </div>

        <div className="sbl-divider" />

        <div className="sbl-indicators">
          <div className="sbl-ind">
            <span className={`sbl-led ${statusMode === "live" ? "green" : "dim"}`} />
            <span>MIC</span>
          </div>
          <div className="sbl-ind">
            <span className={`sbl-led ${statusMode === "proc" ? "amber" : "dim"}`} />
            <span>PROC</span>
          </div>
          <div className="sbl-ind">
            <span className={`sbl-led ${panelYT ? "cyan" : "dim"}`} />
            <span>YT</span>
          </div>
          {micError && (
            <div className="sbl-ind">
              <span className="sbl-led" style={{ background: "#f87171" }} />
              <span>MIC</span>
            </div>
          )}
        </div>
        <div className="sbl-divider" />
        <div className="sbl-version">v3.1</div>
      </aside>

      {/* ══════════════════════════════════
          CONTENIDO DINÁMICO
      ══════════════════════════════════ */}
      {view === "hud" ? (
        <>
          {/* ══════════════════════════════════
              COLUMNA CENTRAL
          ══════════════════════════════════ */}
          <main className={`col-center ${historial.length ? "has-messages" : "empty-chat"}`}>

            {/* — Titulo — */}
            <header className="hud-header">
              <div className="hud-corner tl" />
              <div className="hud-corner tr" />
              <p className="workspace-eyebrow">TU ESPACIO PERSONAL</p>
              <h1 className="hud-title">Hola, soy Jarvis</h1>
              <p className="hud-sub">Conversemos. Para abrir apps o buscar videos, pide la acción directamente.</p>
              <div className="hud-corner bl" />
              <div className="hud-corner br" />
            </header>

            {/* — Status pill — */}
            <div className={`status-pill st-${statusMode}`}>
              <span className="st-ring" />
              <span className="st-label">{statusLabels[statusMode]}</span>
            </div>

            {/* — Esfera 3D — */}
            <div className="orb-wrap">
              <Orb3D
                analyser={analyser}
                listening={statusMode === "live"}
                processing={statusMode === "proc"}
              />
              {transcript && (
                <div className="orb-transcript">
                  <span className="orb-cursor">▌</span>{transcript}
                </div>
              )}
            </div>

            <div className="quick-actions" aria-label="Accesos rápidos">
              <button className="quick-action" type="button" disabled={busy || cargando} onClick={() => void execute("dime el clima de Escarcega")}>
                <span aria-hidden="true">☀</span><strong>Clima local</strong><small>Escárcega, Campeche</small>
              </button>
              <button className="quick-action" type="button" disabled={busy || cargando} onClick={() => void execute("dime la hora")}>
                <span aria-hidden="true">◷</span><strong>Consultar hora</strong><small>Tu hora actual</small>
              </button>
              <button className="quick-action" type="button" disabled={busy || cargando} onClick={() => {
                setTextoComando("video de ");
                if (micEnabled) toggleMic();
                document.getElementById("command-input")?.focus();
              }}>
                <span aria-hidden="true">▷</span><strong>Buscar videos</strong><small>Elige qué ver</small>
              </button>
            </div>

            <section className="command-controls" aria-label="Controles de Jarvis">
              <div className="voice-actions">
                <button type="button" onClick={toggleMic}
                  disabled={!browserSupportsSpeechRecognition} aria-pressed={micEnabled}>
                  {micEnabled ? "Pausar micrófono" : "Activar micrófono"}
                </button>
                <button type="button" onClick={toggleMuted} aria-pressed={muted}>
                  {muted ? "Activar voz" : "Silenciar voz"}
                </button>
                <button type="button" onClick={stopSpeaking} disabled={!speaking}>
                  Detener respuesta
                </button>
              </div>
              {!browserSupportsSpeechRecognition && (
                <p className="control-message" role="status">
                  Tu navegador no admite reconocimiento de voz. Puedes escribir tu comando.
                </p>
              )}
              {browserSupportsSpeechRecognition && browserSupportsContinuousListening === false && (
                <p className="control-message" role="status">
                  Di un comando por activación. Para el siguiente, vuelve a pulsar Activar micrófono.
                </p>
              )}
              {browserSupportsSpeechRecognition && (
                <p className="control-message" role="status">
                  Revisa la transcripción y pulsa Enviar transcripción cuando estés listo, o edítala primero.
                </p>
              )}
              {externalLink && (
                <div className="control-message" role="status">
                  Si el servicio no se abrió, toca el enlace:
                  <a className="external-command-link" href={externalLink.url}
                    target={externalLink.target} rel="noopener noreferrer">Abrir {externalLink.label}</a>
                  {externalLink.fallbackUrl && (
                    <a className="external-command-link" href={externalLink.fallbackUrl}
                      target="_blank" rel="noopener noreferrer">{externalLink.fallbackLabel || "Si no tienes WhatsApp, descárgalo aquí"}</a>
                  )}
                </div>
              )}
              {micError && <p className="control-message control-error" role="alert">{micError}</p>}
              {voiceError && <p className="control-message" role="status">{voiceError}</p>}
              <details className="voice-settings">
                <summary>Ajustar voz</summary>
                <label htmlFor="response-voice">Voz en español</label>
                <select id="response-voice" value={voices.some(v => v.voiceURI === preferredVoice) ? preferredVoice : ""}
                  onChange={event => selectVoice(event.target.value)}>
                  <option value="">Automática (preferir voz mejorada)</option>
                  {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                </select>
                <button type="button" disabled={muted || busy} onClick={() => hablar("Hola, soy Jarvis. ¿En qué puedo ayudarte hoy?")}>Probar voz</button>
                <p>La calidad depende de las voces de tu dispositivo. Puedes descargar voces de mayor calidad en sus ajustes de voz o accesibilidad.</p>
              </details>
              <InstallApp />
              <form className="command-form" onSubmit={enviarTexto}>
                <label htmlFor="command-input">Escribe un mensaje</label>
                <div className="command-input-row">
                  <input id="command-input" value={textoComando}
                    onChange={(event) => setTextoComando(event.target.value)}
                    placeholder="Escribe tu mensaje..." autoComplete="off" />
                  <button type="submit" disabled={busy || !textoComando.trim()}>Enviar</button>
                </div>
              </form>
              {transcript && (
                <button type="button" className="edit-transcript" disabled={busy} onClick={() => void execute(transcript)}>
                  Enviar transcripción
                </button>
              )}
              {transcript && (
                <button type="button" className="edit-transcript" onClick={() => {
                  setTextoComando(transcript);
                  if (micEnabled) toggleMic();
                  document.getElementById("command-input")?.focus();
                }}>
                  Editar lo que escuchó Jarvis
                </button>
              )}
            </section>

            {/* — Historial — */}
            <div className="log-panel">
              <div className="log-header">
                <span className="log-title">Tu conversación</span>
                <span className="log-count">{historial.length} ENTRADAS</span>
              </div>
              <div className="log-body" ref={historialRef} role="log" aria-label="Registro de comandos">
                {historial.length === 0 && (
                  <p className="log-empty">
                    Todo empieza con una idea.<br />Prueba <em>“dime el clima de Escárcega”</em> o escribe tu comando.
                  </p>
                )}
                {historial.map((item, i) => (
                  <div key={i} className="log-entry">
                    {item.usuario && (
                      <div className="log-user">
                        <span className="log-tag user-tag">TÚ</span>
                        <span className="log-text">{item.usuario}</span>
                      </div>
                    )}
                    <div className="log-ai">
                      <span className="log-tag ai-tag">JARVIS</span>
                      <span className="log-text ai-text">{item.jarvis}</span>
                    </div>
                  </div>
                ))}
                {cargando && (
                  <div className="log-ai">
                    <span className="log-tag ai-tag">JARVIS</span>
                    <div className="typing-dots">
                      <span /><span /><span />
                    </div>
                  </div>
                )}
              </div>
            </div>

          </main>

          {/* ══════════════════════════════════
              SIDEBAR DERECHO / PANEL YT
          ══════════════════════════════════ */}
          <aside className={`sidebar-right ${panelYT ? "open" : ""}`}>
            {panelYT ? (
              <div className="yt-dock">
                <div className="yt-dock-header">
                  <span className="yt-dock-label">YOUTUBE</span>
                  <button className="yt-x" aria-label="Cerrar videos" disabled={cargando || busy} onClick={cerrarVideo}>✕</button>
                </div>

                {cargando && <p className="control-message" role="status">Buscando videos…</p>}
                {ytFeedback && (
                  <div className="yt-feedback">
                    <p role="status">{ytFeedback}</p>
                    {ytRetry && (
                      <button type="button" disabled={busy || cargando}
                        onClick={() => void execute(`buscar en jarvis ${ytQuery}`)}>
                        Reintentar búsqueda
                      </button>
                    )}
                    <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`}
                      target="_blank" rel="noopener noreferrer">Abrir búsqueda en YouTube</a>
                  </div>
                )}
                {videoActivo && (
                  <div className="yt-embed-wrap">
                    <div className="yt-embed-title">{videoActivo.titulo}</div>
                    <iframe
                      width="100%"
                      height="200"
                      src={`https://www.youtube.com/embed/${videoActivo.id}?autoplay=1`}
                      title={videoActivo.titulo}
                      frameBorder="0"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  </div>
                )}

                {resultados.length > 0 && (
                  <div className="yt-list">
                    {resultados.map((v, i) => (
                      <button type="button" key={v.id} className="yt-row" aria-label={`Reproducir video ${i + 1}: ${v.titulo}`} onClick={() => reproducirVideo(v)}>
                        <span className="yt-idx">0{i + 1}</span>
                        <img src={v.thumbnail} alt={v.titulo} className="yt-thumb" />
                        <span className="yt-meta">
                          <span className="yt-vtitle">{v.titulo}</span>
                          <span className="yt-channel">{v.canal}</span>
                        </span>
                      </button>
                    ))}
                    <p className="yt-voice-hint">Di <b>"pon el primero"</b>, <b>"el segundo"</b>…</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="sbr-idle">
                <section className="location-card" aria-label="Clima local">
                  <span className="location-eyebrow">TU CLIMA LOCAL</span>
                  <h2>Escárcega</h2>
                  <p>Campeche, México</p>
                  <p>Temperatura, lluvia y viento para esta hora.</p>
                  <button type="button" disabled={busy || cargando} onClick={() => void execute("dime el clima de Escarcega")}>Consultar pronóstico ↗</button>
                </section>
                <p className="weather-source">Pronósticos de <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a></p>
                <div className="sbr-commands">

                  <p className="sbr-cmd-title">PUEDES PEDIRME</p>
                  {[
                    ["YouTube + lo que buscas", "Abrir tu búsqueda"],
                    ["hora / fecha",   "Consultar tiempo"],
                    ["buscar...",      "Google Search"],
                    ["dime la temperatura", "Pronostico local"],
                    ["clima de Escárcega", "Temperatura y lluvia"],
                    ["clima de...",    "Ver otras ciudades"],
                    ["spotify...",     "Abrir Spotify"],
                    ["gmail / drive",  "Google Apps"],
                    ["whatsapp",       "WhatsApp"],
                    ["mapas",          "Google Maps"],
                    ["netflix",        "Netflix"],
                    ["instagram",      "Instagram"],
                    ["github",         "GitHub"],
                    ["traductor",      "Translate"],
                  ].map(([cmd, desc]) => (
                    <div key={cmd} className="sbr-cmd-row">
                      <span className="sbr-cmd-key">{cmd}</span>
                      <span className="sbr-cmd-desc">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </>
      ) : (
        <FrameworksView onBack={() => setView("hud")} />
      )}

    </div>
  );
}

export default App;
