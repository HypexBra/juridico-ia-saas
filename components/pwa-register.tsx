"use client";

import { useEffect } from "react";

/** Registra o service worker (public/sw.js) — silencioso em navegadores sem suporte ou em dev sem HTTPS. */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((erro) => {
      console.error("[pwa] Falha ao registrar service worker:", erro);
    });
  }, []);

  return null;
}
