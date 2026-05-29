"use client";

import { useActionState, useRef, useEffect } from "react";
import Link from "next/link";
import { postMessage, deleteMessage } from "@/app/actions/bacheca";

interface Message {
  id: number;
  userId: number;
  teamName: string;
  logoUrl: string | null;
  content: string;
  createdAt: string;
}

function Avatar({ teamName, logoUrl }: { teamName: string; logoUrl: string | null }) {
  const initials = teamName.slice(0, 2).toUpperCase();
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt={teamName}
        className="w-9 h-9 rounded-full object-cover border-2 border-green-300 shrink-0"
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold border-2 border-green-300 shrink-0">
      {initials}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleString("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
      {/* Illustrated SVG empty state */}
      <svg
        className="w-24 h-24 mx-auto mb-4 text-gray-200"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="60" cy="60" r="56" fill="#f3f4f6" />
        <rect x="28" y="38" width="64" height="44" rx="8" fill="#e5e7eb" />
        <rect x="36" y="52" width="36" height="4" rx="2" fill="#d1d5db" />
        <rect x="36" y="62" width="24" height="4" rx="2" fill="#d1d5db" />
        <circle cx="84" cy="76" r="14" fill="#16a34a" />
        <path d="M78 76l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p className="text-gray-600 font-semibold text-base">Nessun messaggio ancora.</p>
      <p className="text-gray-400 text-sm mt-1">
        Sii il primo a scrivere nella bacheca di lega! 🎉
      </p>
    </div>
  );
}

export default function BachecaClient({
  messages,
  currentUserId,
  isAdmin,
  seasonName,
  page,
  hasMore,
}: {
  messages: Message[];
  currentUserId: number;
  isAdmin: boolean;
  seasonName: string;
  page: number;
  hasMore: boolean;
}) {
  const [postError, postAction, postPending] = useActionState(postMessage, null);
  const [, deleteAction] = useActionState(deleteMessage, null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const charCountRef = useRef<HTMLSpanElement>(null);

  // Clear textarea after successful post
  useEffect(() => {
    if (!postPending && !postError && textareaRef.current) {
      textareaRef.current.value = "";
      if (charCountRef.current) charCountRef.current.textContent = "0";
    }
  }, [postPending, postError]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-800">💬 Bacheca di lega</h1>
        {seasonName && (
          <span className="text-sm text-gray-500">
            Stagione <strong>{seasonName}</strong>
          </span>
        )}
      </div>

      {/* ── Compose message ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <form action={postAction} className="space-y-3">
          <textarea
            ref={textareaRef}
            name="content"
            placeholder="Scrivi un messaggio alla lega... 😄"
            maxLength={500}
            rows={3}
            onChange={(e) => {
              if (charCountRef.current)
                charCountRef.current.textContent = String(e.target.value.length);
            }}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          {postError && (
            <p className="text-red-600 text-sm">{postError}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              <span ref={charCountRef}>0</span>/500 caratteri
            </span>
            <button
              type="submit"
              disabled={postPending}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {postPending ? "Invio..." : "📨 Pubblica"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Messages ────────────────────────────────────────── */}
      {messages.length === 0 && page === 1 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOwn = msg.userId === currentUserId;
              const canDelete = isOwn || isAdmin;

              return (
                <div
                  key={msg.id}
                  className={`bg-white rounded-xl border shadow-sm p-4 ${
                    isOwn ? "border-l-4 border-l-green-400" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar teamName={msg.teamName} logoUrl={msg.logoUrl} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-800">
                          {msg.teamName}
                          {isOwn && (
                            <span className="ml-1.5 text-xs text-green-600 font-normal">
                              (tu)
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">
                            {formatDate(msg.createdAt)}
                          </span>
                          {canDelete && (
                            <form action={deleteAction}>
                              <input type="hidden" name="messageId" value={msg.id} />
                              <button
                                type="submit"
                                className="text-xs text-red-400 hover:text-red-600 hover:underline"
                              >
                                Elimina
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            {page > 1 ? (
              <Link
                href={`/bacheca?page=${page - 1}`}
                className="text-sm text-green-600 hover:underline font-medium"
              >
                ← Più recenti
              </Link>
            ) : (
              <div />
            )}
            {hasMore && (
              <Link
                href={`/bacheca?page=${page + 1}`}
                className="text-sm text-gray-500 hover:text-gray-700 hover:underline font-medium"
              >
                Carica più vecchi →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
