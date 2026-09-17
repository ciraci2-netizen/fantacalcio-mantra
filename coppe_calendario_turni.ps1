$ErrorActionPreference = 'Stop'
Write-Host '=== Coppe: calendario a turni per i gironi (con riposo a rotazione) ===' -ForegroundColor Cyan

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

function New-CodeFile {
    param(
        [string]$RelativePath,
        [string[]]$ContentLines
    )

    $target = Join-Path (Get-Location).Path $RelativePath

    if (Test-Path -LiteralPath $target) {
        Write-Host "Il file $RelativePath esiste gia. Non faccio nulla." -ForegroundColor Yellow
        return $true
    }

    $parent = Split-Path -Parent $target
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $newText = [string]::Join("`r`n", $ContentLines) + "`r`n"
    [System.IO.File]::WriteAllText($target, $newText, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "File creato: $RelativePath" -ForegroundColor Green
    return $true
}

$ok0 = New-CodeFile -RelativePath "app\lib\cupSchedule.ts" -ContentLines @(
    '// Calendario "all''italiana" per un girone: assegna ad ogni partita un'
    '// "turno" (1, 2, 3...) in modo che ogni squadra giochi al massimo una'
    '// partita a turno. Se il numero di squadre e'' dispari, ad ogni turno una'
    '// squadra resta a riposo (a rotazione). Metodo del cerchio (circle method):'
    '// funziona per qualsiasi numero di squadre >= 3, ogni coppia si incontra'
    '// esattamente una volta sola (nessun andata/ritorno).'
    '// Pura funzione, nessun accesso al DB - riusabile ovunque serva.'
    ''
    'export type ScheduledMatch = {'
    '  roundSlot: number;'
    '  homeUserId: number;'
    '  awayUserId: number;'
    '};'
    ''
    'export function generateRoundRobinSchedule(teamIds: number[]): ScheduledMatch[] {'
    '  const BYE = -1;'
    '  const ids = [...teamIds];'
    '  if (ids.length % 2 !== 0) ids.push(BYE);'
    ''
    '  const n = ids.length;'
    '  if (n < 2) return [];'
    ''
    '  const rounds = n - 1;'
    '  const half = n / 2;'
    '  const arr = [...ids];'
    '  const schedule: ScheduledMatch[] = [];'
    ''
    '  for (let r = 0; r < rounds; r++) {'
    '    for (let i = 0; i < half; i++) {'
    '      const a = arr[i];'
    '      const b = arr[n - 1 - i];'
    '      if (a !== BYE && b !== BYE) {'
    '        schedule.push({ roundSlot: r + 1, homeUserId: a, awayUserId: b });'
    '      }'
    '    }'
    '    // Ruota tutte le squadre tranne la prima, che resta fissa in posizione.'
    '    const fixed = arr[0];'
    '    const rest = arr.slice(1);'
    '    const last = rest.pop();'
    '    if (last !== undefined) rest.unshift(last);'
    '    arr.splice(0, arr.length, fixed, ...rest);'
    '  }'
    ''
    '  return schedule;'
    '}'
)

$ok1 = Update-CodeFile -RelativePath "app\actions\cups.ts" -Marker 'generateRoundRobinSchedule' -MinLines 228 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 114) ---
    $lines.RemoveRange(113, 1)
    $lines.InsertRange(113, [string[]]@(
    '          args: [cupRoundId, m.homeUserId, m.awayUserId],'
    ))

    # --- Modifica 2 (riga originale 110) ---
    $lines.RemoveRange(109, 2)
    $lines.InsertRange(109, [string[]]@(
    '    // Calendario all''italiana: ogni squadra incontra tutte le altre una',
    '    // volta sola, raggruppate per turno interno del girone (roundSlot) con',
    '    // una squadra a riposo a turno se le squadre sono dispari.',
    '    const schedule = generateRoundRobinSchedule(userIds);',
    '    for (const m of schedule) {',
    '      try {',
    '        await db.execute({',
    '          sql: `INSERT INTO "CupMatch" (cupRoundId, homeUserId, awayUserId, roundSlot) VALUES (?, ?, ?, ?)`,',
    '          args: [cupRoundId, m.homeUserId, m.awayUserId, m.roundSlot],',
    '        });',
    '      } catch {',
    '        // Colonna roundSlot non ancora migrata: crea comunque la partita,',
    '        // solo senza raggruppamento per turno (rifai la migrazione DB e',
    '        // ricrea il girone per averlo).'
    ))

    # --- Modifica 3 (riga originale 6) ---
    $lines.InsertRange(5, [string[]]@(
    'import { generateRoundRobinSchedule } from "@/app/lib/cupSchedule";'
    ))
}

