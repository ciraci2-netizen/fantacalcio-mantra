$ErrorActionPreference = 'Stop'
Write-Host '=== Coppe: gironi automatici con classifica (fase a gruppi + eliminazione diretta) ===' -ForegroundColor Cyan

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

$ok0 = New-CodeFile -RelativePath "app\lib\cupStandings.ts" -ContentLines @(
    '// Calcola la classifica di un girone di Coppa (fase a gruppi) a partire'
    '// dalle partite del turno. Punti: vittoria 3, pareggio 1, sconfitta 0.'
    '// Spareggio: punti -> differenza punteggio -> punteggio totale fatto.'
    '// Pura funzione, senza accesso al DB, cosi'' e'' riusabile sia lato admin'
    '// (app/(main)/admin/coppe) sia lato pubblico (app/(main)/coppe).'
    ''
    'export type CupGroupMatch = {'
    '  homeUserId: number;'
    '  awayUserId: number;'
    '  homeTeam: string;'
    '  awayTeam: string;'
    '  homeScore: number | null;'
    '  awayScore: number | null;'
    '};'
    ''
    'export type CupStandingRow = {'
    '  userId: number;'
    '  teamName: string;'
    '  played: number;'
    '  wins: number;'
    '  draws: number;'
    '  losses: number;'
    '  points: number;'
    '  scoreFor: number;'
    '  scoreAgainst: number;'
    '  diff: number;'
    '};'
    ''
    'export function computeGroupStandings(matches: CupGroupMatch[]): CupStandingRow[] {'
    '  const table = new Map<number, CupStandingRow>();'
    ''
    '  const ensure = (id: number, name: string) => {'
    '    let row = table.get(id);'
    '    if (!row) {'
    '      row = {'
    '        userId: id,'
    '        teamName: name,'
    '        played: 0,'
    '        wins: 0,'
    '        draws: 0,'
    '        losses: 0,'
    '        points: 0,'
    '        scoreFor: 0,'
    '        scoreAgainst: 0,'
    '        diff: 0,'
    '      };'
    '      table.set(id, row);'
    '    }'
    '    return row;'
    '  };'
    ''
    '  for (const m of matches) {'
    '    const home = ensure(m.homeUserId, m.homeTeam);'
    '    const away = ensure(m.awayUserId, m.awayTeam);'
    ''
    '    if (m.homeScore === null || m.awayScore === null) continue;'
    ''
    '    home.played += 1;'
    '    away.played += 1;'
    '    home.scoreFor += m.homeScore;'
    '    home.scoreAgainst += m.awayScore;'
    '    away.scoreFor += m.awayScore;'
    '    away.scoreAgainst += m.homeScore;'
    ''
    '    if (m.homeScore > m.awayScore) {'
    '      home.wins += 1;'
    '      home.points += 3;'
    '      away.losses += 1;'
    '    } else if (m.homeScore < m.awayScore) {'
    '      away.wins += 1;'
    '      away.points += 3;'
    '      home.losses += 1;'
    '    } else {'
    '      home.draws += 1;'
    '      away.draws += 1;'
    '      home.points += 1;'
    '      away.points += 1;'
    '    }'
    '  }'
    ''
    '  const rows = [...table.values()];'
    '  for (const r of rows) r.diff = r.scoreFor - r.scoreAgainst;'
    '  rows.sort('
    '    (a, b) => b.points - a.points || b.diff - a.diff || b.scoreFor - a.scoreFor'
    '  );'
    '  return rows;'
    '}'
)

