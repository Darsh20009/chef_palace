import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyBrandColors } from "./lib/brand";

// ── One-time global storage wipe ──────────────────────────────────────────
// Bump CLIENT_RESET_VERSION to force every device that opens the app to clear
// its cookies, localStorage, sessionStorage, IndexedDB, caches and service
// workers exactly once. The flag itself is preserved so it only runs once
// per device per version.
const CLIENT_RESET_VERSION = "2026-04-21-v2-logo";
(function maybeWipeClientStorage() {
  try {
    const KEY = "__qirox_reset_version";
    if (localStorage.getItem(KEY) === CLIENT_RESET_VERSION) return;

    // 1) Cookies for this origin (all paths/domains we can reach)
    try {
      const host = window.location.hostname;
      const domains = ["", host, "." + host];
      const paths = ["/", window.location.pathname];
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0].trim();
        if (!name) return;
        domains.forEach((d) => {
          paths.forEach((p) => {
            document.cookie =
              name +
              "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=" +
              p +
              (d ? "; domain=" + d : "");
          });
        });
      });
    } catch {}

    // 2) Web storage
    try { sessionStorage.clear(); } catch {}
    try { localStorage.clear(); } catch {}

    // 3) IndexedDB
    try {
      const idb: any = (indexedDB as any);
      if (idb && typeof idb.databases === "function") {
        idb.databases().then((dbs: any[]) => {
          (dbs || []).forEach((db) => {
            if (db && db.name) indexedDB.deleteDatabase(db.name);
          });
        }).catch(() => {});
      }
    } catch {}

    // 4) Cache Storage (PWA caches)
    try {
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
      }
    } catch {}

    // 5) Service Workers
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.forEach((r) => r.unregister()))
          .catch(() => {});
      }
    } catch {}

    // Mark this version as wiped so we don't loop on every load
    try { localStorage.setItem(KEY, CLIENT_RESET_VERSION); } catch {}
  } catch {}
})();

// Apply brand colors from the central brand config to CSS variables
applyBrandColors();


createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => {});
}

// Register Service Worker for PWA
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Capture whether a SW was already controlling this page BEFORE we register.
  // If null → first install (no reload needed).
  // If non-null → there was an old SW → any controller change means a real update.
  const hadController = !!navigator.serviceWorker.controller;

  navigator.serviceWorker.register('/sw.js').then((registration) => {
    console.log('ServiceWorker registration successful');

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          // Only show "update available" banner if this is a real update
          // (an old SW was already running), not a first-time install.
          if (
            newWorker.state === 'activated' &&
            navigator.serviceWorker.controller &&
            hadController
          ) {
            window.dispatchEvent(new CustomEvent('sw-update-available'));
          }
        });
      }
    });

    // Check for SW updates every 30 minutes
    setInterval(() => {
      registration.update();
    }, 30 * 60 * 1000);
  }).catch(registrationError => {
    console.log('SW registration failed: ', registrationError);
  });

  // Auto-reload when a new service worker takes control — but ONLY
  // if there was already a controller before (i.e. a real update, not first install).
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloading && hadController) {
      reloading = true;
      window.location.reload();
    }
  });
}
