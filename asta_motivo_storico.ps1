$ErrorActionPreference = 'Stop'
Write-Host '=== Asta: storico visibile a tutti + motivo esatto per gli svincolati ===' -ForegroundColor Cyan

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

function Set-CodeFile {
    param(
        [string]$RelativePath,
        [string]$Marker,
        [string[]]$NewContentLines
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

    $newText = [string]::Join("`r`n", $NewContentLines) + "`r`n"
    [System.IO.File]::WriteAllText($target, $newText, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "File riscritto: $RelativePath" -ForegroundColor Green
    return $true
}

$ok1 = Update-CodeFile -RelativePath "app\lib\auction.ts" -Marker 'INSERT INTO "AuctionUnsold"' -MinLines 330 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 276) ---
    $lines.RemoveRange(275, 3)
    $lines.InsertRange(275, [string[]]@(
    '      const reason = skippedForSlots ? "slot rosa pieni" : "fondi insufficienti";',
    '      unsold.push({ playerId, playerName: bids[0].playerName, reason });',
    '      // Salvato subito (non solo restituito) cosi lo storico puo mostrare il',
    '      // motivo esatto anche dopo che il round e chiuso da tempo - prima si',
    '      // perdeva non appena la risposta di questa funzione veniva scartata.',
    '      await db.execute({',
    '        sql: `INSERT INTO "AuctionUnsold" (roundId, playerId, reason) VALUES (?, ?, ?)`,',
    '        args: [roundId, playerId, reason],'
    ))
}

$ok2 = Update-CodeFile -RelativePath "app\lib\autoMigrate.ts" -Marker 'AuctionUnsold' -MinLines 193 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 96) ---
    $lines.InsertRange(95, [string[]]@(
    '    // Motivo esatto per cui un giocatore che aveva ricevuto offerte e''',
    '    // rimasto svincolato dopo la chiusura di un round (vedi resolveRound in',
    '    // app/lib/auction.ts) - senza questo, passato il momento della chiusura',
    '    // non c''era piu modo di distinguere "fondi insufficienti" da "slot rosa',
    '    // pieni" per un round gia risolto.',
    '    `CREATE TABLE IF NOT EXISTS "AuctionUnsold" (',
    '      id        INTEGER PRIMARY KEY AUTOINCREMENT,',
    '      roundId   INTEGER NOT NULL,',
    '      playerId  INTEGER NOT NULL,',
    '      reason    TEXT    NOT NULL,',
    '      createdAt TEXT    NOT NULL DEFAULT (datetime(''now''))',
    '    )`,'
    ))
}

$ok3 = Update-CodeFile -RelativePath "app\actions\dbMigrate.ts" -Marker 'AuctionUnsold' -MinLines 273 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 203) ---
    $lines.InsertRange(202, [string[]]@(
    '  // Motivo esatto per cui un giocatore che aveva ricevuto offerte e'' rimasto',
    '  // svincolato dopo la chiusura di un round (vedi resolveRound in',
    '  // app/lib/auction.ts) - senza questo, passato il momento della chiusura',
    '  // non c''era piu modo di distinguere "fondi insufficienti" da "slot rosa',
    '  // pieni" per un round gia risolto.',
    '  await db.execute(`CREATE TABLE IF NOT EXISTS "AuctionUnsold" (',
    '    id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '    roundId INTEGER NOT NULL,',
    '    playerId INTEGER NOT NULL,',
    '    reason TEXT NOT NULL,',
    '    createdAt TEXT NOT NULL DEFAULT (datetime(''now'')),',
    '    FOREIGN KEY (roundId) REFERENCES "AuctionRound"(id),',
    '    FOREIGN KEY (playerId) REFERENCES "Player"(id)',
    '  )`);',
    ''
    ))
}

$ok4 = Update-CodeFile -RelativePath "app\(main)\admin\asta\page.tsx" -Marker 'unsoldReason' -MinLines 114 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 97) ---
    $lines.InsertRange(96, [string[]]@(
    '          unsoldReason: unsoldReasons[b.playerId as number] ?? null,'
    ))

    # --- Modifica 2 (riga originale 84) ---
    $lines.InsertRange(83, [string[]]@(
    '',
    '      // Motivo esatto per cui un giocatore e'' rimasto svincolato in questo',
    '      // round (salvato da resolveRound al momento della chiusura). Assente',
    '      // per i round chiusi PRIMA di questa funzionalita'': in quel caso lo',
    '      // storico mostra solo il messaggio generico, senza motivo specifico.',
    '      const unsoldRes = await db.execute({',
    '        sql: `SELECT playerId, reason FROM "AuctionUnsold" WHERE roundId = ?`,',
    '        args: [r.id],',
    '      });',
    '      const unsoldReasons: Record<number, string> = {};',
    '      for (const u of unsoldRes.rows) {',
    '        unsoldReasons[u.playerId as number] = u.reason as string;',
    '      }',
    ''
    ))
}

