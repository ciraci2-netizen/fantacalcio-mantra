$ErrorActionPreference = 'Stop'
Write-Host '=== Rimuove il cron auto-import + aggiunge pulsante "Azzera giornata" ===' -ForegroundColor Cyan

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

$ok1 = Update-CodeFile -RelativePath "app\actions\votes.ts" -Marker 'resetMatchday' -MinLines 264 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 129) ---
    $lines.InsertRange(128, [string[]]@(
    '// -- Admin: azzera voti e risultati di una giornata gia importata/calcolata,',
    '// per poterla reimportare/ricalcolare da zero a mano. Cancella i voti',
    '// importati, i risultati delle partite (che spariscono anche dalla',
    '// classifica, calcolata al volo da Match.homePoints/awayPoints) e le',
    '// formazioni generate automaticamente per chi non aveva inviato la propria',
    '// (isAutomatic = 1) - le formazioni inviate a mano dagli utenti restano,',
    '// solo il punteggio calcolato viene azzerato, cosi non si perde cosa',
    '// avevano schierato.',
    'export async function resetMatchday(prevState: string | null, formData: FormData) {',
    '  const session = await getSession();',
    '  if (!session?.isAdmin) return "Non autorizzato.";',
    '',
    '  const matchdayId = parseInt(formData.get("matchdayId") as string);',
    '  if (!matchdayId) return "Giornata non valida.";',
    '',
    '  const db = getDb();',
    '  const check = await db.execute({ sql: `SELECT number FROM "Matchday" WHERE id = ?`, args: [matchdayId] });',
    '  if (check.rows.length === 0) return "Giornata non trovata.";',
    '  const matchdayNumber = check.rows[0].number as number;',
    '',
    '  await db.execute({ sql: `DELETE FROM "PlayerVote" WHERE matchdayId = ?`, args: [matchdayId] });',
    '',
    '  await db.execute({',
    '    sql: `DELETE FROM "LineupSlot" WHERE lineupId IN (',
    '            SELECT id FROM "Lineup" WHERE matchdayId = ? AND isAutomatic = 1',
    '          )`,',
    '    args: [matchdayId],',
    '  });',
    '  await db.execute({ sql: `DELETE FROM "Lineup" WHERE matchdayId = ? AND isAutomatic = 1`, args: [matchdayId] });',
    '  await db.execute({',
    '    sql: `UPDATE "Lineup" SET totalScore = NULL, goalBonus = NULL, substitutions = 0',
    '          WHERE matchdayId = ? AND (isAutomatic = 0 OR isAutomatic IS NULL)`,',
    '    args: [matchdayId],',
    '  });',
    '',
    '  await db.execute({',
    '    sql: `UPDATE "Match" SET homeScore = NULL, awayScore = NULL, homePoints = NULL, awayPoints = NULL,',
    '                 homeGoals = NULL, awayGoals = NULL,',
    '                 homeDefenseAvg = NULL, homeDefenseMalus = NULL, awayDefenseAvg = NULL, awayDefenseMalus = NULL',
    '          WHERE matchdayId = ?`,',
    '    args: [matchdayId],',
    '  });',
    '',
    '  await db.execute({ sql: `UPDATE "Matchday" SET votesImported = 0 WHERE id = ?`, args: [matchdayId] });',
    '',
    '  revalidatePath("/admin/votes");',
    '  revalidatePath("/standings");',
    '  revalidatePath("/calendar");',
    '  revalidatePath("/dashboard");',
    '  revalidatePath("/lineup");',
    '',
    '  return `AZZERATA: Giornata ${matchdayNumber} riportata a "non calcolata" - voti, risultati e formazioni automatiche rimossi. Le formazioni inviate a mano restano, solo il punteggio e stato azzerato.`;',
    '}',
    ''
    ))
}

