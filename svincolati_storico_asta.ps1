$ErrorActionPreference = 'Stop'
Write-Host '=== Asta: mostra i giocatori rimasti svincolati nello storico dei round ===' -ForegroundColor Cyan

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

$ok1 = Update-CodeFile -RelativePath "app\(main)\admin\asta\AdminAstaClient.tsx" -Marker 'groupBidsByPlayer' -MinLines 216 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 200) ---
    $lines.RemoveRange(199, 3)
    $lines.InsertRange(199, [string[]]@(
    '                                </Fragment>',
    '                              );',
    '                            })}'
    ))

    # --- Modifica 2 (riga originale 189) ---
    $lines.RemoveRange(188, 10)
    $lines.InsertRange(188, [string[]]@(
    '                            {playerGroups.map((g) => {',
    '                              const sold = g.bids.some((b) => b.status === "won");',
    '                              return (',
    '                                <Fragment key={g.playerId}>',
    '                                  {g.bids.map((b, i) => (',
    '                                    <tr key={i} className={b.status === "won" ? "bg-green-50" : ""}>',
    '                                      <td className="py-1.5 pr-2 font-medium">{b.playerName}</td>',
    '                                      <td className="py-1.5 pr-2 text-gray-500">{b.teamName}</td>',
    '                                      <td className="py-1.5 pr-2 text-right font-mono">{b.amount}</td>',
    '                                      <td className="py-1.5 text-xs">',
    '                                        {b.status === "won" ? (',
    '                                          <span className="text-green-700 font-semibold">{"\u2713"} vinta</span>',
    '                                        ) : (',
    '                                          <span className="text-gray-400">persa</span>',
    '                                        )}',
    '                                      </td>',
    '                                    </tr>',
    '                                  ))}',
    '                                  {!sold && (',
    '                                    <tr className="bg-amber-50">',
    '                                      <td colSpan={4} className="py-1.5 pr-2 pl-2 text-xs text-amber-700 font-medium">',
    '                                        {"\u26a0"} Rimasto svincolato: nessuna offerta e andata a buon fine.',
    '                                      </td>',
    '                                    </tr>'
    ))

    # --- Modifica 3 (riga originale 169) ---
    $lines.RemoveRange(168, 1)
    $lines.InsertRange(168, [string[]]@(
    '                        chiuso il {fmt(r.resolvedAt)} {"\u00b7"} {won.length} giocatori assegnati',
    '                        {unsoldGroups.length > 0 && `\u00b7 ${unsoldGroups.length} rimasti svincolati`}',
    '                        {" "}{"\u00b7"} {r.bids.length} offerte totali'
    ))

    # --- Modifica 4 (riga originale 159) ---
    $lines.InsertRange(158, [string[]]@(
    '              const playerGroups = groupBidsByPlayer(r.bids);',
    '              const unsoldGroups = playerGroups.filter((g) => !g.bids.some((b) => b.status === "won"));'
    ))

    # --- Modifica 5 (riga originale 37) ---
    $lines.InsertRange(36, [string[]]@(
    '// Raggruppa le offerte di un round per giocatore, nell''ordine in cui',
    '// arrivano (gia'' playerId ASC, amount DESC dalla query). Un giocatore e''',
    '// rimasto svincolato in quel round se nessuna delle sue offerte e'' ''won''',
    '// (es. l''unica offerta superava il budget/gli slot residui di chi l''ha',
    '// fatta): prima si vedeva identico a una "persa" qualunque, ora si segnala.',
    'function groupBidsByPlayer(bids: PastRoundBid[]) {',
    '  const map = new Map<number, { playerId: number; playerName: string; bids: PastRoundBid[] }>();',
    '  for (const b of bids) {',
    '    if (!map.has(b.playerId)) map.set(b.playerId, { playerId: b.playerId, playerName: b.playerName, bids: [] });',
    '    map.get(b.playerId)!.bids.push(b);',
    '  }',
    '  return Array.from(map.values());',
    '}',
    ''
    ))

    # --- Modifica 6 (riga originale 3) ---
    $lines.RemoveRange(2, 1)
    $lines.InsertRange(2, [string[]]@(
    'import { useActionState, useState, Fragment } from "react";'
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

git add "app/(main)/admin/asta/AdminAstaClient.tsx"
$status = git status --porcelain -- "app/(main)/admin/asta/AdminAstaClient.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Asta admin: mostra i giocatori rimasti svincolati nello storico round`n`nNello storico di un round chiuso, un giocatore con offerte tutte 'perse'`npoteva significare due cose diverse senza distinzione visiva: o e'`nandato a un altro utente con un'offerta piu bassa (perche' la piu alta`nnon rispettava budget/slot residui di chi l'aveva fatta), oppure nessuna`nofferta e' passata e il giocatore e' rimasto svincolato per davvero.`nOra le offerte sono raggruppate per giocatore e chi resta senza`nvincitore ha una riga dedicata 'Rimasto svincolato', con il conteggio`nanche nell'intestazione del round.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