$ok5 = Update-CodeFile -RelativePath "app\(main)\admin\asta\AdminAstaClient.tsx" -Marker 'unsoldReason' -MinLines 256 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 236) ---
    $lines.RemoveRange(235, 1)
    $lines.InsertRange(235, [string[]]@(
    '                                        {"\u26a0"} Rimasto svincolato',
    '                                        {(() => {',
    '                                          const reason = g.bids.find((b) => b.unsoldReason)?.unsoldReason;',
    '                                          return reason',
    '                                            ? `: ${reason}.`',
    '                                            : ": nessuna offerta e andata a buon fine (round chiuso prima che questo dettaglio fosse disponibile).";',
    '                                        })()}'
    ))

    # --- Modifica 2 (riga originale 22) ---
    $lines.InsertRange(21, [string[]]@(
    '  unsoldReason: string | null;'
    ))
}

$ok6 = Update-CodeFile -RelativePath "app\(main)\asta\page.tsx" -Marker 'pastRoundsRes' -MinLines 170 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 167) ---
    $lines.RemoveRange(166, 1)
    $lines.InsertRange(166, [string[]]@(
    '      <AstaHistory history={myHistory} myTeamName={session.teamName} />'
    ))

    # --- Modifica 2 (riga originale 82) ---
    $lines.RemoveRange(81, 1)
    $lines.InsertRange(81, [string[]]@(
    '        <AstaHistory history={myHistory} myTeamName={session.teamName} />'
    ))

    # --- Modifica 3 (riga originale 57) ---
    $lines.RemoveRange(56, 9)
    $lines.InsertRange(56, [string[]]@(
    '      const unsoldRes = await db.execute({',
    '        sql: `SELECT playerId, reason FROM "AuctionUnsold" WHERE roundId = ?`,',
    '        args: [r.id],',
    '      });',
    '      const unsoldReasons: Record<number, string> = {};',
    '      for (const u of unsoldRes.rows) unsoldReasons[u.playerId as number] = u.reason as string;',
    '',
    '      const bids: HistoryBid[] = bidsRes.rows.map((b) => ({',
    '        playerId: b.playerId as number,',
    '        playerName: b.playerName as string,',
    '        mantraRole: b.mantraRole as string,',
    '        teamName: b.teamName as string,',
    '        amount: b.amount as number,',
    '        status: b.status as string,',
    '        releasedPlayerName: (b.releasedPlayerName as string | null) ?? null,',
    '        unsoldReason: unsoldReasons[b.playerId as number] ?? null,',
    '      }));',
    '      return { roundId: r.id as number, roundName: r.name as string, resolvedAt: r.resolvedAt as string, bids };',
    '    })',
    '  );'
    ))

    # --- Modifica 4 (riga originale 46) ---
    $lines.RemoveRange(45, 10)
    $lines.InsertRange(45, [string[]]@(
    '  type HistoryBid = {',
    '    playerId: number; playerName: string; mantraRole: string; teamName: string;',
    '    amount: number; status: string; releasedPlayerName: string | null; unsoldReason: string | null;',
    '  };',
    '  const myHistory = await Promise.all(',
    '    pastRoundsRes.rows.map(async (r) => {',
    '      const bidsRes = await db.execute({',
    '        sql: `SELECT sb.playerId, sb.amount, sb.status, p.name as playerName, p.mantraRole,',
    '                     u.teamName, rp.name as releasedPlayerName',
    '              FROM "SealedBid" sb',
    '              JOIN "Player" p ON p.id = sb.playerId',
    '              JOIN "User" u ON u.id = sb.userId',
    '              LEFT JOIN "Player" rp ON rp.id = sb.releasePlayerId',
    '              WHERE sb.roundId = ?',
    '              ORDER BY sb.playerId ASC, sb.amount DESC`,',
    '        args: [r.id],'
    ))

    # --- Modifica 5 (riga originale 33) ---
    $lines.RemoveRange(32, 12)
    $lines.InsertRange(32, [string[]]@(
    '  // Storico completo: le offerte di TUTTI (non solo le proprie) nei round',
    '  // gia chiusi di questa stagione - prima si vedevano solo le proprie offerte,',
    '  // ma lo storico di chi ha preso/svincolato cosa e chi ha offerto quanto e',
    '  // ora visibile a chiunque, non solo all''admin (stessa vista di /admin/asta,',
    '  // qui in sola lettura).',
    '  const pastRoundsRes = await db.execute({',
    '    sql: `SELECT id, name, resolvedAt FROM "AuctionRound"',
    '          WHERE seasonId = ? AND resolvedAt IS NOT NULL ORDER BY id DESC LIMIT 10`,',
    '    args: [seasonId],'
    ))
}