$ok1 = Update-CodeFile -RelativePath "app\actions\cups.ts" -Marker 'createCupGroup' -MinLines 102 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 47) ---
    $lines.InsertRange(46, [string[]]@(
    '// Crea un girone (fase a gruppi): un turno di tipo ''girone'' con dentro',
    '// gia'' tutte le partite di andata unica fra le squadre scelte (round-robin',
    '// completo - ogni squadra gioca contro tutte le altre una volta sola).',
    'export async function createCupGroup(prevState: unknown, formData: FormData) {',
    '  try {',
    '    await requireAdmin();',
    '    const db = getDb();',
    '    const cupId = Number(formData.get("cupId"));',
    '    const name = (formData.get("name") as string)?.trim();',
    '    if (!name) return { error: "Inserisci il nome del girone." };',
    '',
    '    const userIds = [',
    '      ...new Set(',
    '        formData',
    '          .getAll("userIds")',
    '          .map((v) => Number(v))',
    '          .filter((n) => Number.isInteger(n) && n > 0)',
    '      ),',
    '    ];',
    '    if (userIds.length < 3) return { error: "Seleziona almeno 3 squadre per il girone." };',
    '',
    '    const countRes = await db.execute({ sql: `SELECT COUNT(*) as n FROM "CupRound" WHERE cupId = ?`, args: [cupId] });',
    '    const number = Number(countRes.rows[0].n) + 1;',
    '',
    '    let cupRoundId: number;',
    '    try {',
    '      const roundRes = await db.execute({',
    '        sql: `INSERT INTO "CupRound" (cupId, name, number, type) VALUES (?, ?, ?, ''girone'')`,',
    '        args: [cupId, name, number],',
    '      });',
    '      cupRoundId = Number(roundRes.lastInsertRowid);',
    '    } catch {',
    '      return {',
    '        error:',
    '          ''Devi prima eseguire la migrazione del database: vai su Admin e premi "Esegui migrazione DB", poi riprova a creare il girone.'',',
    '      };',
    '    }',
    '',
    '    for (let i = 0; i < userIds.length; i++) {',
    '      for (let j = i + 1; j < userIds.length; j++) {',
    '        await db.execute({',
    '          sql: `INSERT INTO "CupMatch" (cupRoundId, homeUserId, awayUserId) VALUES (?, ?, ?)`,',
    '          args: [cupRoundId, userIds[i], userIds[j]],',
    '        });',
    '      }',
    '    }',
    '',
    '    revalidatePath("/coppe");',
    '    revalidatePath("/admin/coppe");',
    '    return { success: true };',
    '  } catch (e) {',
    '    return { error: (e as Error).message };',
    '  }',
    '}',
    '',
    '// Elimina un intero turno/girone (e le sue partite) - utile per correggere',
    '// un girone creato con le squadre sbagliate senza dover cancellare tutta',
    '// la coppa.',
    'export async function deleteCupRound(prevState: unknown, formData: FormData) {',
    '  try {',
    '    await requireAdmin();',
    '    const db = getDb();',
    '    const cupRoundId = Number(formData.get("cupRoundId"));',
    '    await db.execute({ sql: `DELETE FROM "CupMatch" WHERE cupRoundId = ?`, args: [cupRoundId] });',
    '    await db.execute({ sql: `DELETE FROM "CupRound" WHERE id = ?`, args: [cupRoundId] });',
    '    revalidatePath("/coppe");',
    '    revalidatePath("/admin/coppe");',
    '    return { success: true };',
    '  } catch (e) {',
    '    return { error: (e as Error).message };',
    '  }',
    '}',
    ''
    ))
}

$ok2 = Update-CodeFile -RelativePath "app\actions\dbMigrate.ts" -Marker 'Coppe con fase a gironi' -MinLines 288 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 241) ---
    $lines.InsertRange(240, [string[]]@(
    '  // Coppe con fase a gironi: un CupRound puo'' essere un girone (round-robin',
    '  // fra piu'' squadre, con classifica calcolata dai risultati) invece che un',
    '  // turno a eliminazione diretta come prima. Default ''eliminazione'' per non',
    '  // toccare i turni gia'' esistenti.',
    '  try { await db.execute(`ALTER TABLE "CupRound" ADD COLUMN "type" TEXT NOT NULL DEFAULT ''eliminazione''`); } catch { /* gia presente */ }',
    ''
    ))
}

$ok3 = Update-CodeFile -RelativePath "app\(main)\admin\coppe\page.tsx" -Marker 'ancora migrato, ricadiamo' -MinLines 64 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 38) ---
    $lines.InsertRange(37, [string[]]@(
    '            type: ((round.type as string | undefined) ?? "eliminazione") as "eliminazione" | "girone",'
    ))

    # --- Modifica 2 (riga originale 22) ---
    $lines.RemoveRange(21, 1)
    $lines.InsertRange(21, [string[]]@(
    '      // "type" e'' una colonna aggiunta dopo (fase a gironi) - se il DB non e''',
    '      // ancora migrato, ricadiamo su un turno "eliminazione" per tutti.',
    '      let roundsRes;',
    '      try {',
    '        roundsRes = await db.execute({ sql: `SELECT id, name, number, type FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`, args: [cup.id] });',
    '      } catch {',
    '        roundsRes = await db.execute({ sql: `SELECT id, name, number FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`, args: [cup.id] });',
    '      }'
    ))
}

