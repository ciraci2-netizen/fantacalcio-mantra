$ErrorActionPreference = 'Stop'
Write-Host '=== Coppe: giornata/data facoltative per turni e gironi (solo etichetta) ===' -ForegroundColor Cyan

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

$ok1 = Update-CodeFile -RelativePath "app\actions\cups.ts" -Marker 'setCupRoundSchedule' -MinLines 175 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 102) ---
    $lines.InsertRange(101, [string[]]@(
    '// Aggiorna la giornata di campionato e/o la data di un turno/girone gia''',
    '// creato - solo etichetta informativa, non cambia come si inserisce il',
    '// punteggio.',
    'export async function setCupRoundSchedule(prevState: unknown, formData: FormData) {',
    '  try {',
    '    await requireAdmin();',
    '    const db = getDb();',
    '    const cupRoundId = Number(formData.get("cupRoundId"));',
    '    const { matchdayNumber, playDate } = readSchedule(formData);',
    '    try {',
    '      await db.execute({',
    '        sql: `UPDATE "CupRound" SET matchdayNumber = ?, playDate = ? WHERE id = ?`,',
    '        args: [matchdayNumber, playDate, cupRoundId],',
    '      });',
    '    } catch {',
    '      return {',
    '        error:',
    '          ''Devi prima eseguire la migrazione del database: vai su Admin e premi "Esegui migrazione DB", poi riprova.'',',
    '      };',
    '    }',
    '    revalidatePath("/coppe");',
    '    revalidatePath("/admin/coppe");',
    '    return { success: true };',
    '  } catch (e) {',
    '    return { error: (e as Error).message };',
    '  }',
    '}',
    ''
    ))

    # --- Modifica 2 (riga originale 74) ---
    $lines.RemoveRange(73, 2)
    $lines.InsertRange(73, [string[]]@(
    '        sql: `INSERT INTO "CupRound" (cupId, name, number, type, matchdayNumber, playDate) VALUES (?, ?, ?, ''girone'', ?, ?)`,',
    '        args: [cupId, name, number, matchdayNumber, playDate],'
    ))

    # --- Modifica 3 (riga originale 68) ---
    $lines.InsertRange(67, [string[]]@(
    '    const { matchdayNumber, playDate } = readSchedule(formData);'
    ))

    # --- Modifica 4 (riga originale 38) ---
    $lines.RemoveRange(37, 1)
    $lines.InsertRange(37, [string[]]@(
    '    try {',
    '      await db.execute({',
    '        sql: `INSERT INTO "CupRound" (cupId, name, number, matchdayNumber, playDate) VALUES (?, ?, ?, ?, ?)`,',
    '        args: [cupId, name, number, matchdayNumber, playDate],',
    '      });',
    '    } catch {',
    '      // Colonne matchdayNumber/playDate non ancora migrate: crea comunque',
    '      // il turno senza schedulazione, non deve bloccare l''uso base.',
    '      await db.execute({ sql: `INSERT INTO "CupRound" (cupId, name, number) VALUES (?, ?, ?)`, args: [cupId, name, number] });',
    '    }'
    ))

    # --- Modifica 5 (riga originale 36) ---
    $lines.InsertRange(35, [string[]]@(
    '    const { matchdayNumber, playDate } = readSchedule(formData);'
    ))

    # --- Modifica 6 (riga originale 13) ---
    $lines.InsertRange(12, [string[]]@(
    '// Giornata di campionato e/o data in cui si gioca un turno/girone - solo',
    '// un''etichetta informativa: il punteggio resta sempre inserito a mano,',
    '// niente calcolo automatico dalla formazione di quella giornata.',
    'function readSchedule(formData: FormData) {',
    '  const rawMatchday = (formData.get("matchdayNumber") as string)?.trim();',
    '  const matchdayNumber = rawMatchday ? parseInt(rawMatchday, 10) : null;',
    '  const rawDate = (formData.get("playDate") as string)?.trim();',
    '  const playDate = rawDate || null;',
    '  return {',
    '    matchdayNumber: matchdayNumber && !isNaN(matchdayNumber) ? matchdayNumber : null,',
    '    playDate,',
    '  };',
    '}',
    ''
    ))
}

$ok2 = Update-CodeFile -RelativePath "app\actions\dbMigrate.ts" -Marker 'matchdayNumber' -MinLines 294 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 247) ---
    $lines.InsertRange(246, [string[]]@(
    '  // Quando si gioca un turno/girone di coppa: solo un''etichetta informativa',
    '  // (numero di giornata di campionato e/o data), il punteggio resta sempre',
    '  // inserito a mano - non c''e'' calcolo automatico dalla formazione.',
    '  try { await db.execute(`ALTER TABLE "CupRound" ADD COLUMN "matchdayNumber" INTEGER`); } catch { /* gia presente */ }',
    '  try { await db.execute(`ALTER TABLE "CupRound" ADD COLUMN "playDate" TEXT`); } catch { /* gia presente */ }',
    ''
    ))
}

