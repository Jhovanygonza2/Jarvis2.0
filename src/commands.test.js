import { youtubeSearchQuery } from "./commands";
import { isEscarcegaWeatherCommand, informationIntent, normalizeCommand, videoSelectionIndex } from "./commands";

test.each([
  ["1", 0], ["2", 1], ["3", 2], ["4", 3], ["5", 4],
  ["uno", 0], ["dos", 1], ["tres", 2], ["cuatro", 3], ["cinco", 4],
  ["primero", 0], ["segundo", 1], ["tercero", 2], ["cuarto", 3], ["quinto", 4],
  ["reproduce el primero", 0], ["pon el segundo", 1], ["ponme el quinto", 4],
  ["Reproduce el vídeo número 3, por favor.", 2], ["el primer video", 0],
])("selects %s as result %i", (text, index) => {
  expect(videoSelectionIndex(text)).toBe(index);
});

test.each(["hola a todos", "video de dos gatos", "reproduce uno de Metallica", "buscar formula 1", "12", "6", "", "cerrar video"])(
  "does not treat %s as a video selection", (text) => {
    expect(videoSelectionIndex(text)).toBe(-1);
  }
);

test("normalizes accents, punctuation and whitespace", () => {
  expect(normalizeCommand("  ¿QUÉ   día es hoy? ")).toBe("que dia es hoy");
});

test.each(["abre WhatsApp ahora", "buscar horarios de tren", "buscar fecha de independencia", "mejora esto"])(
  "does not intercept %s", (text) => expect(informationIntent(text)).toBeNull()
);
test.each([["¿Qué hora es?", "time"], ["Jarvis dime la hora por favor", "time"], ["fecha", "date"], ["¿Qué día es hoy?", "date"]])(
  "recognizes %s", (text, intent) => expect(informationIntent(text)).toBe(intent)
);

test.each(["dime la temperatura", "Jarvis, ¿qué temperatura hace? por favor", "temperatura actual"])(
  "recognizes temperature command %s", (text) => expect(informationIntent(text)).toBe("temperature")
);
test.each(["temperatura de Madrid", "video de temperatura", "dime la temperatura mañana"])(
  "does not use the configured location for %s", (text) => expect(informationIntent(text)).toBeNull()
);

test.each(["dime el clima de Escárcega", "clima en escarcega", "Jarvis, ¿cómo está el clima en Escárcega, Campeche? por favor", "tiempo en Escárcega hoy"])(
  "recognizes Escarcega weather: %s", text => expect(isEscarcegaWeatherCommand(text)).toBe(true)
);
test.each(["clima de Monterrey", "clima", "clima de Escárcega mañana", "video de clima en Escárcega", "clima de Escárcega Oaxaca"])(
  "does not substitute Escarcega for %s", text => expect(isEscarcegaWeatherCommand(text)).toBe(false)
);

test.each([
  ["YouTube música relajante", "música relajante"],
  ["youtube recetas de pollo", "recetas de pollo"],
  ["Jarvis, YouTube Luis Miguel por favor", "Luis Miguel"],
  ["abre youtube y busca tutorial de React", "tutorial de React"],
  ["busca en youtube gatos", "gatos"],
  ["busca galaxias en youtube", "galaxias"],
  ["you tube rock & roll", "rock & roll"],
  ["youtube", ""],
  ["abre youtube", ""],
  ["buscar clima", null],
  ["video de youtube para principiantes", null],
])("extracts the YouTube search from %s", (text, query) => {
  expect(youtubeSearchQuery(text)).toBe(query);
});