$ok4 = Update-CodeFile -RelativePath "app\(main)\admin\coppe\AdminCoppeClient.tsx" -Marker 'createCupGroup' -MinLines 109 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 101) ---
    $lines.RemoveRange(100, 2)
    $lines.InsertRange(100, [string[]]@(
    '            );',
    '          })}'
    ))

    # --- Modifica 2 (riga originale 99) ---
    $lines.RemoveRange(98, 1)
    $lines.InsertRange(98, [string[]]@(
    '                )}',
    '',
    '                {/* Add match (solo turni a eliminazione: nei gironi le partite sono gia tutte generate) */}',
    '                {!isGroup && (',
    '                  <form action={matchAction} className="flex flex-wrap gap-2 items-end mb-4">',
    '                    <input type="hidden" name="cupRoundId" value={round.id} />',
    '                    <div>',
    '                      <label className="block text-xs text-gray-500 mb-1">Casa</label>',
    '                      <select name="homeUserId" required className="border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none">',
    '                        {users.map((u) => <option key={u.id} value={u.id}>{u.teamName}</option>)}',
    '                      </select>',
    '                    </div>',
    '                    <span className="text-gray-400 pb-1">vs</span>',
    '                    <div>',
    '                      <label className="block text-xs text-gray-500 mb-1">Trasferta</label>',
    '                      <select name="awayUserId" required className="border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none">',
    '                        {users.map((u) => <option key={u.id} value={u.id}>{u.teamName}</option>)}',
    '                      </select>',
    '                    </div>',
    '                    <button type="submit" disabled={matchPending} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm">+Partita</button>',
    '                  </form>',
    '                )}',
    '',
    '                {/* Matches */}',
    '                <div className="space-y-2">',
    '                  {round.matches.map((m) => (',
    '                    <div key={m.id} className="flex flex-wrap items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">',
    '                      <span className="font-medium text-sm flex-1 text-right">{m.homeTeam}</span>',
    '                      <form action={scoreAction} className="flex items-center gap-1">',
    '                        <input type="hidden" name="matchId" value={m.id} />',
    '                        <input type="number" name="homeScore" step="0.1" defaultValue={m.homeScore ?? ""} placeholder="0.0" className="w-16 border rounded px-1 py-0.5 text-sm text-center" />',
    '                        <span className="text-gray-400">{"\u2014"}</span>',
    '                        <input type="number" name="awayScore" step="0.1" defaultValue={m.awayScore ?? ""} placeholder="0.0" className="w-16 border rounded px-1 py-0.5 text-sm text-center" />',
    '                        <button type="submit" disabled={scorePending} className="px-2 py-0.5 bg-green-600 text-white rounded text-xs">{"\u2713"}</button>',
    '                      </form>',
    '                      <span className="font-medium text-sm flex-1">{m.awayTeam}</span>',
    '                    </div>',
    '                  ))}',
    '                </div>'
    ))

    # --- Modifica 3 (riga originale 85) ---
    $lines.RemoveRange(84, 13)
    $lines.InsertRange(84, [string[]]@(
    '                {/* Classifica (solo gironi) */}',
    '                {isGroup && standings.length > 0 && (',
    '                  <div className="overflow-x-auto mb-4 border rounded-lg">',
    '                    <table className="w-full text-sm">',
    '                      <thead>',
    '                        <tr className="text-gray-400 text-xs uppercase tracking-wide bg-gray-50">',
    '                          <th className="text-left font-medium px-3 py-1.5">#</th>',
    '                          <th className="text-left font-medium px-3 py-1.5">Squadra</th>',
    '                          <th className="text-center font-medium px-2 py-1.5">PG</th>',
    '                          <th className="text-center font-medium px-2 py-1.5">V</th>',
    '                          <th className="text-center font-medium px-2 py-1.5">N</th>',
    '                          <th className="text-center font-medium px-2 py-1.5">P</th>',
    '                          <th className="text-center font-medium px-2 py-1.5">DR</th>',
    '                          <th className="text-center font-medium px-3 py-1.5">Pt</th>',
    '                        </tr>',
    '                      </thead>',
    '                      <tbody>',
    '                        {standings.map((s, i) => (',
    '                          <tr key={s.userId} className={`border-t ${i < qualifyCount ? "bg-green-50" : ""}`}>',
    '                            <td className={`px-3 py-1.5 ${i < qualifyCount ? "text-green-700 font-semibold" : "text-gray-400"}`}>{i + 1}</td>',
    '                            <td className="px-3 py-1.5 text-gray-700">{s.teamName}</td>',
    '                            <td className="text-center px-2 py-1.5 text-gray-500">{s.played}</td>',
    '                            <td className="text-center px-2 py-1.5 text-gray-500">{s.wins}</td>',
    '                            <td className="text-center px-2 py-1.5 text-gray-500">{s.draws}</td>',
    '                            <td className="text-center px-2 py-1.5 text-gray-500">{s.losses}</td>',
    '                            <td className="text-center px-2 py-1.5 text-gray-500 tabular-nums">{s.diff > 0 ? `+${s.diff.toFixed(1)}` : s.diff.toFixed(1)}</td>',
    '                            <td className="text-center px-3 py-1.5 font-bold text-gray-800">{s.points}</td>',
    '                          </tr>',
    '                        ))}',
    '                      </tbody>',
    '                    </table>'
    ))

    # --- Modifica 4 (riga originale 82) ---
    $lines.RemoveRange(81, 2)

    # --- Modifica 5 (riga originale 66) ---
    $lines.RemoveRange(65, 15)
    $lines.InsertRange(65, [string[]]@(
    '          {/* Rounds */}',
    '          {cup.rounds.map((round) => {',
    '            const isGroup = round.type === "girone";',
    '            const standings = isGroup ? computeGroupStandings(round.matches) : [];',
    '            const qualifyCount = Math.min(4, standings.length);',
    '            return (',
    '              <div key={round.id} className="p-4 border-b last:border-0">',
    '                <div className="flex items-center justify-between mb-3">',
    '                  <h4 className="font-semibold text-gray-700">',
    '                    {round.name} {isGroup && <span className="text-xs font-normal text-amber-600 ml-1">(girone)</span>}',
    '                  </h4>',
    '                  <form action={deleteRoundAction} onSubmit={(e) => { if (!confirm(`Eliminare il turno "${round.name}" e le sue partite?`)) e.preventDefault(); }}>',
    '                    <input type="hidden" name="cupRoundId" value={round.id} />',
    '                    <button type="submit" className="text-xs text-red-500 hover:text-red-700 hover:underline">Elimina turno</button>',
    '                  </form>'
    ))

    # --- Modifica 6 (riga originale 61) ---
    $lines.RemoveRange(60, 4)
    $lines.InsertRange(60, [string[]]@(
    '          {/* Add group (girone: round-robin automatico fra le squadre scelte) */}',
    '          <div className="p-4 border-b bg-amber-50/40">',
    '            <h3 className="text-sm font-medium text-gray-600 mb-2">Aggiungi girone</h3>',
    '            <p className="text-xs text-gray-400 mb-2">Seleziona le squadre del girone: vengono generate in automatico tutte le partite (ognuna gioca contro tutte le altre una volta).</p>',
    '            <form action={groupAction} className="space-y-3">',
    '              <input type="hidden" name="cupId" value={cup.id} />',
    '              <input type="text" name="name" required placeholder="es. Girone A" className="w-full sm:w-64 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:outline-none" />',
    '              <div className="flex flex-wrap gap-x-4 gap-y-2">',
    '                {users.map((u) => (',
    '                  <label key={u.id} className="flex items-center gap-1.5 text-sm text-gray-700">',
    '                    <input type="checkbox" name="userIds" value={u.id} className="rounded border-gray-300" />',
    '                    {u.teamName}',
    '                  </label>',
    '                ))}',
    '              </div>',
    '              <button type="submit" disabled={groupPending} className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">+Girone</button>',
    '            </form>',
    '            {groupState?.error && <p className="text-red-600 text-sm mt-2">{groupState.error}</p>}',
    '            {groupState?.success && <p className="text-green-600 text-sm mt-2">Girone creato con le partite gia generate.</p>}',
    '          </div>'
    ))

    # --- Modifica 7 (riga originale 59) ---
    $lines.InsertRange(58, [string[]]@(
    '            {roundState?.error && <p className="text-red-600 text-sm mt-2">{roundState.error}</p>}'
    ))

    # --- Modifica 8 (riga originale 51) ---
    $lines.RemoveRange(50, 1)
    $lines.InsertRange(50, [string[]]@(
    '            <h3 className="text-sm font-medium text-gray-600 mb-2">Aggiungi turno a eliminazione diretta</h3>',
    '            <p className="text-xs text-gray-400 mb-2">Per quarti, semifinale, finale {"\u2014"} le partite si aggiungono a mano una alla volta scegliendo le due squadre.</p>'
    ))

    # --- Modifica 9 (riga originale 49) ---
    $lines.RemoveRange(48, 1)
    $lines.InsertRange(48, [string[]]@(
    '          {/* Add round (eliminazione diretta: si aggiungono le partite a mano) */}'
    ))

    # --- Modifica 10 (riga originale 38) ---
    $lines.InsertRange(37, [string[]]@(
    '      {deleteRoundState?.error && <p className="text-red-600 text-sm">{deleteRoundState.error}</p>}',
    ''
    ))

    # --- Modifica 11 (riga originale 17) ---
    $lines.InsertRange(16, [string[]]@(
    '  const [deleteRoundState, deleteRoundAction] = useActionState(deleteCupRound, null);'
    ))

    # --- Modifica 12 (riga originale 14) ---
    $lines.InsertRange(13, [string[]]@(
    '  const [groupState, groupAction, groupPending] = useActionState(createCupGroup, null);'
    ))

    # --- Modifica 13 (riga originale 7) ---
    $lines.RemoveRange(6, 1)
    $lines.InsertRange(6, [string[]]@(
    'type Round = { id: number; name: string; number: number; type: "eliminazione" | "girone"; matches: Match[] };'
    ))

    # --- Modifica 14 (riga originale 4) ---
    $lines.RemoveRange(3, 1)
    $lines.InsertRange(3, [string[]]@(
    'import { createCup, createCupRound, createCupGroup, createCupMatch, setCupMatchScore, deleteCup, deleteCupRound } from "@/app/actions/cups";',
    'import { computeGroupStandings } from "@/app/lib/cupStandings";'
    ))
}

