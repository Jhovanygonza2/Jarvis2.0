export const WEATHER_URL = "https://ensemble-api.open-meteo.com/v1/ensemble?latitude=18.6089&longitude=-90.7454&hourly=temperature_2m,temperature_2m_spread&models=dwd_icon_eps_ensemble_mean_seamless&timezone=America%2FMexico_City&timeformat=unixtime";
const unavailable = "No pude consultar la temperatura. Revisa tu conexion e intentalo de nuevo.";

export async function getTemperature(now = Date.now()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(WEATHER_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(unavailable);
    const data = await response.json();
    const hourly = data.hourly;
    if (data.error || !Array.isArray(hourly?.time) || data.hourly_units?.temperature_2m !== "°C") {
      throw new Error(unavailable);
    }
    // Unix timestamps are absolute: never add the API's UTC offset to them.
    const index = hourly.time.findIndex((time) =>
      Number.isFinite(time) && time * 1000 <= now && now < (time + 3600) * 1000);
    const temperature = hourly.temperature_2m?.[index];
    if (index < 0 || !Number.isFinite(temperature)) throw new Error(unavailable);
    const time = new Date(hourly.time[index] * 1000).toLocaleTimeString("es-MX", {
      timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const value = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(temperature);
    return `Segun Open-Meteo, la temperatura prevista para las ${time}, hora de Ciudad de Mexico, es de ${value} grados Celsius en la ubicacion configurada (18.6089, -90.7454). Es un pronostico, no una medicion en tiempo real.`;
  } catch {
    throw new Error(unavailable);
  } finally {
    clearTimeout(timer);
  }
}

export const ESCARCEGA_WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=18.6089&longitude=-90.7454&hourly=temperature_2m,weather_code,precipitation_probability,relative_humidity_2m,wind_speed_10m&timezone=America%2FMexico_City&timeformat=unixtime&forecast_days=1";

const conditions = {
  0: "cielo despejado", 1: "mayormente despejado", 2: "parcialmente nublado", 3: "cielo cubierto",
  45: "niebla", 48: "niebla con escarcha",
  51: "llovizna ligera", 53: "llovizna moderada", 55: "llovizna intensa",
  56: "llovizna helada ligera", 57: "llovizna helada intensa",
  61: "lluvia ligera", 63: "lluvia moderada", 65: "lluvia intensa",
  66: "lluvia helada ligera", 67: "lluvia helada intensa",
  71: "nevada ligera", 73: "nevada moderada", 75: "nevada intensa", 77: "granos de nieve",
  80: "chubascos ligeros", 81: "chubascos moderados", 82: "chubascos intensos",
  85: "chubascos de nieve ligeros", 86: "chubascos de nieve intensos",
  95: "tormenta", 96: "tormenta con granizo ligero", 99: "tormenta con granizo intenso",
};

export async function getEscarcegaWeather(now = Date.now()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(ESCARCEGA_WEATHER_URL, { signal: controller.signal });
    if (!response.ok) throw new Error("HTTP");
    const data = await response.json();
    const h = data.hourly;
    if (data.error || !Array.isArray(h?.time) || data.hourly_units?.temperature_2m !== "°C") throw new Error("Datos");
    const i = h.time.findIndex(t => Number.isFinite(t) && t * 1000 <= now && now < (t + 3600) * 1000);
    if (i < 0 || !Number.isFinite(h.temperature_2m?.[i])) throw new Error("Sin temperatura");
    const format = n => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(n);
    const time = new Date(h.time[i] * 1000).toLocaleTimeString("es-MX", {
      timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = [`Para Escárcega, Campeche, Open-Meteo prevé ${format(h.temperature_2m[i])} grados Celsius para las ${time}, hora local.`];
    const code = h.weather_code?.[i];
    if (Number.isInteger(code) && conditions[code]) parts.push(`Condiciones: ${conditions[code]}.`);
    const probability = h.precipitation_probability?.[i];
    if (data.hourly_units.precipitation_probability === "%" && Number.isFinite(probability) && probability >= 0 && probability <= 100) {
      parts.push(`Probabilidad de precipitación para esa hora: ${format(probability)} por ciento.`);
    }
    const humidity = h.relative_humidity_2m?.[i];
    if (data.hourly_units.relative_humidity_2m === "%" && Number.isFinite(humidity) && humidity >= 0 && humidity <= 100) {
      parts.push(`Humedad: ${format(humidity)} por ciento.`);
    }
    const wind = h.wind_speed_10m?.[i];
    if (data.hourly_units.wind_speed_10m === "km/h" && Number.isFinite(wind) && wind >= 0) {
      parts.push(`Viento: ${format(wind)} kilómetros por hora.`);
    }
    parts.push("Es un pronóstico del modelo.");
    return parts.join(" ");
  } catch {
    throw new Error("No pude consultar el clima de Escárcega. Revisa tu conexión e inténtalo de nuevo.");
  } finally {
    clearTimeout(timer);
  }
}
