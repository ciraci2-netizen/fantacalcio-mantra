"use client";

import { useState, useEffect } from "react";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("ipa-theme");
    if (saved) {
      // Usa preferenza salvata
      const isDark = saved === "dark";
      setDark(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    } else {
      // Prima visita: rispetta impostazione OS
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(prefersDark);
      document.documentElement.classList.toggle("dark", prefersDark);
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ipa-theme", next ? "dark" : "light");
    } catch {}
  };

  if (!mounted) return <div className="w-8 h-8" />;

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Passa a tema chiaro" : "Passa a tema scuro"}
      title={dark ? "Tema chiaro" : "Tema scuro"}
      className={`w-8 h-8 rounded-full flex items-center justify-center text-base hover:bg-green-600 transition-colors ${className}`}
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