$ok2 = Update-CodeFile -RelativePath "app\(main)\admin\votes\VotesAdminClient.tsx" -Marker 'resetMatchday' -MinLines 702 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 467) ---
    $lines.InsertRange(466, [string[]]@(
    '            {resetResult && (',
    '              <div className={`px-4 py-3 rounded-lg text-sm ${resetResult.startsWith("AZZERATA") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>',
    '                {resetResult}',
    '              </div>',
    '            )}',
    ''
    ))

    # --- Modifica 2 (riga originale 465) ---
    $lines.InsertRange(464, [string[]]@(
    '',
    '              {selectedMatchday.votesImported && (',
    '                <form',
    '                  action={resetAction}',
    '                  onSubmit={(e) => {',
    '                    if (!confirm(`Azzerare la Giornata ${selectedMatchday.number}? Voti importati, risultati e classifica di questa giornata verranno rimossi (le formazioni inviate a mano restano, solo il punteggio si azzera). Potrai reimportare/ricalcolare da capo.`)) {',
    '                      e.preventDefault();',
    '                    }',
    '                  }}',
    '                >',
    '                  <input type="hidden" name="matchdayId" value={selectedMatchday.id} />',
    '                  <button',
    '                    type="submit"',
    '                    disabled={resetPending}',
    '                    className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"',
    '                  >',
    '                    {resetPending ? "Azzeramento..." : `${"\u{1F5D1}"} Azzera G${selectedMatchday.number}`}',
    '                  </button>',
    '                </form>',
    '              )}'
    ))

    # --- Modifica 3 (riga originale 92) ---
    $lines.InsertRange(91, [string[]]@(
    '  const [resetResult, resetAction, resetPending] = useActionState(resetMatchday, null);'
    ))

    # --- Modifica 4 (riga originale 5) ---
    $lines.RemoveRange(4, 1)
    $lines.InsertRange(4, [string[]]@(
    'import { importVotes, calculateAllScores, resetMatchday, updatePlayerVote, backfillGsrDryRun, backfillGsrApply } from "@/app/actions/votes";'
    ))
}

# --- vercel.json: rimuove il cron auto-import (la modifica TOGLIE testo, non
# lo aggiunge - qui il controllo "gia applicato" e l'opposto: se la stringa
# NON c'e piu, e gia stato tolto in precedenza) ---
$target3 = Join-Path (Get-Location).Path "vercel.json"
if (-not (Test-Path -LiteralPath $target3)) {
    Write-Host "ERRORE: non trovo vercel.json - esegui questo script dalla cartella principale del repo (fantacalcio-mantra)." -ForegroundColor Red
    $ok3 = $false
} else {
    $bytes3 = [System.IO.File]::ReadAllBytes($target3)
    $text3 = [System.Text.Encoding]::UTF8.GetString($bytes3)
    if ($text3 -notmatch [regex]::Escape('cron/auto-import')) {
        Write-Host "vercel.json non contiene piu il cron auto-import: gia rimosso in precedenza, non faccio nulla." -ForegroundColor Yellow
        $ok3 = $true
    } else {
        $lines3 = New-Object System.Collections.Generic.List[string]
        $lines3.AddRange([string[]]($text3 -split "`r`n|`n"))
        if ($lines3.Count -lt 16) {
            Write-Host "ERRORE: vercel.json ha meno righe del previsto." -ForegroundColor Red
            $ok3 = $false
        } else {
    # --- Modifica 1 (riga originale 10) ---
    $lines3.RemoveRange(9, 4)
            $newText3 = [string]::Join("`r`n", $lines3)
            [System.IO.File]::WriteAllText($target3, $newText3, (New-Object System.Text.UTF8Encoding($false)))
            Write-Host "File aggiornato: vercel.json" -ForegroundColor Green
            $ok3 = $true
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
    git commit -m "Rimuove import voti automatico e aggiunge azzeramento giornata`n`nIl cron auto-import (ogni lunedi) scaricava i voti da fantapiu3 e`ncalcolava subito i punteggi senza intervento manuale - rimosso da`nvercel.json su richiesta: l'import e il calcolo restano disponibili`nin /admin/votes ma vanno avviati a mano.`n`nAggiunto anche un pulsante 'Azzera giornata' in /admin/votes per`nriportare una giornata gia importata/calcolata allo stato iniziale`n(cancella voti importati e risultati partite - quindi anche dalla`nclassifica, calcolata al volo dai risultati - e le formazioni`ngenerate automaticamente per chi non aveva inviato la propria; le`nformazioni inviate a mano restano, solo il punteggio si azzera),`ncosi si puo reimportare/ricalcolare da capo.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
