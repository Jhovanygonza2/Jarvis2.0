const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_REQUESTS = 20;
const requestsByIp = new Map();

const ALLOWED_ORIGINS = new Set(["https://jhovanygonza2.github.io"]);
exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://chipper-gingersnap-11d5c3.netlify.app",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: corsHeaders, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { ...corsHeaders, Allow: "POST, OPTIONS" }, body: "Método no permitido." };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { statusCode: 503, headers: corsHeaders, body: JSON.stringify({ error: "Falta configurar OPENAI_API_KEY en las variables del servidor." }) };
  }

  const ip = event.headers["x-nf-client-connection-ip"] || "unknown";
  const now = Date.now();
  const recentRequests = (requestsByIp.get(ip) || []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW);
  if (recentRequests.length >= RATE_LIMIT_REQUESTS) {
    return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: "Alcanzaste el límite temporal de mensajes. Espera un minuto e inténtalo de nuevo." }) };
  }
  recentRequests.push(now);
  requestsByIp.set(ip, recentRequests);

  try {
    const body = JSON.parse(event.body || "{}");
    const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
    if (!messages.length || messages.some((message) =>
      !["user", "assistant"].includes(message.role)
      || typeof message.content !== "string"
      || !message.content.trim()
      || message.content.length > MAX_MESSAGE_LENGTH)) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "El mensaje no es válido o es demasiado largo." }) };
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-6-astra",
        instructions: "Eres Jarvis, un asistente útil y conversacional. Responde en el idioma del usuario, con claridad y naturalidad. No afirmes haber ejecutado acciones en el dispositivo. Si el usuario pide una acción, explica qué comando explícito puede usar.",
        input: messages,
        max_output_tokens: 800,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error("OpenAI API request failed:", response.status, result.error?.type || "unknown_error");
      return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: "El servicio de IA no pudo responder. Revisa la clave y el modelo configurados." }) };
    }

    const reply = result.output
      ?.filter((item) => item.type === "message")
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join("\n")
      .trim();
    if (!reply) return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: "La IA devolvió una respuesta vacía. Inténtalo otra vez." }) };
    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }, body: JSON.stringify({ reply }) };
  } catch (error) {
    console.error("Chat function failed:", error.message);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: "No se pudo procesar el mensaje." }) };
  }
};