$ok7 = Set-CodeFile -RelativePath "app\(main)\asta\AstaHistory.tsx" -Marker 'myTeamName' -NewContentLines @(
    '"use client";',
    '',
    'import { useState, Fragment } from "react";',
    '',
    'type HistoryBid = {',
    '  playerId: number;',
    '  playerName: string;',
    '  mantraRole: string;',
    '  teamName: string;',
    '  amount: number;',
    '  status: string;',
    '  releasedPlayerName: string | null;',
    '  unsoldReason: string | null;',
    '};',
    'type HistoryRound = { roundId: number; roundName: string; resolvedAt: string; bids: HistoryBid[] };',
    '',
    'function fmt(dt: string) {',
    '  return new Date(dt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });',
    '}',
    '',
    '// Raggruppa le offerte di un round per giocatore (stessa logica di',
    '// /admin/asta): un giocatore e'' rimasto svincolato se nessuna delle sue',
    '// offerte e'' "won".',
    'function groupBidsByPlayer(bids: HistoryBid[]) {',
    '  const map = new Map<number, { playerId: number; playerName: string; bids: HistoryBid[] }>();',
    '  for (const b of bids) {',
    '    if (!map.has(b.playerId)) map.set(b.playerId, { playerId: b.playerId, playerName: b.playerName, bids: [] });',
    '    map.get(b.playerId)!.bids.push(b);',
    '  }',
    '  return Array.from(map.values());',
    '}',
    '',
    '// Storico completo delle aste a buste: visibile a tutti i partecipanti (non',
    '// solo all''admin), con le offerte di ogni squadra una volta che il round e',
    '// chiuso - prima di allora restano segrete (questo componente riceve solo',
    '// round gia risolti). Le righe della propria squadra sono evidenziate.',
    'export default function AstaHistory({ history, myTeamName }: { history: HistoryRound[]; myTeamName: string }) {',
    '  const [expanded, setExpanded] = useState<number | null>(history[0]?.roundId ?? null);',
    '',
    '  if (history.length === 0) return null;',
    '',
    '  return (',
    '    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">',
    '      <div className="px-4 py-3 border-b bg-gray-50">',
    '        <h2 className="font-semibold text-gray-700">Storico buste</h2>',
    '        <p className="text-xs text-gray-400 mt-0.5">',
    '          Tutte le offerte dei round gia chiusi, di ogni squadra. Le tue sono evidenziate.',
    '        </p>',
    '      </div>',
    '      <div className="divide-y">',
    '        {history.map((r) => {',
    '          const won = r.bids.filter((b) => b.status === "won");',
    '          const playerGroups = groupBidsByPlayer(r.bids);',
    '          const isOpen = expanded === r.roundId;',
    '          return (',
    '            <div key={r.roundId}>',
    '              <button',
    '                onClick={() => setExpanded(isOpen ? null : r.roundId)}',
    '                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"',
    '              >',
    '                <div>',
    '                  <p className="text-sm font-medium text-gray-700">{r.roundName}</p>',
    '                  <p className="text-xs text-gray-400">',
    '                    chiuso il {fmt(r.resolvedAt)} - {won.length} assegnati su {r.bids.length} offerte',
    '                  </p>',
    '                </div>',
    '                <span className="text-gray-400 text-sm">{isOpen ? "^" : "v"}</span>',
    '              </button>',
    '              {isOpen && (',
    '                <div className="px-4 pb-4">',
    '                  {r.bids.length === 0 ? (',
    '                    <p className="text-sm text-gray-400">Nessuna offerta ricevuta.</p>',
    '                  ) : (',
    '                    <table className="w-full text-sm">',
    '                      <thead>',
    '                        <tr className="text-left text-xs text-gray-400 uppercase">',
    '                          <th className="py-1 pr-2">Giocatore</th>',
    '                          <th className="py-1 pr-2">Squadra</th>',
    '                          <th className="py-1 pr-2 text-right">Offerta</th>',
    '                          <th className="py-1"></th>',
    '                        </tr>',
    '                      </thead>',
    '                      <tbody className="divide-y">',
    '                        {playerGroups.map((g) => {',
    '                          const sold = g.bids.some((b) => b.status === "won");',
    '                          return (',
    '                            <Fragment key={g.playerId}>',
    '                              {g.bids.map((b, i) => {',
    '                                const mine = b.teamName === myTeamName;',
    '                                return (',
    '                                  <tr',
    '                                    key={i}',
    '                                    className={',
    '                                      b.status === "won"',
    '                                        ? "bg-green-50"',
    '                                        : mine',
    '                                          ? "bg-orange-50"',
    '                                          : ""',
    '                                    }',
    '                                  >',
    '                                    <td className="py-1.5 pr-2 font-medium">{b.playerName}</td>',
    '                                    <td className={`py-1.5 pr-2 ${mine ? "text-orange-700 font-semibold" : "text-gray-500"}`}>',
    '                                      {b.teamName}',
    '                                      {mine ? " (tu)" : ""}',
    '                                    </td>',
    '                                    <td className="py-1.5 pr-2 text-right font-mono">{b.amount}</td>',
    '                                    <td className="py-1.5 text-xs">',
    '                                      {b.status === "won" ? (',
    '                                        <div>',
    '                                          <span className="text-green-700 font-semibold">vinta</span>',
    '                                          {b.releasedPlayerName && (',
    '                                            <div className="text-gray-400 font-normal mt-0.5">',
    '                                              svincolato {b.releasedPlayerName}',
    '                                            </div>',
    '                                          )}',
    '                                        </div>',
    '                                      ) : (',
    '                                        <span className="text-gray-400">persa</span>',
    '                                      )}',
    '                                    </td>',
    '                                  </tr>',
    '                                );',
    '                              })}',
    '                              {!sold && (',
    '                                <tr className="bg-amber-50">',
    '                                  <td colSpan={4} className="py-1.5 pr-2 pl-2 text-xs text-amber-700 font-medium">',
    '                                    Rimasto svincolato',
    '                                    {(() => {',
    '                                      const reason = g.bids.find((b) => b.unsoldReason)?.unsoldReason;',
    '                                      return reason',
    '                                        ? `: ${reason}.`',
    '                                        : ": nessuna offerta e andata a buon fine.";',
    '                                    })()}',
    '                                  </td>',
    '                                </tr>',
    '                              )}',
    '                            </Fragment>',
    '                          );',
    '                        })}',
    '                      </tbody>',
    '                    </table>',
    '                  )}',
    '                </div>',
    '              )}',
    '            </div>',
    '          );',
    '        })}',
    '      </div>',
    '    </div>',
    '  );',
    '}'
)

