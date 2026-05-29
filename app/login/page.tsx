"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background: banner fisso */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/league-banner.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      {/* Overlay scuro */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Card login — glassmorphism */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/league-banner.png"
            alt="IPA Premier League"
            className="w-24 h-24 rounded-2xl object-cover object-center mx-auto mb-4 shadow-2xl border-2 border-white/20"
          />
          <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow">IPA</h1>
          <p className="text-white/70 text-sm mt-1 font-medium">Fantasy Football Premier League</p>
        </div>

        {/* Form card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-7">
          <form action={action} className="flex flex-col gap-4">
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-white/90 mb-1.5">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/25 transition"
                placeholder="il_tuo_username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-white/90 mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/25 transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-400/40 text-red-200 rounded-xl px-4 py-2.5 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors shadow-lg mt-1 text-sm tracking-wide"
            >
              {pending ? "Accesso in corso…" : "Accedi →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