$ok5 = Update-CodeFile -RelativePath "app\(main)\coppe\page.tsx" -Marker 'computeGroupStandings' -MinLines 236 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 237) ---
    $lines.InsertRange(236, [string[]]@(
    '',
    'function GroupStandings({',
    '  round,',
    '  currentUserId,',
    '}: {',
    '  round: CupRound;',
    '  currentUserId: number;',
    '}) {',
    '  const standings = computeGroupStandings(round.matches);',
    '  const qualifyCount = Math.min(4, standings.length);',
    '',
    '  return (',
    '    <div className="border rounded-xl overflow-hidden">',
    '      <div className="bg-gray-50 px-4 py-2.5 border-b">',
    '        <h3 className="font-semibold text-gray-700 text-sm">{round.name}</h3>',
    '      </div>',
    '      <div className="overflow-x-auto">',
    '        <table className="w-full text-sm">',
    '          <thead>',
    '            <tr className="text-gray-400 text-xs uppercase tracking-wide">',
    '              <th className="text-left font-medium px-3 py-2">#</th>',
    '              <th className="text-left font-medium px-3 py-2">Squadra</th>',
    '              <th className="text-center font-medium px-2 py-2">PG</th>',
    '              <th className="text-center font-medium px-2 py-2">V</th>',
    '              <th className="text-center font-medium px-2 py-2">N</th>',
    '              <th className="text-center font-medium px-2 py-2">P</th>',
    '              <th className="text-center font-medium px-2 py-2">DR</th>',
    '              <th className="text-center font-medium px-3 py-2">Pt</th>',
    '            </tr>',
    '          </thead>',
    '          <tbody>',
    '            {standings.map((s, i) => {',
    '              const qualified = i < qualifyCount;',
    '              const isMe = s.userId === currentUserId;',
    '              return (',
    '                <tr',
    '                  key={s.userId}',
    '                  className={`border-t ${qualified ? "bg-green-50" : ""} ${isMe ? "font-semibold" : ""}`}',
    '                >',
    '                  <td className={`px-3 py-2 ${qualified ? "text-green-700" : "text-gray-400"}`}>{i + 1}</td>',
    '                  <td className={`px-3 py-2 truncate max-w-[160px] ${isMe ? "text-green-700" : "text-gray-700"}`}>',
    '                    {s.teamName}',
    '                  </td>',
    '                  <td className="text-center px-2 py-2 text-gray-500">{s.played}</td>',
    '                  <td className="text-center px-2 py-2 text-gray-500">{s.wins}</td>',
    '                  <td className="text-center px-2 py-2 text-gray-500">{s.draws}</td>',
    '                  <td className="text-center px-2 py-2 text-gray-500">{s.losses}</td>',
    '                  <td className="text-center px-2 py-2 text-gray-500 tabular-nums">',
    '                    {s.diff > 0 ? `+${s.diff.toFixed(1)}` : s.diff.toFixed(1)}',
    '                  </td>',
    '                  <td className="text-center px-3 py-2 font-bold text-gray-800">{s.points}</td>',
    '                </tr>',
    '              );',
    '            })}',
    '          </tbody>',
    '        </table>',
    '      </div>',
    '      {qualifyCount > 0 && (',
    '        <div className="px-4 py-2 border-t bg-green-50/60 text-xs text-green-700">',
    '          {"\u2713"} Le prime {qualifyCount} passano il turno',
    '        </div>',
    '      )}',
    '    </div>',
    '  );',
    '}'
    ))

    # --- Modifica 2 (riga originale 155) ---
    $lines.RemoveRange(154, 3)
    $lines.InsertRange(154, [string[]]@(
    '',
    '            {cup.rounds.length === 0 ? (',
    '              <div className="p-4 text-gray-400 text-sm">Nessun turno configurato.</div>',
    '            ) : (',
    '              <>',
    '                {/* Gironi: classifica per ognuno */}',
    '                {groupRounds.length > 0 && (',
    '                  <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 border-b">',
    '                    {groupRounds.map((round) => (',
    '                      <GroupStandings key={round.id} round={round} currentUserId={session.userId} />',
    '                    ))}',
    '                  </div>',
    '                )}',
    '',
    '                {/* Turni a eliminazione diretta: bracket a colonne */}',
    '                {knockoutRounds.length > 0 && (',
    '                  <div className="overflow-x-auto">',
    '                    <div className="flex min-w-max p-5 gap-0">',
    '                      {knockoutRounds.map((round, roundIdx) => {',
    '                        const isLast = roundIdx === knockoutRounds.length - 1;',
    '                        return (',
    '                          <div key={round.id} className="flex items-stretch">',
    '                            {/* Round column */}',
    '                            <div className="w-60">',
    '                              <div className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-4 text-center px-2 pb-2 border-b">',
    '                                {round.name}',
    '                              </div>',
    '                              <div className="flex flex-col justify-around h-full gap-4">',
    '                                {round.matches.length === 0 ? (',
    '                                  <p className="text-gray-300 text-sm text-center py-4">{"\u2013"}</p>',
    '                                ) : (',
    '                                  round.matches.map((m) => (',
    '                                    <MatchCard',
    '                                      key={m.id}',
    '                                      match={m}',
    '                                      currentUserId={session.userId}',
    '                                    />',
    '                                  ))',
    '                                )}',
    '                              </div>',
    '                            </div>',
    '',
    '                            {/* Connector arrow */}',
    '                            {!isLast && (',
    '                              <div className="w-10 flex items-center justify-center text-gray-200 text-2xl select-none shrink-0">',
    '                                {"\u2192"}',
    '                              </div>',
    '                            )}',
    '                          </div>',
    '                        );',
    '                      })}',
    '                    </div>',
    '                  </div>',
    '                )}',
    '              </>',
    '            )}',
    '          </div>',
    '        );',
    '      })}'
    ))

    # --- Modifica 3 (riga originale 114) ---
    $lines.RemoveRange(113, 40)
    $lines.InsertRange(113, [string[]]@(
    '        return (',
    '          <div key={cup.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">',
    '            <div className="bg-yellow-600 text-white px-5 py-3 font-bold text-lg flex items-center gap-2">',
    '              {"\ud83c\udfc6"} {cup.name}'
    ))

    # --- Modifica 4 (riga originale 108) ---
    $lines.RemoveRange(107, 5)
    $lines.InsertRange(107, [string[]]@(
    '      {cups.map((cup) => {',
    '        const groupRounds = cup.rounds.filter((r) => r.type === "girone");',
    '        const knockoutRounds = cup.rounds.filter((r) => r.type !== "girone");'
    ))

    # --- Modifica 5 (riga originale 85) ---
    $lines.InsertRange(84, [string[]]@(
    '            type: ((round.type as string | undefined) ?? "eliminazione") as "eliminazione" | "girone",'
    ))

    # --- Modifica 6 (riga originale 65) ---
    $lines.RemoveRange(64, 4)
    $lines.InsertRange(64, [string[]]@(
    '      // "type" e'' una colonna aggiunta dopo (fase a gironi) - se il DB non e''',
    '      // ancora migrato, ricadiamo su un turno "eliminazione" per tutti.',
    '      let roundsRes;',
    '      try {',
    '        roundsRes = await db.execute({',
    '          sql: `SELECT id, name, number, type FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`,',
    '          args: [cup.id],',
    '        });',
    '      } catch {',
    '        roundsRes = await db.execute({',
    '          sql: `SELECT id, name, number FROM "CupRound" WHERE cupId = ? ORDER BY number ASC`,',
    '          args: [cup.id],',
    '        });',
    '      }'
    ))

    # --- Modifica 7 (riga originale 21) ---
    $lines.InsertRange(20, [string[]]@(
    '  type: "eliminazione" | "girone";'
    ))

    # --- Modifica 8 (riga originale 4) ---
    $lines.InsertRange(3, [string[]]@(
    'import { computeGroupStandings } from "@/app/lib/cupStandings";'
    ))
}

