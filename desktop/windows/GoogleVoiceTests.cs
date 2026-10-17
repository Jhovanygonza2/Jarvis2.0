using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
namespace JarvisDesktop {
    static class GoogleVoiceTests {
        sealed class FakeHandler : HttpMessageHandler {
            public HttpStatusCode Status = HttpStatusCode.OK;
            public int Calls;
            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token) {
                Calls++;
                Check(request.RequestUri.AbsoluteUri == "https://texttospeech.googleapis.com/v1/text:synthesize");
                Check(request.Headers.Contains("X-Goog-Api-Key"));
                string body = await request.Content.ReadAsStringAsync();
                Check(!body.Contains("test-secret"));
                var parsed = new JavaScriptSerializer().DeserializeObject(body) as System.Collections.Generic.Dictionary<string, object>;
                var input = (System.Collections.Generic.Dictionary<string, object>)parsed["input"];
                Check((string)input["text"] == "Hola \"Google\"\n¿Cómo estás?");
                return new HttpResponseMessage(Status) { Content = new StringContent(new JavaScriptSerializer().Serialize(new { audioContent = Convert.ToBase64String(SampleWave()) })) };
            }
        }
        static void Check(bool ok) { if (!ok) throw new Exception("Falló una prueba de Google Voice."); }
        static byte[] SampleWave() {
            using (var stream = new MemoryStream()) using (var w = new BinaryWriter(stream)) {
                w.Write(Encoding.ASCII.GetBytes("RIFF")); w.Write(36 + 1600); w.Write(Encoding.ASCII.GetBytes("WAVEfmt "));
                w.Write(16); w.Write((short)1); w.Write((short)1); w.Write(8000); w.Write(16000); w.Write((short)2); w.Write((short)16);
                w.Write(Encoding.ASCII.GetBytes("data")); w.Write(1600); w.Write(new byte[1600]); return stream.ToArray();
            }
        }
        public static void Run() { RunAsync().GetAwaiter().GetResult(); }
        static async Task RunAsync() {
            var config = new GoogleVoiceSettings(); config.SetKey("test-secret");
            Check(config.GetKey() == "test-secret"); Check(!config.ProtectedKey.Contains("test-secret"));
            Check(WaveAudio.Duration(SampleWave()).TotalMilliseconds == 250);
            bool invalid = false;
            try { WaveAudio.Duration(new byte[44]); } catch (InvalidDataException) { invalid = true; }
            Check(invalid);
            bool playbackCanceled = false;
            try { await WaveAudio.PlayAsync(SampleWave(), new CancellationToken(true), null); }
            catch (OperationCanceledException) { playbackCanceled = true; }
            Check(playbackCanceled);
            var handler = new FakeHandler();
            using (var client = new GoogleVoiceClient(handler)) {
                var bytes = await client.SynthesizeAsync("Hola \"Google\"\n¿Cómo estás?", "test-secret", "es-US-Neural2-A", CancellationToken.None);
                Check(bytes.Length == 1644);
                handler.Status = HttpStatusCode.Forbidden;
                bool forbidden = false;
                try { await client.SynthesizeAsync("Hola \"Google\"\n¿Cómo estás?", "test-secret", "es-US-Neural2-A", CancellationToken.None); }
                catch (InvalidOperationException ex) { forbidden = ex.Message.Contains("no autorizó") && !ex.Message.Contains("test-secret"); }
                Check(forbidden);
                int before = handler.Calls;
                bool canceled = false;
                try { await client.SynthesizeAsync("hola", "test-secret", "es-US-Neural2-A", new CancellationToken(true)); }
                catch (OperationCanceledException) { canceled = true; }
                Check(canceled && handler.Calls == before);
            }
        }
    }
}
