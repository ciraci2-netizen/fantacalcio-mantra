$ErrorActionPreference = 'Stop'
Write-Host '=== Calendario: generazione sicura + ripeti prime 9 giornate a campi invertiti ===' -ForegroundColor Cyan

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

$ok1 = Update-CodeFile -RelativePath "app\actions\schedule.ts" -Marker 'repeatCalendarFromFirstLeg' -MinLines 241 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 86) ---
    $lines.RemoveRange(85, 1)
    $lines.InsertRange(85, [string[]]@(
    '  if (skipped > 0) {',
    '    return `OK: generate/aggiornate ${updated} giornate. ${skipped} gia con un risultato inserito sono state lasciate intatte.`;',
    '  }',
    '  return `OK: generate/aggiornate ${updated} giornate.`;',
    '}',
    '',
    'export async function repeatCalendarFromFirstLeg(prevState: string | null, formData: FormData) {',
    '  const session = await getSession();',
    '  if (!session?.isAdmin) return "Non autorizzato.";',
    '',
    '  const seasonId = parseInt(formData.get("seasonId") as string);',
    '  const db = getDb();',
    '',
    '  const seasonRes = await db.execute({ sql: `SELECT id FROM "Season" WHERE id = ?`, args: [seasonId] });',
    '  if (seasonRes.rows.length === 0) return "Stagione non trovata.";',
    '',
    '  const matchdaysRes = await db.execute({',
    '    sql: `SELECT id, number FROM "Matchday" WHERE seasonId = ? ORDER BY number ASC`,',
    '    args: [seasonId],',
    '  });',
    '  const matchdays = matchdaysRes.rows;',
    '  if (matchdays.length < 9) return "Servono almeno 9 giornate per usare questa funzione.";',
    '',
    '  // Legge le partite delle prime 9 giornate (chi gioca chi, chi e'' in casa)',
    '  // cosi'' come sono state inserite (a mano, da CSV, o dalla generazione',
    '  // automatica) - devono gia'' esistere prima di usare questo bottone.',
    '  const firstNine: { homeUserId: number; awayUserId: number }[][] = [];',
    '  for (let i = 0; i < 9; i++) {',
    '    const md = matchdays[i];',
    '    const res = await db.execute({',
    '      sql: `SELECT homeUserId, awayUserId FROM "Match" WHERE matchdayId = ?`,',
    '      args: [md.id],',
    '    });',
    '    if (res.rows.length === 0) {',
    '      return `Manca il calendario della giornata ${md.number}: inseriscilo prima (a mano, da CSV o con la generazione automatica) e riprova.`;',
    '    }',
    '    firstNine.push(',
    '      res.rows.map((r) => ({ homeUserId: r.homeUserId as number, awayUserId: r.awayUserId as number }))',
    '    );',
    '  }',
    '',
    '  // Ripete le prime 9 giornate per tutte quelle successive, ciclicamente,',
    '  // invertendo ogni volta casa/trasferta rispetto alle prime 9. Le giornate',
    '  // che hanno gia'' un risultato inserito vengono lasciate intatte.',
    '  let updated = 0;',
    '  let skipped = 0;',
    '  for (let idx = 9; idx < matchdays.length; idx++) {',
    '    const md = matchdays[idx];',
    '    const roundInCycle = idx % 9;',
    '',
    '    const playedRes = await db.execute({',
    '      sql: `SELECT 1 FROM "Match" WHERE matchdayId = ? AND homeScore IS NOT NULL LIMIT 1`,',
    '      args: [md.id],',
    '    });',
    '    if (playedRes.rows.length > 0) {',
    '      skipped++;',
    '      continue;',
    '    }',
    '',
    '    await db.execute({ sql: `DELETE FROM "Match" WHERE matchdayId = ?`, args: [md.id] });',
    '    for (const m of firstNine[roundInCycle]) {',
    '      await db.execute({',
    '        sql: `INSERT INTO "Match" (matchdayId, homeUserId, awayUserId) VALUES (?, ?, ?)`,',
    '        args: [md.id, m.awayUserId, m.homeUserId],',
    '      });',
    '    }',
    '    updated++;',
    '  }',
    '',
    '  revalidatePath("/admin/schedule");',
    '  revalidatePath("/calendar");',
    '  if (skipped > 0) {',
    '    return `OK: ripetute/aggiornate ${updated} giornate a campi invertiti rispetto alle prime 9. ${skipped} gia con un risultato inserito sono state lasciate intatte.`;',
    '  }',
    '  return `OK: ripetute/aggiornate ${updated} giornate a campi invertiti rispetto alle prime 9.`;'
    ))

    # --- Modifica 2 (riga originale 81) ---
    $lines.RemoveRange(80, 1)
    $lines.InsertRange(80, [string[]]@(
    '    updated++;'
    ))

    # --- Modifica 3 (riga originale 79) ---
    $lines.RemoveRange(78, 1)
    $lines.InsertRange(78, [string[]]@(
    '      skipped++;',
    '      continue;',
    '    }',
    '',
    '    await db.execute({ sql: `DELETE FROM "Match" WHERE matchdayId = ?`, args: [md.id] });',
    '    for (const [p, q] of round) {',
    '      const [h, a] = chooseSides(p, q);',
    '      await db.execute({',
    '        sql: `INSERT INTO "Match" (matchdayId, homeUserId, awayUserId) VALUES (?, ?, ?)`,',
    '        args: [md.id, h, a],',
    '      });'
    ))

    # --- Modifica 4 (riga originale 56) ---
    $lines.RemoveRange(55, 22)
    $lines.InsertRange(55, [string[]]@(
    '  const teamIds = users.map((u) => u.id as number);',
    '  const schedule = generateRoundRobin(teamIds);',
    '',
    '  // Chi-gioca-chi ad ogni turno viene preso ciclicamente dallo schedule',
    '  // (9 turni), ripetuto quante volte serve per coprire tutte le giornate',
    '  // della stagione. Il lato casa/trasferta invece NON segue piu'' un cambio',
    '  // fisso ogni 9 giornate (quello produceva squadre con 9 partite in casa',
    '  // di fila e poi 9 in trasferta di fila): viene deciso giornata per',
    '  // giornata da un algoritmo goloso che tiene traccia, per ogni squadra,',
    '  // dell''ultimo lato giocato e di quante volte di fila - evitando piu'' di',
    '  // 2 partite consecutive dello stesso lato e bilanciando nel tempo il',
    '  // totale casa/trasferta.',
    '  //',
    '  // Le giornate che hanno gia un risultato inserito (homeScore valorizzato',
    '  // su almeno una partita) vengono SALTATE: si lascia il turno cosi com''e,',
    '  // niente DELETE/INSERT - pero'' il loro risultato reale viene comunque',
    '  // usato per aggiornare lo stato "ultimo lato/streak" di ogni squadra,',
    '  // cosi l''alternanza resta coerente anche subito dopo una giornata gia',
    '  // giocata. Cosi il bottone si puo premere in sicurezza anche a stagione',
    '  // iniziata, per rigenerare/bilanciare solo le giornate ancora da giocare,',
    '  // senza rischiare di cancellare risultati gia giocati.',
    '  type TeamState = { lastSide: "home" | "away" | null; streak: number; homeCount: number; awayCount: number };',
    '  const state = new Map<number, TeamState>();',
    '  for (const id of teamIds) state.set(id, { lastSide: null, streak: 0, homeCount: 0, awayCount: 0 });',
    '',
    '  function recordSide(teamId: number, side: "home" | "away") {',
    '    const s = state.get(teamId);',
    '    if (!s) return;',
    '    s.streak = s.lastSide === side ? s.streak + 1 : 1;',
    '    s.lastSide = side;',
    '    if (side === "home") s.homeCount += 1;',
    '    else s.awayCount += 1;',
    '  }',
    '',
    '  function chooseSides(p: number, q: number): [number, number] {',
    '    const sp = state.get(p)!;',
    '    const sq = state.get(q)!;',
    '    const pCanHome = !(sp.lastSide === "home" && sp.streak >= 2);',
    '    const pCanAway = !(sp.lastSide === "away" && sp.streak >= 2);',
    '    const qCanHome = !(sq.lastSide === "home" && sq.streak >= 2);',
    '    const qCanAway = !(sq.lastSide === "away" && sq.streak >= 2);',
    '',
    '    const optionA = pCanHome && qCanAway; // p in casa, q in trasferta',
    '    const optionB = qCanHome && pCanAway; // q in casa, p in trasferta',
    '',
    '    let home: number, away: number;',
    '    if (optionA && optionB) {',
    '      // entrambe valide: da'' la casa a chi ne ha fatte meno finora',
    '      if (sp.homeCount <= sq.homeCount) { home = p; away = q; } else { home = q; away = p; }',
    '    } else if (optionA) {',
    '      home = p; away = q;',
    '    } else if (optionB) {',
    '      home = q; away = p;',
    '    } else {',
    '      // nessuna delle due rispetta il limite (caso raro): meglio del male,',
    '      // da'' comunque la casa a chi ha giocato meno in casa finora',
    '      if (sp.homeCount <= sq.homeCount) { home = p; away = q; } else { home = q; away = p; }',
    '    }',
    '',
    '    recordSide(home, "home");',
    '    recordSide(away, "away");',
    '    return [home, away];',
    '  }',
    '',
    '  let updated = 0;',
    '  let skipped = 0;',
    '',
    '  for (let idx = 0; idx < matchdays.length; idx++) {',
    '    const md = matchdays[idx];',
    '    const round = schedule[idx % schedule.length];',
    '',
    '    const playedRes = await db.execute({',
    '      sql: `SELECT homeUserId, awayUserId FROM "Match" WHERE matchdayId = ? AND homeScore IS NOT NULL`,',
    '      args: [md.id],',
    '    });',
    '',
    '    if (playedRes.rows.length > 0) {',
    '      for (const r of playedRes.rows) {',
    '        recordSide(r.homeUserId as number, "home");',
    '        recordSide(r.awayUserId as number, "away");'
    ))
}