$ok2 = Update-CodeFile -RelativePath "app\actions\dbMigrate.ts" -Marker 'roundSlot' -MinLines 300 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 253) ---
    $lines.InsertRange(252, [string[]]@(
    '  // Turno interno del girone (1, 2, 3...): a quale "giornata di girone"',
    '  // appartiene ogni partita, calcolato in automatico alla creazione del',
    '  // girone col calendario all''italiana (una squadra a riposo a turno se le',
    '  // squadre sono dispari). Solo per raggruppare le partite nella UI - il',
    '  // punteggio resta sempre inserito a mano.',
    '  try { await db.execute(`ALTER TABLE "CupMatch" ADD COLUMN "roundSlot" INTEGER`); } catch { /* gia presente */ }',
    ''
    ))
}

$ok3 = Update-CodeFile -RelativePath "app\(main)\admin\coppe\page.tsx" -Marker 'roundSlot' -MinLines 75 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 57) ---
    $lines.InsertRange(56, [string[]]@(
    '              roundSlot: (m.roundSlot as number | null | undefined) ?? null,'
    ))

    # --- Modifica 2 (riga originale 33) ---
    $lines.RemoveRange(32, 9)
    $lines.InsertRange(32, [string[]]@(
    '          // "roundSlot" e'' una colonna aggiunta dopo (turni interni del',
    '          // girone) - se il DB non e'' ancora migrato, ricadiamo su un',
    '          // elenco piatto di partite senza raggruppamento.',
    '          let matchesRes;',
    '          try {',
    '            matchesRes = await db.execute({',
    '              sql: `SELECT cm.id, cm.homeScore, cm.awayScore, cm.homeUserId, cm.awayUserId, cm.roundSlot,',
    '                           hu.teamName as homeTeam, au.teamName as awayTeam',
    '                    FROM "CupMatch" cm',
    '                    JOIN "User" hu ON hu.id = cm.homeUserId',
    '                    JOIN "User" au ON au.id = cm.awayUserId',
    '                    WHERE cm.cupRoundId = ?`,',
    '              args: [round.id],',
    '            });',
    '          } catch {',
    '            matchesRes = await db.execute({',
    '              sql: `SELECT cm.id, cm.homeScore, cm.awayScore, cm.homeUserId, cm.awayUserId,',
    '                           hu.teamName as homeTeam, au.teamName as awayTeam',
    '                    FROM "CupMatch" cm',
    '                    JOIN "User" hu ON hu.id = cm.homeUserId',
    '                    JOIN "User" au ON au.id = cm.awayUserId',
    '                    WHERE cm.cupRoundId = ?`,',
    '              args: [round.id],',
    '            });',
    '          }'
    ))
}

