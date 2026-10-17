export async function searchYouTube(query, apiKey, timeoutMs = 10000) {
  if (!apiKey) throw new Error("La búsqueda integrada de YouTube no está configurada. Puedes abrir la búsqueda en YouTube.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&type=video&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`,
      { signal: controller.signal }
    );
    if (!response.ok) {
      let data;
      try { data = await response.json(); } catch { /* Use HTTP status if the body is unavailable. */ }
      const reasons = data?.error?.errors?.map((error) => error.reason) || [];
      if (response.status === 429 || reasons.some((reason) => ["quotaExceeded", "dailyLimitExceeded"].includes(reason))) {
        throw new Error("Se alcanzó el límite de búsquedas de YouTube. Inténtalo más tarde.");
      }
      if ([400, 401, 403].includes(response.status)) {
        throw new Error("YouTube rechazó la búsqueda. Revisa la clave y los permisos de la API.");
      }
      throw new Error("YouTube no está disponible en este momento. Inténtalo de nuevo.");
    }
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error("YouTube devolvió una respuesta inesperada. Inténtalo de nuevo.");
    return data.items.map((item) => ({
      id: item.id.videoId,
      titulo: item.snippet.title,
      canal: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium.url,
    }));
  } catch (error) {
    if (controller.signal.aborted) throw new Error("YouTube tardó demasiado en responder. Inténtalo de nuevo.");
    if (error instanceof TypeError) throw new Error("No se pudo conectar con YouTube. Revisa tu conexión e inténtalo de nuevo.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
