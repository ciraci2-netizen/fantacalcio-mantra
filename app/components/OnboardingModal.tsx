"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const STEPS = [
  {
    icon: "👥",
    title: "La tua rosa",
    body: "Nella sezione Rosa trovi tutti i giocatori che hai acquistato all'asta. Puoi filtrarli per ruolo e ordinarli per prezzo.",
    cta: { href: "/team", label: "Vai alla rosa →" },
  },
  {
    icon: "📋",
    title: "Invia la formazione",
    body: "Prima di ogni giornata devi inviare la tua formazione con 11 titolari e fino a 11 riserve. Controlla la deadline!",
    cta: { href: "/lineup", label: "Componi la formazione →" },
  },
  {
    icon: "📅",
    title: "Segui i risultati",
    body: "Dopo l'importazione dei voti, i risultati appaiono nel Calendario. Clicca su una partita per vedere le formazioni nel dettaglio.",
    cta: { href: "/calendar", label: "Apri il calendario →" },
  },
];

const KEY = "ipa-onboarding-done";

export default function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {}
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch {}
    setShow(false);
  };

  if (!show) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Progress bar */}
        <div className="flex h-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 transition-colors ${i <= step ? "bg-green-500" : "bg-gray-200"}`}
            />
          ))}
        </div>

        <div className="p-6 text-center space-y-4">
          <div className="text-5xl">{current.icon}</div>
          <h2 className="text-xl font-bold text-gray-800">{current.title}</h2>
          <p className="text-gray-500 text-sm leading-relaxed">{current.body}</p>

          <Link
            href={current.cta.href}
            onClick={dismiss}
            className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            {current.cta.label}
          </Link>

          <div className="flex items-center justify-between pt-1">
            <button onClick={dismiss} className="text-xs text-gray-400 hover:text-gray-600">
              Salta intro
            </button>
            {!isLast && (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="text-xs font-semibold text-green-600 hover:text-green-700"
              >
                Avanti →
              </button>
            )}
            {isLast && (
              <button onClick={dismiss} className="text-xs font-semibold text-green-600">
                Inizia! 🎉
              </button>
            )}
          </div>
          <p className="text-xs text-gray-300">{step + 1} / {STEPS.length}</p>
        </div>
      </div>
    </div>
  );
}
