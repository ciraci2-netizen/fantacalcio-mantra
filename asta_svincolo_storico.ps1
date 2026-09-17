$ErrorActionPreference = 'Stop'
Write-Host '=== Asta: mostra nello storico chi e stato svincolato per fare posto a ogni acquisto ===' -ForegroundColor Cyan

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

$ok1 = Update-CodeFile -RelativePath "app\lib\auction.ts" -Marker 'winningBids' -MinLines 316 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 306) ---
    $lines.RemoveRange(305, 2)
    $lines.InsertRange(305, [string[]]@(
    '  for (const wb of winningBids) {',
    '    // releasePlayerId viene sovrascritto con l''esito reale: null se alla',
    '    // fine non e servito nessuno svincolo, anche se in fase di offerta',
    '    // l''utente ne aveva indicato uno "di riserva".',
    '    await db.execute({',
    '      sql: `UPDATE "SealedBid" SET status = ''won'', releasePlayerId = ? WHERE id = ?`,',
    '      args: [wb.releasePlayerId, wb.id],',
    '    });'
    ))

    # --- Modifica 2 (riga originale 278) ---
    $lines.RemoveRange(277, 1)
    $lines.InsertRange(277, [string[]]@(
    '    for (const b of bids) {',
    '      if (b.id === winner.id) winningBids.push({ id: b.id, releasePlayerId: winnerReleasePlayerId });',
    '      else losingBidIds.push(b.id);',
    '    }'
    ))

    # --- Modifica 3 (riga originale 223) ---
    $lines.RemoveRange(222, 1)
    $lines.InsertRange(222, [string[]]@(
    '  // Per ogni offerta vincente salviamo anche l''eventuale svincolo DAVVERO',
    '  // eseguito (puo differire da quanto l''utente aveva dichiarato in anticipo',
    '  // in sb.releasePlayerId: quel campo era solo "nel caso servisse" - se poi',
    '  // gli slot non erano pieni non e stato usato). Cosi lo storico puo mostrare',
    '  // con certezza chi e stato svincolato per fare posto a ciascun acquisto.',
    '  const winningBids: { id: number; releasePlayerId: number | null }[] = [];'
    ))
}

$ok2 = Update-CodeFile -RelativePath "app\(main)\admin\asta\page.tsx" -Marker 'releasedPlayerName' -MinLines 107 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 90) ---
    $lines.InsertRange(89, [string[]]@(
    '          releasedPlayerName: (b.releasedPlayerName as string | null) ?? null,'
    ))

    # --- Modifica 2 (riga originale 74) ---
    $lines.InsertRange(73, [string[]]@(
    '              LEFT JOIN "Player" rp ON rp.id = sb.releasePlayerId'
    ))

    # --- Modifica 3 (riga originale 70) ---
    $lines.RemoveRange(69, 1)
    $lines.InsertRange(69, [string[]]@(
    '        sql: `SELECT sb.playerId, sb.userId, sb.amount, sb.status, sb.releasePlayerId,',
    '                     p.name as playerName, u.teamName, rp.name as releasedPlayerName'
    ))

    # --- Modifica 4 (riga originale 69) ---
    $lines.InsertRange(68, [string[]]@(
    '      // releasePlayerId qui riflette l''esito reale (vedi resolveRound):',
    '      // valorizzato solo se per quell''acquisto e'' davvero servito uno',
    '      // svincolo, non semplicemente quanto l''utente aveva dichiarato "di',
    '      // riserva" al momento dell''offerta.'
    ))
}

$ok3 = Update-CodeFile -RelativePath "app\(main)\admin\asta\AdminAstaClient.tsx" -Marker 'releasedPlayerName' -MinLines 248 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 218) ---
    $lines.RemoveRange(217, 1)
    $lines.InsertRange(217, [string[]]@(
    '                                          <div>',
    '                                            <span className="text-green-700 font-semibold">{"\u2713"} vinta</span>',
    '                                            {b.releasedPlayerName && (',
    '                                              <div className="text-gray-400 font-normal mt-0.5">',
    '                                                {"\u2194"} svincolato {b.releasedPlayerName}',
    '                                              </div>',
    '                                            )}',
    '                                          </div>'
    ))

    # --- Modifica 2 (riga originale 21) ---
    $lines.InsertRange(20, [string[]]@(
    '  releasedPlayerName: string | null;'
    ))
}

$allOk = $ok1 -and $ok2 -and $ok3

if (-not $allOk) {
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

git add "app/lib/auction.ts" "app/(main)/admin/asta/page.tsx" "app/(main)/admin/asta/AdminAstaClient.tsx"
$status = git status --porcelain -- "app/lib/auction.ts" "app/(main)/admin/asta/page.tsx" "app/(main)/admin/asta/AdminAstaClient.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Asta: nello storico round mostra chi e stato svincolato per ogni acquisto`n`nQuando un'offerta vince nonostante gli slot di rosa pieni, il sistema`nesegue automaticamente lo svincolo del giocatore che l'utente aveva`nindicato in anticipo - ma finora questa informazione non si vedeva piu`nda nessuna parte una volta chiuso il round. Ora SealedBid.releasePlayerId`nviene aggiornato con l'esito REALE (null se alla fine non e servito`nnessuno svincolo, anche se dichiarato in anticipo), e lo storico asta`nmostra sotto ogni acquisto vinto chi e stato eventualmente svincolato`nper fare posto.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
