$ErrorActionPreference = 'Stop'
Write-Host '=== Fix: Azzera giornata ora sblocca + riapre la giornata corrente, rimosso il blocco/avanzamento automatico settimanale ===' -ForegroundColor Cyan

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

$ok1 = Update-CodeFile -RelativePath "app\actions\votes.ts" -Marker 'Sblocca la giornata e cancella la sua scadenza' -MinLines 318 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 180) ---
    $lines.RemoveRange(179, 1)
    $lines.InsertRange(179, [string[]]@(
    '  return `AZZERATA: Giornata ${matchdayNumber} riportata a "non calcolata" e riaperta (sbloccata, senza scadenza) - voti, risultati e formazioni automatiche rimossi, ed e'' di nuovo la giornata corrente per schierare. Le formazioni inviate a mano restano, solo il punteggio e stato azzerato.`;'
    ))

    # --- Modifica 2 (riga originale 175) ---
    $lines.InsertRange(174, [string[]]@(
    '  revalidatePath("/admin/schedule");'
    ))

    # --- Modifica 3 (riga originale 174) ---
    $lines.InsertRange(173, [string[]]@(
    '  // Sblocca la giornata e cancella la sua scadenza: se restasse bloccata e',
    '  // con una scadenza nel passato, il cron automatico (auto-lock) la',
    '  // ribloccherebbe da solo al giro successivo, generando di nuovo',
    '  // formazioni automatiche al posto di chi non ha ancora schierato.',
    '  await db.execute({ sql: `UPDATE "Matchday" SET isLocked = 0 WHERE id = ?`, args: [matchdayId] });',
    '  try {',
    '    await db.execute({ sql: `UPDATE "Matchday" SET deadline = NULL WHERE id = ?`, args: [matchdayId] });',
    '  } catch { /* colonna deadline non ancora migrata: ignora */ }',
    '',
    '  // Riporta indietro il puntatore "giornata corrente" della stagione, ma',
    '  // SOLO se nel frattempo era gia'' avanzato oltre questa giornata - altrimenti',
    '  // il sito continuerebbe a proporre a tutti la formazione della giornata',
    '  // successiva, lasciando questa azzerata irraggiungibile dal menu normale.',
    '  await db.execute({',
    '    sql: `UPDATE "Season" SET currentMatchday = ? WHERE id = ? AND currentMatchday > ?`,',
    '    args: [matchdayNumber, seasonId, matchdayNumber],',
    '  });',
    ''
    ))

    # --- Modifica 4 (riga originale 148) ---
    $lines.InsertRange(147, [string[]]@(
    '  const seasonId = check.rows[0].seasonId as number;'
    ))

    # --- Modifica 5 (riga originale 145) ---
    $lines.RemoveRange(144, 1)
    $lines.InsertRange(144, [string[]]@(
    '  const check = await db.execute({ sql: `SELECT number, seasonId FROM "Matchday" WHERE id = ?`, args: [matchdayId] });'
    ))
}

$ok2 = Update-CodeFile -RelativePath "app\(main)\admin\votes\VotesAdminClient.tsx" -Marker 'selectedMatchday.votesImported || selectedMatchday.isLocked' -MinLines 729 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 471) ---
    $lines.RemoveRange(470, 1)
    $lines.InsertRange(470, [string[]]@(
    '                    if (!confirm(`Azzerare la Giornata ${selectedMatchday.number}? Voti importati, risultati e classifica di questa giornata verranno rimossi (le formazioni inviate a mano restano, solo il punteggio si azzera), la giornata viene sbloccata e ridiventa quella corrente per schierare. Potrai reimportare/ricalcolare da capo.`)) {'
    ))

    # --- Modifica 2 (riga originale 467) ---
    $lines.RemoveRange(466, 1)
    $lines.InsertRange(466, [string[]]@(
    '              {(selectedMatchday.votesImported || selectedMatchday.isLocked) && ('
    ))
}

# vercel.json: rimozione pura (il cron lock-matchday) - la logica del
# Marker di Update-CodeFile e' al contrario per una rimozione (marker
# presente = non ancora rimosso), quindi qui uso un blocco dedicato.
$target3 = Join-Path (Get-Location).Path "vercel.json"
$ok3 = $true
if (-not (Test-Path -LiteralPath $target3)) {
    Write-Host "ERRORE: non trovo vercel.json - esegui questo script dalla cartella principale del repo (fantacalcio-mantra)." -ForegroundColor Red
    $ok3 = $false
} else {
    $bytes3 = [System.IO.File]::ReadAllBytes($target3)
    $text3 = [System.Text.Encoding]::UTF8.GetString($bytes3)

    if ($text3 -notmatch [regex]::Escape('cron/lock-matchday')) {
        Write-Host "Il file vercel.json sembra gia senza il cron lock-matchday. Non faccio nulla." -ForegroundColor Yellow
    } else {
        $lines3 = New-Object System.Collections.Generic.List[string]
        $lines3.AddRange([string[]]($text3 -split "`r`n|`n"))

        if ($lines3.Count -lt 12) {
            Write-Host "ERRORE: vercel.json ha meno righe del previsto. La cartella potrebbe non essere allineata alla versione piu recente (esegui: git pull) oppure il file e stato modificato a mano." -ForegroundColor Red
            $ok3 = $false
        } else {
    # --- Modifica 1 (riga originale 6) ---
    $lines3.RemoveRange(5, 4)
            $newText3 = [string]::Join("`r`n", $lines3)
            [System.IO.File]::WriteAllText($target3, $newText3, (New-Object System.Text.UTF8Encoding($false)))
            Write-Host "File aggiornato: vercel.json" -ForegroundColor Green
        }
    }
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

git add "app/actions/votes.ts" "app/(main)/admin/votes/VotesAdminClient.tsx" "vercel.json"
$status = git status --porcelain -- "app/actions/votes.ts" "app/(main)/admin/votes/VotesAdminClient.tsx" "vercel.json"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Azzera giornata: sblocca e riapre la giornata, rimosso blocco automatico settimanale`n`nBug trovato: azzerare una giornata (bottone Azzera in Admin > Voti) puliva`nvoti/risultati ma non la sbloccava e non riportava indietro la giornata`ncorrente della stagione - se nel frattempo era gia avanzata (es. per il`ncron settimanale che blocca e avanza in automatico), la giornata azzerata`nrestava bloccata e irraggiungibile dal menu Formazione per tutti.`n`nOra Azzera giornata sblocca la giornata, le toglie la scadenza (cosi il`ncontrollo automatico orario non la riblocca da solo) e riporta la giornata`ncorrente della stagione a quella appena azzerata, solo se era avanzata oltre.`n`nRimosso anche il cron settimanale che bloccava e avanzava la giornata in`nautomatico ogni sabato, a prescindere da cosa fosse successo: duplicava il`ncontrollo manuale gia disponibile (Blocca giornata / Gestisci giornata in`nAdmin) ed era la causa che poteva far ripetere il problema ogni settimana.`nResta invece il controllo automatico giornaliero legato alla scadenza che`nl'admin imposta per ogni giornata.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
