"use client";

import { useActionState, useRef, useEffect } from "react";
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
    return <img src={logoUrl} alt={teamName} className="w-9 h-9 rounded-full object-cover border-2 border-green-300 shrink-0" />;
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

export default function BachecaClient({
  messages,
  currentUserId,
  isAdmin,
  seasonName,
}: {
  messages: Message[];
  currentUserId: number;
  isAdmin: boolean;
  seasonName: string;
}) {
  const [postError, postAction, postPending] = useActionState(postMessage, null);
  const [, deleteAction] = useActionState(deleteMessage, null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clear textarea after successful post
  useEffect(() => {
    if (!postPending && !postError && textareaRef.current) {
      textareaRef.current.value = "";
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
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          {postError && (
            <p className="text-red-600 text-sm">{postError}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Max 500 caratteri</span>
            <button
              type="submit"
              disabled={postPending}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {postPending ? "Invio..." : "📨 Pubblica"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Messages ────────────────────────────────────────── */}
      {messages.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-gray-500">Nessun messaggio ancora.</p>
          <p className="text-gray-400 text-sm mt-1">
            Sii il primo a scrivere nella bacheca!
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
