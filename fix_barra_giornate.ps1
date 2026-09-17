$ErrorActionPreference = 'Stop'
Write-Host '=== Calendario: barra giornate scorrevole con frecce (36 giornate non entravano tutte a schermo) ===' -ForegroundColor Cyan

function Update-CodeFile {
    param(
        [string]$RelativePath,
        [string]$Marker,
        [int]$MinLines,
        [scriptblock]$ApplyEdits
    )

    $target = Join-Path (Get-Location).Path $RelativePath

    if (-not (Test-Path -LiteralPath $target)) {
        Write-Host "ERRORE: non trovo $RelativePath - esegui questo script dalla cartella principale del repo (fantacalcio-mantra)." -ForegroundColor Red
        return $false
    }

    $bytes = [System.IO.File]::ReadAllBytes($target)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)

    if ($text -match [regex]::Escape($Marker)) {
        Write-Host "Il file $RelativePath sembra gia contenere questa modifica. Non faccio nulla." -ForegroundColor Yellow
        return $true
    }

    $lines = New-Object System.Collections.Generic.List[string]
    $lines.AddRange([string[]]($text -split "`r`n|`n"))

    if ($lines.Count -lt $MinLines) {
        Write-Host "ERRORE: $RelativePath ha meno righe del previsto. La cartella potrebbe non essere allineata alla versione piu recente (esegui: git pull) oppure il file e stato modificato a mano." -ForegroundColor Red
        return $false
    }

    & $ApplyEdits $lines

    $newText = [string]::Join("`r`n", $lines)
    [System.IO.File]::WriteAllText($target, $newText, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "File aggiornato: $RelativePath" -ForegroundColor Green
    return $true
}

$ok1 = Update-CodeFile -RelativePath "app\(main)\calendar\CalendarClient.tsx" -Marker 'pillsRef' -MinLines 252 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 199) ---
    $lines.RemoveRange(198, 19)
    $lines.InsertRange(198, [string[]]@(
    '      <div className="flex items-center gap-1">',
    '        <button',
    '          type="button"',
    '          onClick={() => pillsRef.current?.scrollBy({ left: -160, behavior: "smooth" })}',
    '          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white border text-gray-500 text-sm shadow-sm hover:bg-gray-50"',
    '          aria-label="Scorri indietro"',
    '        >',
    '          {"\u2039"}',
    '        </button>',
    '        <div ref={pillsRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth">',
    '          {matchdays.map((m, idx) => {',
    '            const hasPlayed = m.matches.some((mm) => mm.homeScore !== null);',
    '            return (',
    '              <button',
    '                key={m.id}',
    '                onClick={() => go(idx)}',
    '                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${',
    '                  idx === activeIdx',
    '                    ? "bg-green-600 text-white shadow-sm"',
    '                    : hasPlayed',
    '                    ? "bg-gray-100 text-gray-500 hover:bg-gray-200"',
    '                    : "bg-blue-50 text-blue-600 hover:bg-blue-100"',
    '                }`}',
    '              >',
    '                G{m.number}',
    '              </button>',
    '            );',
    '          })}',
    '        </div>',
    '        <button',
    '          type="button"',
    '          onClick={() => pillsRef.current?.scrollBy({ left: 160, behavior: "smooth" })}',
    '          className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-white border text-gray-500 text-sm shadow-sm hover:bg-gray-50"',
    '          aria-label="Scorri avanti"',
    '        >',
    '          {"\u203a"}',
    '        </button>'
    ))

    # --- Modifica 2 (riga originale 166) ---
    $lines.InsertRange(165, [string[]]@(
    '  const pillsRef = useRef<HTMLDivElement>(null);',
    '',
    '  // Tiene la pillola della giornata attiva visibile scorrendo la barra in',
    '  // automatico (con 36 giornate la barra non entra tutta e senza questo la',
    '  // selezione poteva "sparire" fuori dallo schermo senza nessun indizio).',
    '  useEffect(() => {',
    '    const container = pillsRef.current;',
    '    if (!container) return;',
    '    const activeBtn = container.children[activeIdx] as HTMLElement | undefined;',
    '    if (activeBtn) {',
    '      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });',
    '    }',
    '  }, [activeIdx]);'
    ))

    # --- Modifica 3 (riga originale 3) ---
    $lines.RemoveRange(2, 1)
    $lines.InsertRange(2, [string[]]@(
    'import { useState, useRef, useEffect } from "react";'
    ))
}

if (-not $ok1) {
    Write-Host ''
    Write-Host 'Qualcosa non e andato a buon fine sopra: correggi prima di continuare (niente e stato committato).' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Verifico che il progetto compili (tsc)...' -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ATTENZIONE: tsc ha segnalato errori. Controlla sopra prima di continuare.' -ForegroundColor Red
    Write-Host 'Se gli errori riguardano SOLO app/generated/prisma (modulo mancante), sono preesistenti e legati a questo ambiente locale: puoi ignorarli e continuare.' -ForegroundColor Yellow
}

git add "app/(main)/calendar/CalendarClient.tsx"
$status = git status --porcelain -- "app/(main)/calendar/CalendarClient.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Calendario: barra delle giornate scorrevole con frecce avanti/indietro`n`nCon 36 giornate la barra dei pulsanti G1..G36 non entrava tutta a`nschermo e scorreva senza nessun indizio visivo, dando l'impressione`nche esistessero solo 25 giornate. Ora ci sono due freccette per`nscorrere la barra e la giornata selezionata si porta sempre in vista`nda sola quando cambi pagina con i pulsanti Prec/Succ.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
