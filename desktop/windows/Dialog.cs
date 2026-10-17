using System;
using System.Globalization;
using System.Text;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace JarvisDesktop {
    public sealed class Reply {
        public string Text;
        public string Url;
        public string AppPath;
        public Reply(string text, string url = null, string appPath = null) { Text = text; Url = url; AppPath = appPath; }
    }
    public sealed class Dialog {
        public static readonly string[] Commands = {
            "hola", "buenos días", "buenas tardes", "buenas noches", "cómo estás",
            "quién eres", "qué puedes hacer", "dime la hora", "qué hora es",
            "dime la fecha", "qué día es hoy", "gracias", "cuéntame un chiste",
            "abre youtube", "abre spotify", "abre whatsapp", "abre gmail", "abre mapas",
            "adiós", "hasta luego", "silencio"
        };
        DateTime awakeUntil = DateTime.MinValue;
        readonly Random random = new Random();
        readonly Dictionary<string, AppShortcut> installedApps;
        bool usedFiller;

        sealed class AppShortcut {
            public string Name;
            public string Target;
            public AppShortcut(string name, string target) { Name = name; Target = target; }
        }

        public string[] SpeechPhrases { get; private set; }

        public Dialog() {
            installedApps = FindInstalledApps();
            var phrases = new List<string>(Commands);
            foreach (var app in installedApps.Values) {
                phrases.Add("abre " + app.Name);
                phrases.Add("abrir " + app.Name);
                phrases.Add("inicia " + app.Name);
                phrases.Add("iniciar " + app.Name);
            }
            SpeechPhrases = phrases.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        }

        static Dictionary<string, AppShortcut> FindInstalledApps() {
            var apps = new Dictionary<string, AppShortcut>(StringComparer.Ordinal);
            string[] roots = {
                Environment.GetFolderPath(Environment.SpecialFolder.StartMenu),
                Environment.GetFolderPath(Environment.SpecialFolder.CommonStartMenu)
            };
            foreach (string root in roots) {
                string programs = Path.Combine(root, "Programs");
                if (!Directory.Exists(programs)) continue;
                try {
                    foreach (string shortcut in Directory.GetFiles(programs, "*.lnk", SearchOption.AllDirectories)) {
                        string name = Path.GetFileNameWithoutExtension(shortcut);
                        string key = Normalize(name);
                        if (key.Length < 2 || key.Contains("uninstall") || key.Contains("readme")) continue;
                        if (!apps.ContainsKey(key) && apps.Count < 250) apps.Add(key, new AppShortcut(name, shortcut));
                    }
                } catch (IOException) { } catch (UnauthorizedAccessException) { }
            }
            AddBuiltIn(apps, "Calculadora", "calc.exe");
            AddBuiltIn(apps, "Bloc de notas", "notepad.exe");
            AddBuiltIn(apps, "Explorador de archivos", "explorer.exe");
            AddBuiltIn(apps, "Paint", "mspaint.exe");
            return apps;
        }

        static void AddBuiltIn(Dictionary<string, AppShortcut> apps, string name, string target) {
            string key = Normalize(name);
            if (!apps.ContainsKey(key)) apps.Add(key, new AppShortcut(name, target));
        }
        Reply Conversational(string plain, string casual) {
            bool useFiller = !usedFiller && random.Next(3) == 0;
            usedFiller = useFiller;
            return new Reply(useFiller ? casual : plain);
        }
        public void Reset() { awakeUntil = DateTime.MinValue; }
        public void Extend(DateTime now) { if (awakeUntil != DateTime.MinValue) awakeUntil = now.AddSeconds(15); }
        static string Normalize(string text) {
            var b = new StringBuilder();
            foreach (char c in text.ToLowerInvariant().Normalize(NormalizationForm.FormD))
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) b.Append(c);
            return b.ToString().Trim(' ', '.', ',', '?', '¿', '!', '¡');
        }
        public Reply Hear(string text, float confidence, DateTime now) {
            string command = Normalize(text);
            if (command == "yarvis" || command.StartsWith("yarvis ", StringComparison.Ordinal)) command = "jarvis" + command.Substring(6);
            bool wake = command == "jarvis" || command.StartsWith("jarvis ", StringComparison.Ordinal);
            // Desktop SAPI Spanish returns moderate confidence even for clear speech.
            if (confidence < 0.50f) return null;
            if (!wake && now > awakeUntil) return null;
            if (wake) command = command.Substring(6).Trim();
            awakeUntil = now.AddSeconds(15);
            foreach (string prefix in new[] { "abre ", "abrir ", "inicia ", "iniciar " }) {
                if (!command.StartsWith(prefix, StringComparison.Ordinal)) continue;
                string requested = command.Substring(prefix.Length).Trim();
                AppShortcut app;
                if (installedApps.TryGetValue(requested, out app))
                    return new Reply("Abriendo " + app.Name + ".", null, app.Target);
            }
            if (command == "") {
                string greeting = now.Hour < 12 ? "Buenos días." : now.Hour < 20 ? "Buenas tardes." : "Buenas noches.";
                string[] phrases = { greeting + " ¿Cómo puedo ayudarte?", "Aquí estoy. ¿Qué necesitas?", "Te escucho. ¿En qué puedo ayudarte?" };
                return new Reply(phrases[random.Next(phrases.Length)]);
            }
            switch (command) {
                case "hola": return new Reply("Hola. ¿Cómo puedo ayudarte?");
                case "buenos dias": return new Reply("Buenos días. ¿Qué hacemos hoy?");
                case "buenas tardes": return new Reply("Buenas tardes. ¿En qué puedo ayudarte?");
                case "buenas noches": return new Reply("Buenas noches. Aquí estoy para ayudarte.");
                case "como estas": return Conversational("Estoy listo para ayudarte. ¿Qué necesitas?", "Pues, aquí estoy, listo para ayudarte. ¿Qué necesitas?");
                case "quien eres": return Conversational("Soy tu asistente de escritorio. Puedes pedirme la hora, la fecha o abrir aplicaciones del menú Inicio.", "Bueno, soy tu asistente de escritorio. Puedes pedirme la hora, la fecha o abrir aplicaciones del menú Inicio.");
                case "que puedes hacer": return Conversational("Puedo saludarte, decir la hora y la fecha, contar un chiste y abrir aplicaciones del menú Inicio o servicios web.", "A ver, puedo saludarte, decir la hora y la fecha, contar un chiste y abrir aplicaciones del menú Inicio o servicios web.");
                case "dime la hora": case "que hora es": return new Reply("Son las " + now.ToString("HH:mm", CultureInfo.GetCultureInfo("es-MX")));
                case "dime la fecha": case "que dia es hoy": return new Reply("Hoy es " + now.ToString("dddd d 'de' MMMM", CultureInfo.GetCultureInfo("es-MX")));
                case "gracias": return new Reply("Con gusto. Aquí estoy si necesitas algo más.");
                case "cuentame un chiste": return Conversational("¿Qué hace una abeja en el gimnasio? ¡Zum ba!", "Bueno, ahí va uno. ¿Qué hace una abeja en el gimnasio? ¡Zum ba!");
                case "abre youtube": return new Reply("Abriendo YouTube.", "https://www.youtube.com");
                case "abre spotify": return new Reply("Abriendo Spotify.", "https://open.spotify.com");
                case "abre whatsapp": return new Reply("Abriendo WhatsApp.", "https://web.whatsapp.com");
                case "abre gmail": return new Reply("Abriendo Gmail.", "https://mail.google.com");
                case "abre mapas": return new Reply("Abriendo Maps.", "https://maps.google.com");
                case "adios": case "hasta luego": Reset(); return new Reply("Hasta luego.");
                case "silencio": Reset(); return null;
                default: return new Reply("Puedes pedirme la hora, la fecha, un saludo o abrir YouTube.");
            }
        }
        public static void SelfTest() {
            var d = new Dialog(); var now = new DateTime(2026, 10, 3, 9, 0, 0);
            Action<bool> check = ok => { if (!ok) throw new Exception("Falló una prueba de conversación."); };
            check(d.Hear("hola", 1, now) == null);
            check(d.Hear("jarvis", .4f, now) == null);
            check(d.Hear("jarvis", .55f, now) != null);
            check(d.Hear("yarvis buenos días", .8f, now).Text.StartsWith("Buenos días"));
            check(d.Hear("dime la hora", 1, now.AddSeconds(3)).Text.Contains("09:00"));
            check(d.Hear("hola", 1, now.AddSeconds(30)) == null);
            check(d.Hear("jarvis buenos días", 1, now).Text.StartsWith("Buenos días"));
            check(d.Hear("jarvis abre youtube", 1, now).Url == "https://www.youtube.com");
            d.Reset(); check(d.Hear("abre youtube", 1, now) == null);
            check(d.Hear("jarvisiano", 1, now) == null);
            d.Hear("jarvis", 1, now); d.Hear("silencio", 1, now);
            check(d.Hear("hola", 1, now) == null);
        }
    }
}
