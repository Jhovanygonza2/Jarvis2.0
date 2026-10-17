using System;
using System.IO;
using System.Media;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace JarvisDesktop {
    public sealed class GoogleVoiceSettings {
        public bool Enabled { get; set; }
        public string Voice { get; set; }
        public string ProtectedKey { get; set; }
        public GoogleVoiceSettings() { Voice = "es-US-Neural2-A"; }
        public static readonly string SettingsPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "JarvisDesktop", "google-voice.json");
        public void SetKey(string key) {
            if (String.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("Introduce una clave de Google Cloud.");
            ProtectedKey = Convert.ToBase64String(ProtectedData.Protect(Encoding.UTF8.GetBytes(key.Trim()), null, DataProtectionScope.CurrentUser));
        }
        public string GetKey() {
            try { return Encoding.UTF8.GetString(ProtectedData.Unprotect(Convert.FromBase64String(ProtectedKey ?? ""), null, DataProtectionScope.CurrentUser)); }
            catch (Exception) { throw new InvalidOperationException("Vuelve a introducir la clave de Google Cloud en Configurar voz de Google."); }
        }
        public static GoogleVoiceSettings Load() {
            if (!File.Exists(SettingsPath)) return new GoogleVoiceSettings();
            try {
                var result = new JavaScriptSerializer().Deserialize<GoogleVoiceSettings>(File.ReadAllText(SettingsPath));
                if (result == null) throw new InvalidDataException();
                if (result.Enabled) { GoogleVoiceClient.ValidateVoice(result.Voice); result.GetKey(); }
                return result;
            } catch (Exception) { throw new InvalidOperationException("No se pudo leer la configuración de Google. Vuelve a configurarla; mientras tanto se usará la voz de Windows."); }
        }
        public void Save() {
            Directory.CreateDirectory(Path.GetDirectoryName(SettingsPath));
            string temporary = SettingsPath + ".tmp";
            File.WriteAllText(temporary, new JavaScriptSerializer().Serialize(this), Encoding.UTF8);
            if (File.Exists(SettingsPath)) File.Replace(temporary, SettingsPath, null);
            else File.Move(temporary, SettingsPath);
        }
    }
    public sealed class GoogleVoiceClient : IDisposable {
        readonly HttpClient http;
        public GoogleVoiceClient() : this(new HttpClientHandler { AllowAutoRedirect = false }) { }
        internal GoogleVoiceClient(HttpMessageHandler handler) {
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;
            http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(20), MaxResponseContentBufferSize = 4 * 1024 * 1024 };
        }
        internal static string ValidateVoice(string voice) {
            if (voice == null || !Regex.IsMatch(voice, @"^es-(US|ES)-Neural2-[A-F]$"))
                throw new InvalidOperationException("Usa una voz española Neural2, por ejemplo es-US-Neural2-A.");
            return voice.Substring(0, 5);
        }
        public async Task<byte[]> SynthesizeAsync(string text, string key, string voice, CancellationToken token) {
            token.ThrowIfCancellationRequested();
            if (String.IsNullOrWhiteSpace(key) || key.IndexOfAny(new[] { '\r', '\n' }) >= 0)
                throw new InvalidOperationException("Falta una clave válida de Google Cloud.");
            if (String.IsNullOrWhiteSpace(text) || Encoding.UTF8.GetByteCount(text) > 4500)
                throw new InvalidOperationException("La respuesta está vacía o es demasiado larga.");
            var body = new JavaScriptSerializer().Serialize(new {
                input = new { text = text },
                voice = new { languageCode = ValidateVoice(voice), name = voice },
                audioConfig = new { audioEncoding = "LINEAR16", speakingRate = 1.0, pitch = 0.0 }
            });
            using (var request = new HttpRequestMessage(HttpMethod.Post, "https://texttospeech.googleapis.com/v1/text:synthesize")) {
                request.Headers.Add("X-Goog-Api-Key", key.Trim());
                request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                try {
                    using (var response = await http.SendAsync(request, token).ConfigureAwait(false)) {
                        if (!response.IsSuccessStatusCode) {
                            switch ((int)response.StatusCode) {
                                case 400: throw new InvalidOperationException("Google rechazó la clave o la voz seleccionada. Comprueba ambos datos.");
                                case 401: case 403: throw new InvalidOperationException("Google no autorizó la solicitud. Revisa la clave, la API Text-to-Speech habilitada, sus restricciones y la facturación del proyecto.");
                                case 429: throw new InvalidOperationException("Google indicó que se agotó la cuota o se hicieron demasiadas solicitudes. Revisa la cuota de tu proyecto.");
                                default: throw new InvalidOperationException("Google no pudo generar la voz (HTTP " + (int)response.StatusCode + "). Inténtalo más tarde.");
                            }
                        }
                        string json = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
                        token.ThrowIfCancellationRequested();
                        try {
                            var parsed = new JavaScriptSerializer { MaxJsonLength = 4 * 1024 * 1024 }.Deserialize<AudioResponse>(json);
                            byte[] wav = Convert.FromBase64String(parsed.audioContent);
                            WaveAudio.Duration(wav);
                            return wav;
                        } catch (Exception) { throw new InvalidOperationException("Google devolvió un audio no válido."); }
                    }
                } catch (OperationCanceledException) {
                    if (token.IsCancellationRequested) throw;
                    throw new InvalidOperationException("Google tardó demasiado en responder. Revisa Internet e inténtalo de nuevo.");
                } catch (HttpRequestException) { throw new InvalidOperationException("No se pudo conectar con Google. Revisa Internet."); }
            }
        }
        public void Dispose() { http.Dispose(); }
        public sealed class AudioResponse { public string audioContent { get; set; } }
    }
    public static class WaveAudio {
        public static TimeSpan Duration(byte[] data) {
            if (data == null || data.Length < 44 || Encoding.ASCII.GetString(data, 0, 4) != "RIFF" || Encoding.ASCII.GetString(data, 8, 4) != "WAVE")
                throw new InvalidDataException("Audio WAV no válido.");
            uint bytesPerSecond = 0, audioBytes = 0;
            for (long pos = 12; pos + 8 <= data.Length;) {
                string type = Encoding.ASCII.GetString(data, (int)pos, 4);
                uint length = BitConverter.ToUInt32(data, (int)pos + 4);
                long start = pos + 8;
                if (start + length > data.Length) throw new InvalidDataException("Audio WAV incompleto.");
                if (type == "fmt " && length >= 16) {
                    if (BitConverter.ToUInt16(data, (int)start) != 1) throw new InvalidDataException("El audio debe ser PCM.");
                    bytesPerSecond = BitConverter.ToUInt32(data, (int)start + 8);
                }
                if (type == "data") audioBytes = length;
                pos = start + length + (length % 2);
            }
            if (bytesPerSecond == 0 || audioBytes == 0) throw new InvalidDataException("Audio WAV vacío.");
            double seconds = (double)audioBytes / bytesPerSecond;
            if (seconds > 180) throw new InvalidDataException("Audio demasiado largo.");
            return TimeSpan.FromMilliseconds(seconds * 1000 + 150);
        }
        public static async Task PlayAsync(byte[] wav, CancellationToken token, Action started) {
            TimeSpan duration = Duration(wav);
            using (var stream = new MemoryStream(wav, false))
            using (var player = new SoundPlayer(stream)) {
                await Task.Run(() => player.Load(), token).ConfigureAwait(false);
                var gate = new object();
                using (token.Register(() => { lock (gate) { player.Stop(); } })) {
                    try {
                        lock (gate) {
                            token.ThrowIfCancellationRequested();
                            player.Play();
                            if (started != null) started();
                        }
                        await Task.Delay(duration, token).ConfigureAwait(false);
                    } finally { lock (gate) { player.Stop(); } }
                }
            }
        }
    }
}
