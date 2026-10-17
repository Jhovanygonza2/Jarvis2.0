using System;
using System.Diagnostics;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;

namespace JarvisDesktop {
    sealed class GoogleVoiceForm : Form {
        readonly TextBox key = new TextBox { UseSystemPasswordChar = true, Width = 490 };
        readonly TextBox voice = new TextBox { Text = "es-US-Neural2-A", Width = 490 };
        readonly Label result = new Label { AutoSize = false, Width = 510, Height = 85 };
        readonly Button activate = new Button { Text = "Probar y activar Google", AutoSize = true };
        readonly Button windows = new Button { Text = "Quitar clave y usar Windows", AutoSize = true };
        readonly GoogleVoiceSettings previous;
        readonly CancellationTokenSource cancel = new CancellationTokenSource();
        public GoogleVoiceForm(GoogleVoiceSettings settings) {
            previous = settings;
            voice.Text = settings.Voice;
            Text = "Jarvis — Voz de Google";
            ClientSize = new Size(555, 560);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false; MinimizeBox = false; StartPosition = FormStartPosition.CenterScreen;
            var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(16), AutoScroll = true };
            layout.Controls.Add(new Label { Text = "Google Cloud Text-to-Speech", AutoSize = true, Font = new Font(Font, FontStyle.Bold) });
            layout.Controls.Add(new Label { Width = 510, Height = 63, Text = "Requiere Internet, un proyecto con Text-to-Speech y facturación habilitados. Google recibirá el texto de las respuestas y puede cobrar por su uso. El audio del micrófono se reconoce localmente." });
            var setup = new LinkLabel { Text = "Abrir configuración de Google Cloud", AutoSize = true };
            setup.LinkClicked += delegate {
                try { Process.Start(new ProcessStartInfo("https://console.cloud.google.com/apis/library/texttospeech.googleapis.com") { UseShellExecute = true }); }
                catch { result.Text = "Abre console.cloud.google.com y habilita Cloud Text-to-Speech API."; }
            };
            layout.Controls.Add(setup);
            var credentials = new LinkLabel { Text = "Crear una clave API en Credenciales", AutoSize = true };
            credentials.LinkClicked += delegate {
                try { Process.Start(new ProcessStartInfo("https://console.cloud.google.com/apis/credentials") { UseShellExecute = true }); }
                catch { result.Text = "En Google Cloud abre APIs y servicios → Credenciales."; }
            };
            layout.Controls.Add(credentials);
            layout.Controls.Add(new Label { Text = "Clave API (restríngela a Cloud Text-to-Speech API)", AutoSize = true });
            layout.Controls.Add(key);
            layout.Controls.Add(new Label { Width = 510, Height = 34, Text = settings.Enabled ? "Puedes dejarla vacía para conservar la clave guardada. Se almacena cifrada para tu usuario de Windows." : "Se almacena cifrada para tu usuario de Windows. No se publica en la web ni se escribe en el registro de estado." });
            layout.Controls.Add(new Label { Text = "Voz Neural2 (es-US-Neural2-A: español latino, femenina)", AutoSize = true });
            layout.Controls.Add(voice);
            activate.Click += async delegate {
                activate.Enabled = false; windows.Enabled = false;
                result.Text = "Comprobando la clave y generando una muestra con Google…";
                try {
                    string value = key.Text.Trim();
                    if (value.Length == 0 && previous.Enabled) value = previous.GetKey();
                    var next = new GoogleVoiceSettings { Enabled = true, Voice = voice.Text.Trim() };
                    next.SetKey(value);
                    using (var client = new GoogleVoiceClient()) {
                        byte[] audio = await client.SynthesizeAsync("Hola, soy Jarvis. ¿Cómo puedo ayudarte hoy?", value, next.Voice, cancel.Token);
                        await WaveAudio.PlayAsync(audio, cancel.Token, null);
                    }
                    cancel.Token.ThrowIfCancellationRequested();
                    next.Save();
                    key.Clear();
                    DialogResult = DialogResult.OK;
                    Close();
                } catch (OperationCanceledException) { }
                catch (InvalidOperationException ex) { if (!IsDisposed) result.Text = ex.Message; }
                catch (Exception) { if (!IsDisposed) result.Text = "No se pudo reproducir o guardar la prueba. Revisa la salida de audio y vuelve a intentarlo."; }
                finally { if (!IsDisposed) { activate.Enabled = true; windows.Enabled = true; } }
            };
            windows.Click += delegate {
                try { new GoogleVoiceSettings().Save(); key.Clear(); DialogResult = DialogResult.OK; Close(); }
                catch { result.Text = "No se pudo guardar el cambio de voz."; }
            };
            layout.Controls.Add(activate); layout.Controls.Add(windows); layout.Controls.Add(result);
            Controls.Add(layout);
            FormClosing += delegate { cancel.Cancel(); };
            FormClosed += delegate { key.Clear(); };
        }
    }
}
