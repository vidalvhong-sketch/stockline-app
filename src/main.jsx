import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      // Actively check for a new service worker on every load, rather than
      // waiting for the browser's own (slower, throttled) update check.
      reg.update().catch(() => {});
    }).catch(() => {
      // Non-fatal: app still works fully online without the service worker.
    });
  });

  // If a new service worker takes control while the app is open, reload
  // once automatically so the fresh app shell loads right away instead of
  // needing a manual refresh.
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}