$allOk = $ok0 -and $ok1 -and $ok2 -and $ok3 -and $ok4 -and $ok5

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

git add "app/lib/cupStandings.ts" "app/actions/cups.ts" "app/actions/dbMigrate.ts" "app/(main)/admin/coppe/page.tsx" "app/(main)/admin/coppe/AdminCoppeClient.tsx" "app/(main)/coppe/page.tsx"
$status = git status --porcelain -- "app/lib/cupStandings.ts" "app/actions/cups.ts" "app/actions/dbMigrate.ts" "app/(main)/admin/coppe/page.tsx" "app/(main)/admin/coppe/AdminCoppeClient.tsx" "app/(main)/coppe/page.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Coppe: fase a gironi con classifica automatica, oltre all'eliminazione diretta`n`nAggiunta la possibilita di creare un girone in una coppa: si scelgono le`nsquadre partecipanti e vengono generate in automatico tutte le partite`n(ognuna gioca contro tutte le altre una volta - es. 5 squadre = 4 partite`na testa). La classifica del girone si calcola da sola dai risultati`n(vittoria 3 punti, pareggio 1, sconfitta 0; spareggio su differenza e`npunteggio totale fatto) e le prime 4 vengono evidenziate come qualificate,`nsia in Admin che nella pagina Coppe pubblica.`n`nI turni a eliminazione diretta (quarti, semifinale, finale) restano come`nprima: si aggiungono a mano scegliendo le due squadre per ogni partita -`nutile ora per accoppiare chi si e qualificato dai gironi. Aggiunto anche`nun bottone per eliminare un turno/girone sbagliato senza dover ricreare`ntutta la coppa.`n`nRichiede una migrazione DB (nuova colonna type su CupRound): dopo il`ndeploy, vai su Admin e premi `"Esegui migrazione DB`" prima di creare il`nprimo girone.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
    Write-Host 'IMPORTANTE: dopo il deploy vai su Admin e premi "Esegui migrazione DB" prima di creare il primo girone.' -ForegroundColor Yellow
}
