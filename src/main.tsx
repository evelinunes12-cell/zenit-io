/* cache-bust-v2 */
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

const CHUNK_RELOAD_TIMESTAMP_KEY = "chunk-reload-ts";
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

const isDynamicImportFailure = (message: string) => {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("failed to fetch dynamically imported module") ||
    normalizedMessage.includes("error loading dynamically imported module") ||
    normalizedMessage.includes("importing a module script failed")
  );
};

const getErrorMessage = (reason: unknown) => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  if (
    typeof reason === "object" &&
    reason !== null &&
    "message" in reason &&
    typeof reason.message === "string"
  ) {
    return reason.message;
  }

  return "";
};

const reloadForStaleChunk = () => {
  const lastReloadAt = Number(sessionStorage.getItem(CHUNK_RELOAD_TIMESTAMP_KEY) ?? "0");

  if (Date.now() - lastReloadAt < CHUNK_RELOAD_COOLDOWN_MS) {
    return false;
  }

  sessionStorage.setItem(CHUNK_RELOAD_TIMESTAMP_KEY, String(Date.now()));
  window.location.reload();
  return true;
};

const handleChunkLoadFailure = (reason: unknown) => {
  const message = getErrorMessage(reason);

  if (!isDynamicImportFailure(message)) {
    return false;
  }

  return reloadForStaleChunk();
};

// PWA: prevent service worker from interfering in iframe/preview contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

window.addEventListener("error", (event) => {
  handleChunkLoadFailure(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  if (handleChunkLoadFailure(event.reason)) {
    event.preventDefault();
  }
});

window.addEventListener(
  "vite:preloadError",
  ((event: Event & { payload?: unknown }) => {
    if (handleChunkLoadFailure(event.payload)) {
      event.preventDefault();
    }
  }) as EventListener,
);

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);
