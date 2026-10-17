export function whatsappTarget() {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return mobile
    ? { url: "whatsapp://send", label: "WhatsApp", target: "_self", fallbackUrl: "https://www.whatsapp.com/download" }
    : { url: "https://web.whatsapp.com", label: "WhatsApp Web", target: "_self" };
}


export function appTarget(url, options = {}, device = navigator) {
  const link = { url, label: new URL(url).hostname, target: "_blank", ...options };
  const android = /Android/i.test(device.userAgent);
  const ios = /iPhone|iPad|iPod/i.test(device.userAgent)
    || (/Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1);
  if (!android && !ios) return link;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") return link;
  const services = {
    "www.youtube.com": ["YouTube", "com.google.android.youtube", "youtube://" + parsed.host + parsed.pathname + parsed.search],
    "open.spotify.com": ["Spotify", "com.spotify.music", parsed.pathname.startsWith("/search/")
      ? "spotify:search:" + parsed.pathname.slice(8) : "spotify:"],
    "mail.google.com": ["Gmail", "com.google.android.gm", "googlegmail://"],
    "drive.google.com": ["Google Drive", "com.google.android.apps.docs", "googledrive://"],
    "maps.google.com": ["Google Maps", "com.google.android.apps.maps", "comgooglemaps://"],
    "www.netflix.com": ["Netflix", "com.netflix.mediaclient", "nflx://www.netflix.com/"],
    "www.instagram.com": ["Instagram", "com.instagram.android", "instagram://app"],
    "x.com": ["X", "com.twitter.android", "twitter://timeline"],
  };
  const service = services[parsed.hostname];
  if (!service) return link;
  const [label, packageName, iosUrl] = service;
  return { ...link, label, target: "_self", fallbackUrl: url,
    fallbackLabel: "Abrir " + label + " en el navegador",
    url: android ? "intent://" + parsed.host + parsed.pathname + parsed.search
      + "#Intent;scheme=https;package=" + packageName + ";end" : iosUrl };
}
