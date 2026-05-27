"use client";

import { useActionState, useRef, useState } from "react";
import { setTeamLogo } from "@/app/actions/settings";

/**
 * Componente client per caricare/rimuovere il logo di una squadra.
 * Comprime l'immagine a max 200×200px prima di inviarla come base64.
 */
export default function LogoUploader({
  userId,
  teamName,
  currentLogoUrl,
}: {
  userId: number;
  teamName: string;
  currentLogoUrl?: string | null;
}) {
  const [result, action, pending] = useActionState(setTeamLogo, null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl ?? null);
  const [logoData, setLogoData] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      // Comprimi con canvas → max 200×200
      const img = new window.Image();
      img.onload = () => {
        const MAX = 200;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/webp", 0.85);
        setPreview(compressed);
        setLogoData(compressed);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }

  function handleRemove() {
    setPreview(null);
    setLogoData("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex items-center gap-3">
      {/* Anteprima */}
      <div className="w-10 h-10 rounded-full border-2 border-gray-200 overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={teamName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-gray-300 text-xs font-bold">
            {teamName.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <form ref={formRef} action={action} className="flex items-center gap-2 flex-wrap">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="logoData" value={logoData} />

        <label className="cursor-pointer text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
          📁 Carica
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </label>

        {preview && (
          <>
            <button
              type="submit"
              disabled={pending || !logoData}
              className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-lg font-medium"
            >
              {pending ? "..." : "Salva"}
            </button>
            <button
              type="button"
              onClick={() => {
                handleRemove();
                // Invia formData con logoData vuoto per rimuovere
                const fd = new FormData();
                fd.set("userId", String(userId));
                fd.set("logoData", "");
                formRef.current?.requestSubmit();
              }}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Rimuovi
            </button>
          </>
        )}
      </form>

      {result && <span className="text-xs text-red-600">{result}</span>}
    </div>
  );
}
