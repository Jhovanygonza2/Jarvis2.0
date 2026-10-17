# Jarvis de escritorio para Windows

Componente nativo de bandeja, sin navegador ni servidor web abierto. No habla al iniciar sesión. Di **Jarvis**, espera una respuesta y di un comando en los siguientes 15 segundos; o usa **Jarvis, dime la hora**. Vuelve a esperar la respuesta antes de hablar. Es reconocimiento local de frases limitadas, no conversación libre ni todas las funciones del Jarvis web.

Necesita Windows de 64 bits, .NET Framework, un micrófono con permiso para aplicaciones de escritorio, reconocimiento System.Speech y una voz española. `JarvisDesktop.exe --check` devuelve 0 si hay voz y reconocimiento españoles; 2 si faltan. No activa el micrófono.

## Preparación

1. Si faltan componentes, ejecuta **Instalar voz española.ps1** desde Windows PowerShell como administrador. Descarga solo Basic, Speech y TextToSpeech es-ES desde Windows Update; no cambia el idioma de la interfaz. Revisa `language-install.log`. Windows puede pedir reiniciar.
2. Ejecuta `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install.ps1` desde esta carpeta. Compila y prueba, copia el ejecutable a `%LOCALAPPDATA%\JarvisDesktop` y crea un acceso directo en Inicio para el usuario actual. No modifica la política de ejecución global.
3. El icono Jarvis aparece junto al reloj (puede estar dentro de la flecha de iconos ocultos). Doble clic muestra el estado y los comandos. **Pausar micrófono** libera la escucha y conserva la pausa al reiniciar. **Salir de Jarvis** lo cierra; se iniciará de nuevo en la siguiente sesión.

## Comandos

Hola, buenos días, buenas tardes, buenas noches, cómo estás, quién eres, qué puedes hacer, dime la hora, dime la fecha, gracias, cuéntame un chiste, abre YouTube, abre Spotify, abre WhatsApp, abre Gmail, abre mapas, hasta luego, silencio. Además de los servicios web, puedes decir «abre [nombre]» para iniciar una aplicación con acceso directo en el menú Inicio. Jarvis carga los nombres instalados al activarse; también reconoce Calculadora, Bloc de notas, Explorador de archivos y Paint. Las aplicaciones sin acceso directo en Inicio no se detectan automáticamente. Las aperturas web usan el navegador predeterminado de la computadora. Después de 15 segundos sin interacción vuelve a esperar «Jarvis». No guarda audio ni transcripciones ni envía voz a un servicio remoto.

Las respuestas sobre cómo está, quién es, qué puede hacer y los chistes incluyen ocasionalmente «Pues», «Bueno» o «A ver». Se elige la variante aproximadamente una de cada tres veces elegibles y nunca en dos respuestas elegibles seguidas.

## Verificar y quitar

`Build.ps1` compila y ejecuta las pruebas de activación, confianza, expiración y comandos sin escuchar ni hablar. Para probar en persona, confirma que no hable al arrancar, que ignore comandos sin activación, que responda a Jarvis y que la pausa libere el micrófono. El reconocimiento puede confundirse con ruido o televisión; no sirve para autenticar al usuario.

Para desinstalar, sal desde la bandeja y ejecuta `Uninstall.ps1`. Elimina solo los archivos nombrados y el acceso directo de inicio; conserva los idiomas de Windows.

Las interrupciones del motor o del micrófono se reintentan hasta tres veces, cada cinco segundos. No se guardan como una pausa manual. Solo **Pausar micrófono** conserva la pausa para el siguiente inicio.


## Voz de Google Cloud

En el icono de Jarvis junto al reloj, abre **Configurar voz de Google**.

1. En [Google Cloud](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com), selecciona o crea un proyecto, habilita facturación y **Cloud Text-to-Speech API**.
2. En [Credenciales](https://console.cloud.google.com/apis/credentials), crea una clave API y restríngela a **Cloud Text-to-Speech API**. No uses una clave restringida a sitios web: Jarvis hace las solicitudes desde Windows.
3. Pega la clave exclusivamente en la ventana local de Jarvis. La voz inicial es **es-US-Neural2-A**, español latino y femenina. La [lista oficial de voces](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types) permite consultar otras voces españolas Neural2.
4. Pulsa **Probar y activar Google**. Genera una muestra con Google, la reproduce y solo guarda la configuración si la prueba termina correctamente. Esta prueba y las respuestas posteriores pueden generar cargos según [las tarifas de Google](https://cloud.google.com/text-to-speech/pricing).

La clave se cifra con DPAPI para el usuario actual de Windows en `%LOCALAPPDATA%\JarvisDesktop\google-voice.json`; no se incluye en el repositorio ni en Netlify. Las solicitudes van por HTTPS al endpoint oficial, con un límite de espera de 20 segundos. El texto de las respuestas se envía a Google; el micrófono se reconoce localmente. El audio de respuesta se reproduce desde memoria y no se guarda en disco. Si falla Google, se muestra el error, sin sustituir silenciosamente la voz por Helena. Puedes elegir **Quitar clave y usar Windows** para volver a la voz anterior.

Las pruebas locales cubren el cifrado y recuperación de una clave ficticia, la solicitud HTTP simulada, el formato WAV, la cancelación previa y el rechazo de permisos. No prueban la cuenta real de Google: la conexión y la calidad audible se verifican al pulsar **Probar y activar Google** con tu clave.