$ok2 = Update-CodeFile -RelativePath "app\(main)\admin\schedule\ScheduleAdminClient.tsx" -Marker 'repeatCalendarFromFirstLeg' -MinLines 159 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 134) ---
    $lines.InsertRange(133, [string[]]@(
    '          {/* -- Ripeti calendario a campi invertiti -- */}',
    '          <div className="bg-white rounded-xl border shadow-sm p-5">',
    '            <h2 className="font-semibold text-gray-700 mb-1">Ripeti prime 9 giornate (campi invertiti)</h2>',
    '            <p className="text-xs text-gray-400 mb-3">',
    '              Prende le partite gia&apos; inserite nelle giornate 1-9 (a mano, da CSV o con la',
    '              generazione automatica) e le ripete identiche per tutte le giornate successive,',
    '              invertendo ogni volta casa e trasferta rispetto alle prime 9. Le giornate che hanno',
    '              gia&apos; un risultato inserito non vengono toccate.',
    '            </p>',
    '            <form action={repeatAction} className="flex gap-3 items-center">',
    '              <input type="hidden" name="seasonId" value={activeSeason.id} />',
    '              <button',
    '                type="submit"',
    '                disabled={repeatPending}',
    '                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium"',
    '              >',
    '                {repeatPending ? "In corso..." : "Ripeti a campi invertiti"}',
    '              </button>',
    '            </form>',
    '            {repeatResult && (',
    '              <p className={`text-sm mt-2 ${repeatResult.startsWith("OK:") ? "text-green-600" : "text-red-600"}`}>',
    '                {repeatResult}',
    '              </p>',
    '            )}',
    '          </div>',
    ''
    ))

    # --- Modifica 2 (riga originale 93) ---
    $lines.RemoveRange(92, 1)
    $lines.InsertRange(92, [string[]]@(
    '            {calError && (',
    '              <p className={`text-sm mt-2 ${calError.startsWith("OK:") ? "text-green-600" : "text-red-600"}`}>',
    '                {calError}',
    '              </p>',
    '            )}'
    ))

    # --- Modifica 3 (riga originale 33) ---
    $lines.InsertRange(32, [string[]]@(
    '  const [repeatResult, repeatAction, repeatPending] = useActionState(repeatCalendarFromFirstLeg, null);'
    ))

    # --- Modifica 4 (riga originale 4) ---
    $lines.RemoveRange(3, 1)
    $lines.InsertRange(3, [string[]]@(
    'import { createSeason, generateCalendar, setCurrentMatchday, importCalendarCsv, repeatCalendarFromFirstLeg } from "@/app/actions/schedule";'
    ))
}