$allOk = $ok1 -and $ok2 -and $ok3 -and $ok4 -and $ok5 -and $ok6 -and $ok7

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

git add "app/lib/auction.ts" "app/lib/autoMigrate.ts" "app/actions/dbMigrate.ts" "app/(main)/admin/asta/page.tsx" "app/(main)/admin/asta/AdminAstaClient.tsx" "app/(main)/asta/page.tsx" "app/(main)/asta/AstaHistory.tsx"
$status = git status --porcelain -- "app/lib/auction.ts" "app/lib/autoMigrate.ts" "app/actions/dbMigrate.ts" "app/(main)/admin/asta/page.tsx" "app/(main)/admin/asta/AdminAstaClient.tsx" "app/(main)/asta/page.tsx" "app/(main)/asta/AstaHistory.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Asta: motivo esatto per gli svincolati e storico visibile a tutti`n`nQuando un giocatore resta svincolato alla chiusura di un round, il motivo`n(fondi insufficienti o slot rosa pieni) viene ora salvato subito in una`nnuova tabella AuctionUnsold, cosi resta visibile nello storico anche a`nround chiuso da tempo (prima si perdeva non appena la risposta della`nfunzione di risoluzione veniva scartata) - vale pero solo per i round`nrisolti da questo momento in poi, non per quelli gia chiusi in passato.`n`nInoltre lo storico completo delle buste (chi ha offerto cosa, chi ha`nvinto, chi e stato svincolato) e ora visibile a tutti i partecipanti in`n/asta, non solo all'admin in /admin/asta - le proprie offerte restano`nevidenziate per riconoscerle facilmente.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
