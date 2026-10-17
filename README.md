# 🌌 J.A.R.V.I.S. - Virtual Assistant

**Just A Rather Very Intelligent System** is a next-generation virtual assistant built with React, featuring a stunning 3D holographic interface and voice-controlled capabilities.

![Jarvis HUD](https://img.shields.io/badge/Interface-3D_HUD-00e5ff?style=for-the-badge)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Three.js](https://img.shields.io/badge/Three.js-000000?style=for-the-badge&logo=three.dot.js&logoColor=white)

## ✨ Features

- **🗣️ Advanced Voice Recognition**: Natural interaction using `react-speech-recognition`.
- **💠 3D Holographic Orb**: A high-performance 3D sphere built with `Three.js` that reacts dynamically to your voice frequency.
- **📺 YouTube Integration**: Search and play videos directly through voice commands.
- **🛠️ Productivity Tools**: Open Google Apps (Drive, Gmail, Maps), Spotify, WhatsApp, and more.
- **🕒 Real-time Status**: Live clock, date, and system status indicators.
- **🔐 Secure API Management**: Environment-based configuration for API keys.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- A YouTube Data API v3 Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Jhovanygonza2/Jarvis.git
   cd Jarvis
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory and add your YouTube API Key:
   ```env
   REACT_APP_YOUTUBE_API_KEY=your_api_key_here
   ```

4. **Run the application:**
   ```bash
   npm start
   ```

## 🎙️ Command Samples

- *"Video de Iron Man"* - Searches for Iron Man videos on YouTube.
- *"Pon el primero"* - Plays the first result from the list.
- *"Dime la hora"* - Jarvis tells you the current time.
- *"Buscar galaxias en Google"* - Opens a Google search for galaxies.
- *"Cerrar video"* - Stops the current YouTube playback.

## 🛠️ Tech Stack

- **Frontend**: React.js
- **3D Graphics**: Three.js
- **Voice Recognition**: Web Speech API / react-speech-recognition
- **Styling**: Vanilla CSS (Custom HUD Design)
- **API**: YouTube Data API v3

## 👤 Author

**Jhovanygonza2**

---

*This project is for educational and hobbyist purposes, inspired by the Marvel Cinematic Universe.*

## Controles de voz y texto

- El micrófono empieza apagado. Pulsa **Activar micrófono** y acepta el permiso del navegador.
- **Pausar micrófono** detiene la escucha y descarta el comando de voz pendiente.
- Escribe en **Escribe un comando** y pulsa Enter o **Enviar**; funciona también sin reconocimiento de voz.
- **Editar lo que escuchó Jarvis** pausa la escucha y copia la transcripción al cuadro de texto.
- **Silenciar voz** desactiva las respuestas habladas. **Detener respuesta** interrumpe solo la respuesta actual.
- Durante una respuesta, Jarvis pausa la escucha y la reanuda únicamente si el micrófono sigue activado.
- Después de buscar videos, puedes decir o escribir `1` a `5`, `pon el segundo` o `reproduce el primero`.

Verificación local: `npm test -- --watchAll=false --runInBand` y `npm run build`.

## Usarlo desde computadora, tablet o celular

Jarvis es una aplicación web: los dispositivos que la visitan solo necesitan un navegador moderno con JavaScript. No necesitan instalar Node.js. La interfaz se adapta a la pantalla y los comandos por texto están disponibles aunque el navegador no admita reconocimiento de voz.

### Publicar una URL accesible desde otros dispositivos

Desde la carpeta que contiene package.json, ejecuta:

```bash
npm ci
npm run build
```

Publica la carpeta **build** en un alojamiento web con HTTPS. Por ejemplo, puedes arrastrar esa carpeta a [Netlify Drop](https://app.netlify.com/drop/) y abrir la URL resultante en tus dispositivos. No subas la carpeta del proyecto ni el archivo .env. Si conectas el repositorio a Netlify, netlify.toml ya define el comando y la carpeta de publicación; si el proyecto está dentro de otra carpeta del repositorio, selecciona esa carpeta como directorio base.

Para buscar videos dentro de Jarvis, configura REACT_APP_YOUTUBE_API_KEY antes de compilar (en .env local o en las variables del alojamiento). Esta clave se incorpora al JavaScript público: restríngela a YouTube Data API v3 y a los dominios donde publiques la aplicación. Sin clave puedes seguir usando los comandos locales y los enlaces externos.

### Añadirlo a la pantalla de inicio

Abre la URL HTTPS y busca **Instalar aplicación** o **Añadir a pantalla de inicio** en el menú del navegador. En iPhone/iPad, usa el menú Compartir de Safari y **Añadir a pantalla de inicio**. La opción exacta depende del navegador. Jarvis incluye un manifiesto para abrirse como aplicación independiente donde sea compatible.

La instalación no añade funcionamiento sin conexión: los servicios externos y el reconocimiento de voz pueden necesitar Internet. El historial de esta versión se mantiene solo durante la sesión y no se sincroniza entre dispositivos.

### Probar en la misma red Wi-Fi

Ejecuta npm start en la computadora y abre desde el celular la dirección **On Your Network** que aparece en la terminal. Ambos deben estar en la misma red y el firewall debe permitir el puerto del servidor (normalmente 3000) en esa red privada. La computadora debe permanecer encendida. Usa esto solo para pruebas de desarrollo.

Una dirección HTTP de red local permite probar los comandos escritos, pero el micrófono requiere HTTPS (o localhost en el propio dispositivo). Para el uso habitual desde cualquier red, utiliza la URL publicada con HTTPS.

### Compatibilidad

- Computadoras Windows, macOS y Linux, teléfonos y tabletas: acceso mediante navegador moderno.
- Voz: depende de las funciones del navegador, permisos y conexión segura; si no está disponible, utiliza el cuadro de texto.
- Gráficos: si WebGL no está disponible, se muestra una esfera simple y los comandos siguen disponibles.
- Abrir servicios externos depende de las restricciones de ventanas emergentes y de las cuentas de cada servicio.

Referencias: [publicación manual en Netlify](https://docs.netlify.com/deploy/create-deploys/) y [requisitos de instalación web](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

### Voz en Android

Cuando el navegador no admite escucha continua, pulsa **Activar micrófono**, di un comando y espera la respuesta. Para el siguiente comando, vuelve a pulsar el botón. Abre la web mediante HTTPS y permite el acceso al micrófono. Si un servicio externo no se abre, utiliza el enlace visible debajo de los controles.


### Abrir WhatsApp en el celular

El comando `abre WhatsApp` ofrece un enlace a la app instalada en Android, iPhone y iPad; en computadora usa WhatsApp Web. También reconoce `whats app`, `wasap` y `ponme WhatsApp`. Si el comando por voz no puede abrir la app automáticamente, Jarvis pide tocar **Abrir WhatsApp**. La apertura depende del navegador y de tener WhatsApp instalado; hay un enlace de descarga como alternativa. No se envían mensajes automáticamente.


### Apertura automatica de WhatsApp

Al decir o escribir `abre WhatsApp`, Jarvis intenta abrirlo directamente. En computadora, WhatsApp Web reemplaza a Jarvis en la misma pestana; usa Atras para volver. En celular, intenta abrir la app instalada. El navegador puede exigir confirmacion para aplicaciones externas; el enlace manual sigue disponible si bloquea el intento.


### Temperatura con Open-Meteo

Di o escribe **dime la temperatura**. Consulta el pronostico horario para la ubicacion fija **18.6089, -90.7454**, con hora de America/Mexico_City. No utiliza la ubicacion del dispositivo ni representa una medicion en tiempo real. Usa el modelo DWD ICON EPS ensemble mean. La dispersion no se presenta como sensacion termica. Las consultas de clima para otras ciudades mantienen su busqueda externa. Fuente: https://open-meteo.com/


### Clima de Escarcega

Di o escribe **dime el clima de Escarcega**, **clima en Escarcega** o **tiempo en Escarcega hoy**. Jarvis responde dentro de la app con el pronostico para la hora local de Escarcega, Campeche: temperatura, condiciones, probabilidad de precipitacion, humedad y viento, cuando esos datos esten disponibles. Usa Open-Meteo Forecast API. No requiere clave. Las consultas de otras ciudades conservan la busqueda externa.


### Abrir videos en YouTube

Los comandos **video de galaxias**, **busca en youtube gatos**, **reproduce musica relajante** y **ponme rock** abren la busqueda directamente en YouTube, en la misma pestana. Usa Atras para volver a Jarvis. Si la navegacion se bloquea, toca **Abrir YouTube**. Este flujo no consume la API. La busqueda integrada sigue disponible con **buscar en jarvis galaxias**.


Puedes decir **YouTube musica relajante**, **abre YouTube y busca recetas** o **busca galaxias en YouTube**. Abre directamente los resultados del tema pedido. Decir solo **YouTube** abre su portada.


### Voz y apertura en móviles (actualización)

En **Ajustar voz**, elige una voz en español y pulsa **Probar voz**. Se guarda la preferencia en ese navegador. El modo automático prioriza voces identificadas como mejoradas y español de México; utiliza tono y velocidad normales. La voz sigue siendo la del sistema, no un servicio de voz neuronal en la nube. Si no hay voces de buena calidad, descárgalas desde los ajustes del dispositivo.

La tarjeta **Jarvis en tu pantalla de inicio** permite instalar cuando el navegador ofrece esa función. En iPhone/iPad, abre Jarvis en Safari y usa Compartir → Añadir a pantalla de inicio (Abrir como app). Después abre el icono Jarvis. Requiere publicar los cambios con HTTPS; no es un APK ni una app de App Store, y no añade modo sin conexión.

En Android y iOS/iPadOS los comandos de YouTube, Spotify, Gmail, Drive, Maps, Netflix, Instagram y X intentan abrir sus apps mediante enlaces específicos. WhatsApp conserva su apertura nativa. Si el sistema bloquea el intento automático, toca **Abrir [app]**. Debe estar instalada; la compatibilidad del enlace depende de la app y el navegador. El enlace alternativo permite abrir la versión web manualmente. Servicios sin enlace nativo configurado conservan su apertura web. No se puede confirmar desde la web que la app se haya abierto.

Validar en dispositivos reales: instalar y abrir desde el icono; probar una respuesta y cambiar voz; abrir YouTube con búsqueda y Spotify; probar con la app ausente y mediante el enlace manual. Las pruebas unitarias no validan la calidad acústica ni las políticas de apertura del sistema operativo.


### Jarvis sin abrir el navegador en Windows

El componente [Jarvis de escritorio](desktop/windows/README.md) funciona en la bandeja y puede iniciarse con la sesión de Windows. Permanece en silencio hasta oír «Jarvis». Tiene saludos, respuestas breves, hora, fecha y apertura de servicios; requiere las funciones de voz españolas de Windows. No incluye todas las funciones de la web.


### Chat con IA y conversaciones

La web conserva conversaciones en el almacenamiento local del navegador. Usa **Nuevo chat** para iniciar otra, selecciónala para retomarla o pulsa × para borrarla. Las conversaciones no se sincronizan entre dispositivos.

El chat usa una función de Netlify y la API de OpenAI. En el panel de Netlify configura `OPENAI_API_KEY` como variable privada del entorno de funciones. Opcionalmente configura `OPENAI_MODEL`; por defecto se usa `gpt-6-astra`. Para desarrollo local, inicia la app mediante Netlify Dev para que `/.netlify/functions/chat` esté disponible y define las mismas variables en el entorno local. No pongas la clave en variables `REACT_APP_*` ni en código del navegador.

Las acciones del dispositivo requieren comandos directos, por ejemplo **abre WhatsApp**, **busca gatos en YouTube** o **dime la hora**. Las demás consultas se envían al chat de IA. Si el navegador no admite reconocimiento de voz, el chat por texto sigue disponible. La frase reconocida queda pendiente para que elijas **Enviar transcripción** o la edites antes de enviarla. **Pausar micrófono** detiene la escucha; el botón para corregir copia primero la frase al campo de texto.