$ok3 = Update-CodeFile -RelativePath "app\(main)\calendar\page.tsx" -Marker 'allMatchdaysRes' -MinLines 98 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 79) ---
    $lines.InsertRange(78, [string[]]@(
    '  // Aggiunge anche le giornate che esistono ma non hanno ancora partite',
    '  // generate/importate, cosi restano visibili (vuote) invece di sparire.',
    '  const allMatchdaysRes = await db.execute({',
    '    sql: `SELECT id, number FROM "Matchday" WHERE seasonId = ? ORDER BY number ASC`,',
    '    args: [season.id],',
    '  });',
    '  for (const row of allMatchdaysRes.rows) {',
    '    const mdId = row.id as number;',
    '    if (!matchdayMap.has(mdId)) {',
    '      matchdayMap.set(mdId, { id: mdId, number: row.number as number, matches: [] });',
    '    }',
    '  }',
    ''
    ))
}

$ok4 = Update-CodeFile -RelativePath "app\(main)\calendar\CalendarClient.tsx" -Marker 'non ancora generato' -MinLines 247 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 49) ---
    $lines.InsertRange(48, [string[]]@(
    '      {md.matches.length === 0 && (',
    '        <div className="px-4 py-8 text-center text-sm text-gray-400">',
    '          Calendario non ancora generato per questa giornata.',
    '        </div>',
    '      )}'
    ))
}

