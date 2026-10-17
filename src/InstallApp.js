import { useEffect, useState } from "react";

export default function InstallApp() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(() => window.navigator.standalone === true
    || window.matchMedia?.("(display-mode: standalone)").matches === true);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const capture = event => { event.preventDefault(); setPrompt(event); };
    const complete = () => { setInstalled(true); setPrompt(null); };
    const mode = window.matchMedia?.("(display-mode: standalone)");
    const changed = event => setInstalled(event.matches || window.navigator.standalone === true);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    mode?.addEventListener?.("change", changed);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
      mode?.removeEventListener?.("change", changed);
    };
  }, []);
  if (installed) return null;
  const ios = /iPad|iPhone|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
  return <aside className="install-app" aria-label="Instalar Jarvis">
    <strong>Jarvis en tu pantalla de inicio</strong>
    <p>Ábrelo desde su icono como una app, sin escribir la dirección.</p>
    {prompt ? <button type="button" disabled={pending} onClick={async () => {
      setPending(true);
      try { await prompt.prompt(); await prompt.userChoice; }
      catch { /* Keep the manual instructions available. */ }
      finally { setPrompt(null); setPending(false); }
    }}>Instalar Jarvis</button> : <p>{ios
      ? "En Safari, toca Compartir → Añadir a pantalla de inicio. Activa Abrir como app si aparece y toca Añadir."
      : "Abre el menú del navegador y elige Instalar aplicación o Añadir a pantalla de inicio. Si no aparece, abre Jarvis con HTTPS en un navegador compatible."}</p>}
  </aside>;
}
