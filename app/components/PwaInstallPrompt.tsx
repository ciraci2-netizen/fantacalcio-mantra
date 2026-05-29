"use client";

import { useEffect, useState } from "react";

const VISIT_KEY = "ipa-visit-count";
const DISMISSED_KEY = "ipa-pwa-dismissed";
const MIN_VISITS = 3;

export default function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> } | null>(null);

  useEffect(() => {
    // Non mostrare se già in modalità standalone (PWA installata)
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Non mostrare se già dismissato
    if (localStorage.getItem(DISMISSED_KEY)) return;

    // Incrementa contatore visite
    const visits = parseInt(localStorage.getItem(VISIT_KEY) ?? "0") + 1;
    localStorage.setItem(VISIT_KEY, String(visits));

    // Cattura beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as typeof deferredPrompt);
      if (visits >= MIN_VISITS) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      localStorage.setItem(DISMISSED_KEY, "1");
    }
    setShow(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/league-banner.png"
          alt="IPA"
          className="w-12 h-12 rounded-xl object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-sm">Installa IPA Fantasy</p>
          <p className="text-gray-500 text-xs mt-0.5 leading-snug">
            Aggiungila alla home screen per accedervi più velocemente
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={install}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
            >
              Installa
            </button>
            <button
              onClick={dismiss}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 transition-colors"
            >
              No grazie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
