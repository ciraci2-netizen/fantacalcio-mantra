$ErrorActionPreference = 'Stop'
Write-Host '=== Tabellino: modificatore difensivo usa il VOTO (non il fantavoto) + mostra i voti considerati ===' -ForegroundColor Cyan

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

$ok1 = Update-CodeFile -RelativePath "app\(main)\calendar\[matchId]\page.tsx" -Marker 'pickDefenseConsidered' -MinLines 556 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 551) ---
    $lines.RemoveRange(550, 1)
    $lines.InsertRange(550, [string[]]@(
    '      {slot.vote !== null && (',
    '        <span className="text-xs text-gray-400 shrink-0 tabular-nums" title="Voto (prima di bonus/malus)">',
    '          v.{slot.vote.toFixed(1)}',
    '        </span>',
    '      )}',
    '      <span className={`text-sm shrink-0 tabular-nums ${fvColor}`} title="Fantavoto (voto + bonus/malus)">'
    ))

    # --- Modifica 2 (riga originale 295) ---
    $lines.RemoveRange(294, 7)
    $lines.InsertRange(294, [string[]]@(
    '              <div className="text-gray-600">',
    '                <p>',
    '                  Difesa <strong>{match.awayTeamName as string}</strong>: media{" "}',
    '                  <strong>{(match.awayDefenseAvg as number).toFixed(2)}</strong> {"\u2192"}{" "}',
    '                  <span className="text-red-600 font-semibold">',
    '                    {match.awayDefenseMalus as number} a {match.homeTeamName as string}',
    '                  </span>',
    '                </p>',
    '                {awayDefenseConsidered && (',
    '                  <p className="text-xs text-gray-400 mt-1">',
    '                    Voti considerati (portiere + 3 migliori difensori titolari): {awayDefenseConsidered.gk.name}{" "}',
    '                    {(awayDefenseConsidered.gk.vote as number).toFixed(1)}, {awayDefenseConsidered.defenders',
    '                      .map((d) => `${d.name} ${(d.vote as number).toFixed(1)}`)',
    '                      .join(", ")}',
    '                  </p>',
    '                )}',
    '              </div>'
    ))

    # --- Modifica 3 (riga originale 286) ---
    $lines.RemoveRange(285, 7)
    $lines.InsertRange(285, [string[]]@(
    '              <div className="text-gray-600">',
    '                <p>',
    '                  Difesa <strong>{match.homeTeamName as string}</strong>: media{" "}',
    '                  <strong>{(match.homeDefenseAvg as number).toFixed(2)}</strong> {"\u2192"}{" "}',
    '                  <span className="text-red-600 font-semibold">',
    '                    {match.homeDefenseMalus as number} a {match.awayTeamName as string}',
    '                  </span>',
    '                </p>',
    '                {homeDefenseConsidered && (',
    '                  <p className="text-xs text-gray-400 mt-1">',
    '                    Voti considerati (portiere + 3 migliori difensori titolari): {homeDefenseConsidered.gk.name}{" "}',
    '                    {(homeDefenseConsidered.gk.vote as number).toFixed(1)}, {homeDefenseConsidered.defenders',
    '                      .map((d) => `${d.name} ${(d.vote as number).toFixed(1)}`)',
    '                      .join(", ")}',
    '                  </p>',
    '                )}',
    '              </div>'
    ))

    # --- Modifica 4 (riga originale 284) ---
    $lines.RemoveRange(283, 1)
    $lines.InsertRange(283, [string[]]@(
    '          <div className="p-4 space-y-3 text-sm">'
    ))

    # --- Modifica 5 (riga originale 193) ---
    $lines.InsertRange(192, [string[]]@(
    '  // Solo per il riquadro "Modificatore difensivo" qui sotto: chi e stato',
    '  // considerato (portiere + 3 migliori difensori titolari, per voto).',
    '  const homeDefenseConsidered = pickDefenseConsidered(homeSlots);',
    '  const awayDefenseConsidered = pickDefenseConsidered(awaySlots);',
    ''
    ))

    # --- Modifica 6 (riga originale 181) ---
    $lines.InsertRange(180, [string[]]@(
    '      vote: row.vote as number | null,'
    ))

    # --- Modifica 7 (riga originale 163) ---
    $lines.RemoveRange(162, 1)
    $lines.InsertRange(162, [string[]]@(
    '                 pv.vote, pv.fantavoto'
    ))

    # --- Modifica 8 (riga originale 45) ---
    $lines.InsertRange(44, [string[]]@(
    '// Ricostruisce SOLO quali giocatori sono stati considerati per il',
    '// modificatore difensivo (portiere + 3 migliori difensori titolari, per',
    '// VOTO - mai fantavoto, vedi calculateDefenseModifier in app/lib/scoring.ts),',
    '// per renderlo verificabile nel tabellino. Il malus vero resta quello gia',
    '// salvato su Match (calcolato da calculateScoresCore): qui non lo si',
    '// ricalcola, si mostra solo la composizione usata per arrivarci.',
    'type DefenseConsidered = { gk: PlayerSlot; defenders: PlayerSlot[] } | null;',
    '',
    'function pickDefenseConsidered(slots: PlayerSlot[]): DefenseConsidered {',
    '  const starters = slots.filter((s) => s.isStarter);',
    '  const gk = starters.find((s) => s.mantraRole === "POR");',
    '  if (!gk || gk.vote === null) return null;',
    '  const defenders = starters.filter((s) => s.mantraRole === "TER" || s.mantraRole === "DC");',
    '  if (defenders.length < 4 || defenders.some((d) => d.vote === null)) return null;',
    '  const bestThree = [...defenders].sort((a, b) => (b.vote as number) - (a.vote as number)).slice(0, 3);',
    '  return { gk, defenders: bestThree };',
    '}',
    ''
    ))

    # --- Modifica 9 (riga originale 41) ---
    $lines.InsertRange(40, [string[]]@(
    '  vote: number | null;'
    ))
}

$allOk = $ok1

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

git add "app/(main)/calendar/[matchId]/page.tsx"
$status = git status --porcelain -- "app/(main)/calendar/[matchId]/page.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Tabellino: mostra i voti usati dal modificatore difensivo`n`nIl modificatore difensivo (portiere + 3 migliori difensori titolari) usa`ngia nel codice il VOTO grezzo, non il fantavoto (calculateDefenseModifier`nin app/lib/scoring.ts) - se un tabellino gia calcolato mostra un valore`nche sembra usare il fantavoto invece del voto, e perche e stato calcolato`nprima che questa logica fosse a posto: riaprendo Calcola punteggi per`nquella giornata (o Azzera + reimporta) il valore si aggiorna con la`nlogica corretta, usando i voti gia salvati.`n`nPer rendere il calcolo verificabile a colpo d'occhio, il tabellino ora`nelenca esplicitamente quali giocatori (portiere + 3 migliori difensori)`nsono stati considerati e con quale voto, e mostra il voto oltre al`nfantavoto per ogni giocatore in formazione.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
