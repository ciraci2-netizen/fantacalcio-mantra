"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/auth";

export default function ProfileClient({
  username,
  teamName,
}: {
  username: string;
  teamName: string;
}) {
  const [state, action, pending] = useActionState(changePassword, null);

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Il mio profilo</h1>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-green-600 flex items-center justify-center text-white text-xl font-bold">
            {teamName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800">{teamName}</p>
            <p className="text-gray-400 text-sm">@{username}</p>
          </div>
        </div>

        <hr className="mb-6" />

        <h2 className="font-semibold text-gray-700 mb-4">Cambia password</h2>
        <form action={action} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password attuale
            </label>
            <input
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nuova password <span className="text-gray-400 font-normal">(min. 6 caratteri)</span>
            </label>
            <input
              type="password"
              name="newPassword"
              required
              minLength={6}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conferma nuova password
            </label>
            <input
              type="password"
              name="confirmPassword"
              required
              autoComplete="new-password"
              className={inputCls}
            />
          </div>

          {state && state !== "success" && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
              {state}
            </div>
          )}
          {state === "success" && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm font-medium">
              ✓ Password aggiornata con successo!
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {pending ? "Aggiornamento…" : "Aggiorna password"}
          </button>
        </form>
      </div>
    </div>
  );
}