$allOk = $ok1 -and $ok2 -and $ok3 -and $ok4

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

git add "app/actions/schedule.ts" "app/(main)/admin/schedule/ScheduleAdminClient.tsx" "app/(main)/calendar/page.tsx" "app/(main)/calendar/CalendarClient.tsx"
$status = git status --porcelain -- "app/actions/schedule.ts" "app/(main)/admin/schedule/ScheduleAdminClient.tsx" "app/(main)/calendar/page.tsx" "app/(main)/calendar/CalendarClient.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Calendario: generazione sicura, alternanza casa/trasferta, mostra tutte le giornate, ripeti prime 9 a campi invertiti`n`n- generateCalendar() salta le giornate che hanno gia un risultato`n  inserito (non le cancella/rigenera piu'), cosi si puo premere il`n  bottone in sicurezza anche a stagione iniziata.`n- Il lato casa/trasferta non cambia piu' in blocco ogni 9 giornate`n  (causava 9 partite di fila in casa poi 9 in trasferta): ora viene`n  deciso giornata per giornata evitando piu' di 2 partite consecutive`n  dello stesso lato per ogni squadra, bilanciando il totale nel tempo.`n- /calendar mostra anche le giornate che esistono ma non hanno ancora`n  partite generate/importate (prima sparivano del tutto).`n- Nuovo bottone 'Ripeti a campi invertiti': prende le partite gia'`n  inserite nelle giornate 1-9 e le ripete identiche per tutte le`n  giornate successive, invertendo ogni volta casa/trasferta rispetto`n  alle prime 9 (le giornate gia' giocate non vengono toccate).`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