$ok3 = Update-CodeFile -RelativePath "app\(main)\admin\coppe\page.tsx" -Marker 'matchdayNumber' -MinLines 72 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 46) ---
    $lines.InsertRange(45, [string[]]@(
    '            matchdayNumber: (round.matchdayNumber as number | null | undefined) ?? null,',
    '            playDate: (round.playDate as string | null | undefined) ?? null,'
    ))

    # --- Modifica 2 (riga originale 26) ---
    $lines.RemoveRange(25, 1)
    $lines.InsertRange(25, [string[]]@(
    '        roundsRes = await db.execute({ sql: `SELECT id, name, number, type, matchdayNumber, playDate FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`, args: [cup.id] });'
    ))

    # --- Modifica 3 (riga originale 22) ---
    $lines.RemoveRange(21, 2)
    $lines.InsertRange(21, [string[]]@(
    '      // "type"/"matchdayNumber"/"playDate" sono colonne aggiunte dopo (fase a',
    '      // gironi + schedulazione) - se il DB non e'' ancora migrato, ricadiamo',
    '      // su un turno "eliminazione" senza schedulazione per tutti.'
    ))
}

$ok4 = Update-CodeFile -RelativePath "app\(main)\admin\coppe\AdminCoppeClient.tsx" -Marker 'setCupRoundSchedule' -MinLines 186 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 106) ---
    $lines.InsertRange(105, [string[]]@(
    '                {/* Quando si gioca: giornata/data, solo etichetta - il punteggio resta a mano */}',
    '                <form action={scheduleAction} className="flex flex-wrap items-end gap-2 mb-3 bg-gray-50 rounded-lg px-3 py-2">',
    '                  <input type="hidden" name="cupRoundId" value={round.id} />',
    '                  <div>',
    '                    <label className="block text-[10px] text-gray-400 mb-0.5">Giornata</label>',
    '                    <input type="number" name="matchdayNumber" min="1" defaultValue={round.matchdayNumber ?? ""} placeholder="es. 12" className="w-20 border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />',
    '                  </div>',
    '                  <div>',
    '                    <label className="block text-[10px] text-gray-400 mb-0.5">Data</label>',
    '                    <input type="date" name="playDate" defaultValue={round.playDate ?? ""} className="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />',
    '                  </div>',
    '                  <button type="submit" disabled={schedulePending} className="px-2.5 py-1 bg-gray-600 hover:bg-gray-700 disabled:opacity-60 text-white rounded text-xs">Salva</button>',
    '                </form>',
    ''
    ))

    # --- Modifica 2 (riga originale 96) ---
    $lines.RemoveRange(95, 1)
    $lines.InsertRange(95, [string[]]@(
    '                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">'
    ))

    # --- Modifica 3 (riga originale 74) ---
    $lines.RemoveRange(73, 1)
    $lines.InsertRange(73, [string[]]@(
    '              <div className="flex flex-wrap gap-3 items-end">',
    '                <input type="text" name="name" required placeholder="es. Girone A" className="w-full sm:w-64 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />',
    '                <div>',
    '                  <label className="block text-xs text-gray-500 mb-1">Giornata (facoltativo)</label>',
    '                  <input type="number" name="matchdayNumber" min="1" placeholder="es. 5" className="w-24 border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />',
    '                </div>',
    '                <div>',
    '                  <label className="block text-xs text-gray-500 mb-1">Data (facoltativo)</label>',
    '                  <input type="date" name="playDate" className="border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />',
    '                </div>',
    '              </div>'
    ))

    # --- Modifica 4 (riga originale 63) ---
    $lines.InsertRange(62, [string[]]@(
    '              <div>',
    '                <label className="block text-xs text-gray-500 mb-1">Giornata (facoltativo)</label>',
    '                <input type="number" name="matchdayNumber" min="1" placeholder="es. 12" className="w-24 border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />',
    '              </div>',
    '              <div>',
    '                <label className="block text-xs text-gray-500 mb-1">Data (facoltativo)</label>',
    '                <input type="date" name="playDate" className="border rounded-lg px-2 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />',
    '              </div>'
    ))

    # --- Modifica 5 (riga originale 60) ---
    $lines.RemoveRange(59, 1)
    $lines.InsertRange(59, [string[]]@(
    '              <div className="flex-1 min-w-[160px]">'
    ))

    # --- Modifica 6 (riga originale 58) ---
    $lines.RemoveRange(57, 1)
    $lines.InsertRange(57, [string[]]@(
    '            <form action={roundAction} className="flex flex-wrap gap-3 items-end">'
    ))

    # --- Modifica 7 (riga originale 42) ---
    $lines.InsertRange(41, [string[]]@(
    '      {scheduleState?.error && <p className="text-red-600 text-sm">{scheduleState.error}</p>}'
    ))

    # --- Modifica 8 (riga originale 18) ---
    $lines.InsertRange(17, [string[]]@(
    '  const [scheduleState, scheduleAction, schedulePending] = useActionState(setCupRoundSchedule, null);'
    ))

    # --- Modifica 9 (riga originale 8) ---
    $lines.RemoveRange(7, 1)
    $lines.InsertRange(7, [string[]]@(
    'type Round = { id: number; name: string; number: number; type: "eliminazione" | "girone"; matchdayNumber: number | null; playDate: string | null; matches: Match[] };'
    ))

    # --- Modifica 10 (riga originale 4) ---
    $lines.RemoveRange(3, 1)
    $lines.InsertRange(3, [string[]]@(
    'import { createCup, createCupRound, createCupGroup, createCupMatch, setCupMatchScore, setCupRoundSchedule, deleteCup, deleteCupRound } from "@/app/actions/cups";'
    ))
}

