export function normalizeCommand(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:]/g, "").replace(/\s+/g, " ").trim();
}

const positions = {
  "1": 0, uno: 0, un: 0, primero: 0, primer: 0,
  "2": 1, dos: 1, segundo: 1,
  "3": 2, tres: 2, tercero: 2, tercer: 2,
  "4": 3, cuatro: 3, cuarto: 3,
  "5": 4, cinco: 4, quinto: 4,
};

// Match a complete selection, never numbers embedded in a search or greeting.
export function videoSelectionIndex(text) {
  const command = normalizeCommand(text);
  const match = command.match(/^(?:(?:pon|ponme|reproduce|reproducir|selecciona|elige)\s+)?(?:(?:el|la)\s+)?(?:video\s+)?(?:numero\s+)?(1|2|3|4|5|uno|un|dos|tres|cuatro|cinco|primero|primer|segundo|tercero|tercer|cuarto|quinto)(?:\s+video)?(?:\s+por favor)?$/);
  return match ? positions[match[1]] : -1;
}

export function informationIntent(text) {
  const command = normalizeCommand(text).replace(/^jarvis\s+/, "").replace(/^por favor\s+|\s+por favor$/g, "");
  if (/^(?:(?:dime|dame|consulta) (?:la )?hora(?: actual)?|que hora es(?: ahora)?|hora(?: actual)?)$/.test(command)) return "time";
  if (/^(?:(?:dime|dame|consulta) (?:la )?fecha(?: de hoy| actual)?|(?:que )?dia es hoy|que fecha es(?: hoy)?|fecha(?: de hoy| actual)?)$/.test(command)) return "date";
  if (/^(?:(?:dime|dame|consulta) (?:la )?temperatura(?: actual)?|que temperatura hace(?: ahora)?|temperatura(?: actual)?)$/.test(command)) return "temperature";
  return null;
}

export function isEscarcegaWeatherCommand(text) {
  const command = normalizeCommand(text).replace(/^jarvis\s+/, "").replace(/^por favor\s+|\s+por favor$/g, "");
  return /^(?:(?:(?:dime|dame|consulta|consultar|busca|buscar)\s+)?(?:el\s+)?(?:clima|tiempo)(?:\s+actual)?|como (?:esta|estara) el clima|que tiempo hace)\s+(?:de|en|para)\s+escarcega(?:\s+campeche)?(?:\s+(?:hoy|ahora))?$/.test(command);
}

export function youtubeSearchQuery(text) {
  const command = text.trim().replace(/^jarvis[,\s]+/i, "").replace(/\s+por favor[.!?]*$/i, "").trim();
  const prefix = command.match(/^(?:(?:abre|abrir|busca en|buscar en)\s+)?you\s*tube\b[\s,:-]*(.*)$/i);
  if (prefix) return prefix[1].replace(/^(?:y\s+)?(?:busca|buscar)\s+/i, "").trim();
  const suffix = command.match(/^(?:busca|buscar)\s+(.+?)\s+en\s+you\s*tube[.!?]*$/i);
  return suffix ? suffix[1].trim() : null;
}
