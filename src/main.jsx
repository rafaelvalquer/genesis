import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/chakra-petch/latin-400.css";
import "@fontsource/chakra-petch/latin-500.css";
import "@fontsource/chakra-petch/latin-600.css";
import "@fontsource/chakra-petch/latin-700.css";
import App from "./App.jsx";
import { initializePlatform } from "./platform/bootstrap.js";
import "./styles.css";
import "./mobile/mobile.css";

initializePlatform();

const VITE_PRELOAD_RELOAD_KEY = "genesis:vite-preload-reload-at";
const VITE_PRELOAD_RELOAD_WINDOW_MS = 30_000;

window.addEventListener("vite:preloadError", (event) => {
  const now = Date.now();
  const lastReloadAt = Number(
    window.sessionStorage.getItem(VITE_PRELOAD_RELOAD_KEY) || 0,
  );

  // Evita loop de reload caso o arquivo realmente esteja ausente no deploy.
  if (now - lastReloadAt < VITE_PRELOAD_RELOAD_WINDOW_MS) {
    return;
  }

  event.preventDefault();
  window.sessionStorage.setItem(VITE_PRELOAD_RELOAD_KEY, String(now));

  const url = new URL(window.location.href);
  url.searchParams.set("_reload", String(now));
  window.location.replace(url.toString());
});

window.setTimeout(() => {
  window.sessionStorage.removeItem(VITE_PRELOAD_RELOAD_KEY);
}, VITE_PRELOAD_RELOAD_WINDOW_MS);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