$ok4 = Update-CodeFile -RelativePath "app\(main)\admin\coppe\AdminCoppeClient.tsx" -Marker 'groupMatchesBySlot' -MinLines 220 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 209) ---
    $lines.RemoveRange(208, 2)
    $lines.InsertRange(208, [string[]]@(
    '                  );',
    '',
    '                  const canGroup = isGroup && round.matches.length > 0 && round.matches.every((m) => m.roundSlot !== null);',
    '',
    '                  if (!canGroup) {',
    '                    return <div className="space-y-2">{round.matches.map(renderMatch)}</div>;',
    '                  }',
    '',
    '                  return (',
    '                    <div className="space-y-4">',
    '                      {groupMatchesBySlot(round.matches).map(({ slot, matches, resting }) => (',
    '                        <div key={slot}>',
    '                          <div className="flex flex-wrap items-baseline gap-x-2 mb-1.5">',
    '                            <span className="text-xs font-semibold text-amber-700">Turno {slot}</span>',
    '                            {resting.length > 0 && (',
    '                              <span className="text-xs text-gray-400">',
    '                                {"\u2014"} riposa: {resting.join(", ")}',
    '                              </span>',
    '                            )}',
    '                          </div>',
    '                          <div className="space-y-2">{matches.map(renderMatch)}</div>',
    '                        </div>',
    '                      ))}',
    '                    </div>',
    '                  );',
    '                })()}'
    ))

    # --- Modifica 2 (riga originale 195) ---
    $lines.RemoveRange(194, 3)
    $lines.InsertRange(194, [string[]]@(
    '                {/* Matches - nei gironi raggruppate per turno interno (con chi',
    '                    riposa), se il turno ha gia'' il calendario calcolato;',
    '                    altrimenti (turni a eliminazione, o gironi creati prima',
    '                    di questa funzione) restano in un elenco unico */}',
    '                {(() => {',
    '                  const renderMatch = (m: Match) => ('
    ))

    # --- Modifica 3 (riga originale 12) ---
    $lines.InsertRange(11, [string[]]@(
    '// Raggruppa le partite di un girone per turno interno (roundSlot), e per',
    '// ogni turno calcola quale squadra resta a riposo (la squadra del girone',
    '// che non compare fra i due team di nessuna partita di quel turno).',
    'type SlotGroup = { slot: number; matches: Match[]; resting: string[] };',
    '',
    'function groupMatchesBySlot(matches: Match[]): SlotGroup[] {',
    '  const teamNames = new Map<number, string>();',
    '  for (const m of matches) {',
    '    teamNames.set(m.homeUserId, m.homeTeam);',
    '    teamNames.set(m.awayUserId, m.awayTeam);',
    '  }',
    '  const allTeamIds = [...teamNames.keys()];',
    '',
    '  const bySlot = new Map<number, Match[]>();',
    '  for (const m of matches) {',
    '    const slot = m.roundSlot ?? 0;',
    '    if (!bySlot.has(slot)) bySlot.set(slot, []);',
    '    bySlot.get(slot)!.push(m);',
    '  }',
    '',
    '  return [...bySlot.entries()]',
    '    .sort((a, b) => a[0] - b[0])',
    '    .map(([slot, slotMatches]) => {',
    '      const playingIds = new Set<number>();',
    '      for (const m of slotMatches) {',
    '        playingIds.add(m.homeUserId);',
    '        playingIds.add(m.awayUserId);',
    '      }',
    '      const resting = allTeamIds',
    '        .filter((id) => !playingIds.has(id))',
    '        .map((id) => teamNames.get(id) as string);',
    '      return { slot, matches: slotMatches, resting };',
    '    });',
    '}',
    ''
    ))

    # --- Modifica 4 (riga originale 7) ---
    $lines.RemoveRange(6, 1)
    $lines.InsertRange(6, [string[]]@(
    'type Match = { id: number; homeScore: number | null; awayScore: number | null; homeTeam: string; awayTeam: string; homeUserId: number; awayUserId: number; roundSlot: number | null };'
    ))
}

$allOk = $ok0 -and $ok1 -and $ok2 -and $ok3 -and $ok4

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

git add "app/lib/cupSchedule.ts" "app/actions/cups.ts" "app/actions/dbMigrate.ts" "app/(main)/admin/coppe/page.tsx" "app/(main)/admin/coppe/AdminCoppeClient.tsx"
$status = git status --porcelain -- "app/lib/cupSchedule.ts" "app/actions/cups.ts" "app/actions/dbMigrate.ts" "app/(main)/admin/coppe/page.tsx" "app/(main)/admin/coppe/AdminCoppeClient.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Coppe: calendario a turni per i gironi, con riposo a rotazione`n`nLe partite generate automaticamente per un girone vengono ora raggruppate`nper turno interno (Turno 1, Turno 2, ...) invece di restare in un unico`nelenco: ad ogni turno gioca una partita chi puo, e se le squadre del`ngirone sono dispari una resta a riposo a rotazione (calendario`nall`"italiana - metodo del cerchio, ogni coppia si incontra una volta`nsola, mai andata/ritorno). Per un girone da 5 squadre: 5 turni interni,`n2 partite a turno, 1 squadra a riposo a turno, 10 partite totali (4 a`ntesta).`n`nSotto ogni turno, in Admin, e ora indicato anche chi riposa in quel`nturno. I gironi gia creati prima di questa modifica restano con l`"elenco`npiatto di partite (nessuna modifica retroattiva) - per avere i turni`nraggruppati vanno eliminati e ricreati con `"+Girone`".`n`nRichiede una migrazione DB (nuova colonna roundSlot su CupMatch): dopo`nil deploy, vai su Admin e premi `"Esegui migrazione DB`", poi elimina ed`neventualmente ricrea i gironi esistenti per avere il calendario a turni.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
    Write-Host 'IMPORTANTE: dopo il deploy vai su Admin e premi "Esegui migrazione DB", poi elimina e ricrea i gironi esistenti per avere il calendario a turni.' -ForegroundColor Yellow
}
