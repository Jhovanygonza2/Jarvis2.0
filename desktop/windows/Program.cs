using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Speech.Recognition;
using System.Speech.Synthesis;
using System.Threading;
using System.Windows.Forms;

namespace JarvisDesktop {
    static class Program {
        [STAThread]
        static int Main(string[] args) {
            if (args.Contains("--self-test")) { Dialog.SelfTest(); GoogleVoiceTests.Run(); return 0; }
            if (args.Contains("--check")) {
                using (var synth = new SpeechSynthesizer()) {
                    return SpeechRecognitionEngine.InstalledRecognizers().Any(r => r.Culture.TwoLetterISOLanguageName == "es")
                        && synth.GetInstalledVoices().Any(v => v.Enabled && v.VoiceInfo.Culture.TwoLetterISOLanguageName == "es") ? 0 : 2;
                }
            }
            bool owner;
            using (var single = new Mutex(true, "Local\\JarvisDesktopAssistant", out owner)) {
                if (!owner) return 0;
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                using (var app = new Assistant()) Application.Run(app);
                single.ReleaseMutex();
            }
            return 0;
        }
    }
    sealed class Assistant : ApplicationContext {
        readonly Control ui = new Control();
        readonly NotifyIcon tray;
        readonly ToolStripMenuItem toggle;
        readonly Dialog dialog = new Dialog();
        SpeechRecognitionEngine recognizer;
        readonly object captureLock = new object();
        SpeechSynthesizer synth;
        GoogleVoiceSettings googleSettings = new GoogleVoiceSettings();
        readonly GoogleVoiceClient googleClient = new GoogleVoiceClient();
        CancellationTokenSource googleSpeech;
        bool listening, speaking, closing;
        DateTime ignoreUntil = DateTime.MinValue;
        int generation;
        int retryAttempts;
        int peakLevel, peakOverall, detectedCount, heardCount, rejectedCount, replyCount, spokenCount;
        string decision = "WaitingForAudio";
        float lastConfidence;
        readonly System.Windows.Forms.Timer diagnosticTimer = new System.Windows.Forms.Timer { Interval = 3000 };
        readonly System.Windows.Forms.Timer retryTimer = new System.Windows.Forms.Timer { Interval = 5000 };
        string status = "Iniciando";
        readonly string pauseFile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "JarvisDesktop", "paused");
        public Assistant() {
            ui.CreateControl();
            diagnosticTimer.Tick += delegate { UpdateStatus(); };
            diagnosticTimer.Start();
            retryTimer.Tick += delegate { retryTimer.Stop(); if (!closing) StartListening(); };
            var menu = new ContextMenuStrip();
            toggle = new ToolStripMenuItem("Pausar micrófono", null, delegate { if (listening) Pause(); else { retryAttempts = 0; StartListening(); } });
            menu.Items.Add(toggle);
            menu.Items.Add("Configurar voz de Google", null, delegate { ConfigureGoogleVoice(); });
            menu.Items.Add("Ayuda y estado", null, delegate { ShowHelp(); });
            menu.Items.Add("Elegir micrófono y altavoces", null, delegate { Open("ms-settings:sound"); });
            menu.Items.Add("Configuración de voz de Windows", null, delegate { Open("ms-settings:speech"); });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Salir de Jarvis", null, delegate { ExitThread(); });
            tray = new NotifyIcon { Icon = SystemIcons.Information, Text = "Jarvis", ContextMenuStrip = menu, Visible = true };
            tray.DoubleClick += delegate { ShowHelp(); };
            try { googleSettings = GoogleVoiceSettings.Load(); }
            catch (InvalidOperationException ex) { Notify(ex.Message); }
            if (File.Exists(pauseFile)) { status = "Micrófono pausado"; UpdateStatus(); }
            else StartListening(); // Never speak on startup.
        }
        void Dispatch(Action action) {
            if (closing || ui.IsDisposed) return;
            try { ui.BeginInvoke((MethodInvoker)delegate { if (!closing) action(); }); }
            catch (InvalidOperationException) { decision = "DispatchError"; }
        }
        void UpdateStatus() {
            tray.Text = "Jarvis: " + (listening ? "di Jarvis" : "micrófono apagado");
            toggle.Text = listening ? "Pausar micrófono" : "Activar micrófono";
            try {
                Directory.CreateDirectory(Path.GetDirectoryName(pauseFile));
                File.WriteAllText(Path.Combine(Path.GetDirectoryName(pauseFile), "status.txt"),
                    (listening ? "LISTENING" : "STOPPED") + Environment.NewLine + status
                    + Environment.NewLine + "VoiceProvider=" + (googleSettings.Enabled ? "Google Cloud " + googleSettings.Voice : "Windows")
                    + Environment.NewLine + "AudioPeak=" + Interlocked.Exchange(ref peakLevel, 0)
                    + " PeakOverall=" + peakOverall + " Detected=" + detectedCount + " Decision=" + decision
                    + " Recognized=" + heardCount + " Rejected=" + rejectedCount
                    + " Replies=" + replyCount + " Spoken=" + spokenCount
                    + " Confidence=" + lastConfidence.ToString("0.00", System.Globalization.CultureInfo.InvariantCulture));
            } catch (IOException) { } catch (UnauthorizedAccessException) { }
        }
        void StartListening() {
            retryTimer.Stop();
            if (listening) return;
            try {
                var info = SpeechRecognitionEngine.InstalledRecognizers()
                    .Where(r => r.Culture.TwoLetterISOLanguageName == "es")
                    .OrderByDescending(r => r.Culture.Name == "es-MX").FirstOrDefault();
                if (info == null) throw new InvalidOperationException("Falta el reconocimiento de voz en español. Ejecuta Instalar voz española.ps1 y reinicia Jarvis.");
                synth = new SpeechSynthesizer();
                var voice = synth.GetInstalledVoices().Where(v => v.Enabled && v.VoiceInfo.Culture.TwoLetterISOLanguageName == "es")
                    .OrderByDescending(v => v.VoiceInfo.Culture.Name == "es-MX").FirstOrDefault();
                if (voice == null) throw new InvalidOperationException("Falta una voz en español. Ejecuta Instalar voz española.ps1 y reinicia Jarvis.");
                synth.SelectVoice(voice.VoiceInfo.Name);
                synth.Rate = 0;
                synth.SetOutputToDefaultAudioDevice();
                int current = ++generation;
                synth.SpeakStarted += (s, e) => { Interlocked.Increment(ref spokenCount); };
                synth.SpeakCompleted += (s, e) => Dispatch(() => {
                    if (current != generation) return;
                    if (e.Error != null) { status = "Error de salida de voz: " + e.Error.Message; Notify(status); }
                    speaking = false; ignoreUntil = DateTime.UtcNow.AddMilliseconds(900);
                    dialog.Extend(DateTime.Now);
                });
                listening = true;
                status = "Activando micrófono...";
                UpdateStatus();
                // Create and start SAPI without a WinForms synchronization context.
                ThreadPool.QueueUserWorkItem(delegate {
                    try {
                        lock (captureLock) {
                            if (current != generation || closing || !listening) return;
                            recognizer = new SpeechRecognitionEngine(info);
                            var phrases = new System.Collections.Generic.List<string> { "jarvis", "yarvis" };
                            foreach (string command in dialog.SpeechPhrases) { phrases.Add(command); phrases.Add("jarvis " + command); phrases.Add("yarvis " + command); }
                            var grammar = new GrammarBuilder { Culture = info.Culture };
                            grammar.Append(new Choices(phrases.ToArray()));
                            recognizer.LoadGrammar(new Grammar(grammar));
                            recognizer.AudioLevelUpdated += (s, e) => {
                                peakOverall = Math.Max(peakOverall, e.AudioLevel);
                                int previous;
                                do { previous = peakLevel; if (e.AudioLevel <= previous) break; }
                                while (Interlocked.CompareExchange(ref peakLevel, e.AudioLevel, previous) != previous);
                            };
                            recognizer.SpeechDetected += (s, e) => { Interlocked.Increment(ref detectedCount); };
                            recognizer.SpeechRecognitionRejected += (s, e) => { Interlocked.Increment(ref rejectedCount); };
                            recognizer.SpeechRecognized += (s, e) => {
                                Interlocked.Increment(ref heardCount); lastConfidence = e.Result.Confidence;
                                DateTime received = DateTime.UtcNow;
                                Dispatch(() => {
                                    if (current != generation || !listening || speaking || received < ignoreUntil) { decision = "IgnoredDuringResponse"; return; }
                                    decision = e.Result.Text.StartsWith("jarvis", StringComparison.OrdinalIgnoreCase) || e.Result.Text.StartsWith("yarvis", StringComparison.OrdinalIgnoreCase)
                                        ? "WakeRecognized" : "OtherCommand";
                                    var reply = dialog.Hear(e.Result.Text, e.Result.Confidence, DateTime.Now);
                                    if (reply == null) return;
                                    decision = "Reply";
                                    replyCount++;
                                    if (reply.AppPath != null) Open(reply.AppPath);
                                    else if (reply.Url != null) Open(reply.Url);
                                    SpeakReply(reply.Text);
                                });
                            };
                            recognizer.RecognizeCompleted += (s, e) => Dispatch(() => {
                                if (current != generation || !listening) return;
                                RecoverListening(e.Error == null ? "La escucha se interrumpió." : e.Error.Message);
                            });
                            recognizer.SetInputToDefaultAudioDevice();
                            recognizer.RecognizeAsync(RecognizeMode.Multiple);
                        }
                        Dispatch(() => {
                            if (current != generation || !listening) return;
                            if (File.Exists(pauseFile)) File.Delete(pauseFile);
                            status = "Escuchando «Jarvis». Voz: " + (googleSettings.Enabled ? "Google " + googleSettings.Voice : voice.VoiceInfo.Name);
                            UpdateStatus();
                        });
                    } catch (Exception ex) {
                        Dispatch(() => { if (current == generation && !closing) RecoverListening(ex.Message); });
                    }
                });
            } catch (Exception ex) {
                RecoverListening(ex.Message);
            }
        }
        async void SpeakReply(string text) {
            int current = generation;
            speaking = true;
            if (!googleSettings.Enabled) {
                try { synth.SpeakAsync(text); }
                catch (Exception ex) { speaking = false; Notify(ex.Message); }
                return;
            }
            var cancellation = new CancellationTokenSource();
            googleSpeech = cancellation;
            try {
                byte[] wav = await googleClient.SynthesizeAsync(text, googleSettings.GetKey(), googleSettings.Voice, cancellation.Token);
                cancellation.Token.ThrowIfCancellationRequested();
                if (current != generation || closing) return;
                await WaveAudio.PlayAsync(wav, cancellation.Token, () => Interlocked.Increment(ref spokenCount));
            } catch (OperationCanceledException) { }
            catch (Exception ex) {
                if (current == generation && !closing) {
                    status = ex is InvalidOperationException ? ex.Message : "No se pudo reproducir la voz de Google.";
                    Notify(status); UpdateStatus();
                }
            } finally {
                if (googleSpeech == cancellation) googleSpeech = null;
                cancellation.Dispose();
                if (current == generation && !closing) {
                    speaking = false; ignoreUntil = DateTime.UtcNow.AddMilliseconds(900); dialog.Extend(DateTime.Now);
                }
            }
        }
        void ConfigureGoogleVoice() {
            bool resume = listening;
            retryTimer.Stop(); ReleaseSpeech();
            status = "Configurando voz"; UpdateStatus();
            using (var form = new GoogleVoiceForm(googleSettings)) {
                if (form.ShowDialog() == DialogResult.OK) {
                    try { googleSettings = GoogleVoiceSettings.Load(); }
                    catch (InvalidOperationException ex) { Notify(ex.Message); }
                }
            }
            if (resume) { retryAttempts = 0; StartListening(); }
            else { status = "Micrófono pausado"; UpdateStatus(); }
        }
        void RecoverListening(string reason) {
            dialog.Reset(); ReleaseSpeech();
            // A device/service failure is not a user-requested persistent pause.
            if (retryAttempts < 3 && !closing) {
                retryAttempts++;
                status = "Reconectando micrófono (" + retryAttempts + "/3). " + reason;
                retryTimer.Start();
            } else {
                status = "No se pudo activar el micrófono. " + reason;
                Notify(status + " Usa Activar micrófono para reintentar.");
            }
            UpdateStatus();
        }
        void Pause() {
            retryTimer.Stop();
            dialog.Reset(); ReleaseSpeech(); status = "Micrófono pausado";
            try { Directory.CreateDirectory(Path.GetDirectoryName(pauseFile)); File.WriteAllText(pauseFile, "paused"); }
            catch (IOException) { }
            UpdateStatus();
        }
        void ReleaseSpeech() {
            generation++; listening = false; speaking = false;
            if (googleSpeech != null) { googleSpeech.Cancel(); googleSpeech = null; }
            lock (captureLock) {
                if (recognizer != null) {
                    try { recognizer.RecognizeAsyncCancel(); } catch (InvalidOperationException) { }
                    recognizer.Dispose(); recognizer = null;
                }
            }
            if (synth != null) { synth.SpeakAsyncCancelAll(); synth.Dispose(); synth = null; }
        }
        void Notify(string text) { tray.ShowBalloonTip(8000, "Jarvis", text, ToolTipIcon.Info); }
        void Open(string target) {
            try { Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); }
            catch (Exception ex) { Notify("No se pudo abrir: " + ex.Message); }
        }
        void ShowHelp() {
            MessageBox.Show(status + "\n\nDi «Jarvis» y espera la respuesta. Después tienes 15 segundos para decir un comando. También puedes decir «Jarvis, dime la hora».\n\n"
                + String.Join(" · ", Dialog.Commands) + " · abre cualquier app del menú Inicio" + "\n\nNo habla al iniciar Windows. El reconocimiento se procesa localmente; no se guardan grabaciones.\n"
                + "Pausar micrófono libera el micrófono y conserva la pausa al reiniciar. Salir cierra el asistente hasta el próximo inicio de sesión.\n\n"
                + "Este componente ofrece comandos básicos. No incluye todas las funciones de la web ni conversación libre.",
                "Jarvis de escritorio", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        protected override void ExitThreadCore() {
            closing = true; diagnosticTimer.Stop(); diagnosticTimer.Dispose(); retryTimer.Stop(); retryTimer.Dispose(); ReleaseSpeech(); googleClient.Dispose(); status = "Jarvis cerrado"; UpdateStatus(); tray.Visible = false; tray.Dispose(); ui.Dispose(); base.ExitThreadCore();
        }
    }
}