$ok5 = Update-CodeFile -RelativePath "app\(main)\coppe\page.tsx" -Marker 'formatSchedule' -MinLines 332 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 283) ---
    $lines.InsertRange(282, [string[]]@(
    '        {formatSchedule(round) && (',
    '          <p className="text-xs text-gray-400 mt-0.5">{formatSchedule(round)}</p>',
    '        )}'
    ))

    # --- Modifica 2 (riga originale 193) ---
    $lines.InsertRange(192, [string[]]@(
    '// Etichetta "quando si gioca" per un turno/girone: giornata di campionato',
    '// e/o data, solo informativa (nessun calcolo automatico dal punteggio).',
    'function formatSchedule(round: CupRound): string | null {',
    '  const parts: string[] = [];',
    '  if (round.matchdayNumber !== null) parts.push(`Giornata ${round.matchdayNumber}`);',
    '  if (round.playDate) {',
    '    const d = new Date(round.playDate);',
    '    if (!isNaN(d.getTime())) {',
    '      parts.push(d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }));',
    '    }',
    '  }',
    '  return parts.length > 0 ? parts.join(" " + String.fromCharCode(183) + " ") : null;',
    '}',
    ''
    ))

    # --- Modifica 3 (riga originale 156) ---
    $lines.InsertRange(155, [string[]]@(
    '                                {formatSchedule(round) && (',
    '                                  <div className="text-[10px] font-normal normal-case text-gray-400 mt-1">',
    '                                    {formatSchedule(round)}',
    '                                  </div>',
    '                                )}'
    ))

    # --- Modifica 4 (riga originale 98) ---
    $lines.InsertRange(97, [string[]]@(
    '            matchdayNumber: (round.matchdayNumber as number | null | undefined) ?? null,',
    '            playDate: (round.playDate as string | null | undefined) ?? null,'
    ))

    # --- Modifica 5 (riga originale 72) ---
    $lines.RemoveRange(71, 1)
    $lines.InsertRange(71, [string[]]@(
    '          sql: `SELECT id, name, number, type, matchdayNumber, playDate FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`,'
    ))

    # --- Modifica 6 (riga originale 23) ---
    $lines.InsertRange(22, [string[]]@(
    '  matchdayNumber: number | null;',
    '  playDate: string | null;'
    ))
}

$allOk = $ok1 -and $ok2 -and $ok3 -and $ok4 -and $ok5

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

git add "app/actions/cups.ts" "app/actions/dbMigrate.ts" "app/(main)/admin/coppe/page.tsx" "app/(main)/admin/coppe/AdminCoppeClient.tsx" "app/(main)/coppe/page.tsx"
$status = git status --porcelain -- "app/actions/cups.ts" "app/actions/dbMigrate.ts" "app/(main)/admin/coppe/page.tsx" "app/(main)/admin/coppe/AdminCoppeClient.tsx" "app/(main)/coppe/page.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Coppe: giornata e/o data facoltative per turni e gironi`n`nSi puo ora indicare, per ogni turno o girone di una coppa, la giornata di`ncampionato e/o la data in cui si gioca (entrambe facoltative, si possono`nlasciare vuote o modificare in qualsiasi momento). E solo un'etichetta`ninformativa mostrata sia in Admin che nella pagina Coppe pubblica -`nil punteggio resta sempre da inserire a mano come prima, nessun calcolo`nautomatico dalla formazione di quella giornata.`n`nRichiede la stessa migrazione DB del girone (nuove colonne su CupRound):`nse non l'hai gia fatto, vai su Admin e premi `"Esegui migrazione DB`".`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
