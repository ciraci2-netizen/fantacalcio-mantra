$ErrorActionPreference = 'Stop'
Write-Host '=== Storico buste per gli utenti ===' -ForegroundColor Cyan

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

$okAstaPage = Update-CodeFile -RelativePath "app\(main)\asta\page.tsx" -Marker 'myHistory' -MinLines 129 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 115) ---
    $lines.RemoveRange(114, 13)
    $lines.InsertRange(114, [string[]]@(
    '    <div className="space-y-6">',
    '      <AstaClient',
    '        round={round}',
    '        notStarted={notStarted}',
    '        players={players}',
    '        myBids={myBids}',
    '        myRoster={myRoster}',
    '        remainingBudget={remaining}',
    '        slotsUsed={slotsUsed}',
    '        limits={limits}',
    '        countByRole={countByRole}',
    '        roleLabel={ROLE_LABEL}',
    '        roles={MANTRA_ROLES as unknown as string[]}',
    '      />',
    '      <AstaHistory history={myHistory} />',
    '    </div>'
    ))

    # --- Modifica 2 (riga originale 41) ---
    $lines.RemoveRange(40, 4)
    $lines.InsertRange(40, [string[]]@(
    '      <div className="space-y-6">',
    '        <div className="text-center py-16 text-gray-400">',
    '          <div className="text-4xl mb-3">{"\u{1F528}"}</div>',
    '          <p className="font-medium text-gray-500">Nessuna asta aperta al momento.</p>',
    '          <p className="text-sm mt-1">L&apos;admin aprira un nuovo round quando ci saranno svincolati da assegnare.</p>',
    '        </div>',
    '        <AstaHistory history={myHistory} />'
    ))

    # --- Modifica 3 (riga originale 32) ---
    $lines.InsertRange(31, [string[]]@(
    '  // Storico: le proprie offerte (vinte/perse) nei round gia chiusi di questa',
    '  // stagione. Solo le tue: niente cifre degli altri utenti.',
    '  const historyRes = await db.execute({',
    '    sql: `SELECT ar.id as roundId, ar.name as roundName, ar.resolvedAt,',
    '                 sb.amount, sb.status, p.name as playerName, p.mantraRole',
    '          FROM "SealedBid" sb',
    '          JOIN "AuctionRound" ar ON ar.id = sb.roundId',
    '          JOIN "Player" p ON p.id = sb.playerId',
    '          WHERE ar.seasonId = ? AND sb.userId = ? AND ar.resolvedAt IS NOT NULL AND sb.status IN (''won'', ''lost'')',
    '          ORDER BY ar.resolvedAt DESC, sb.status ASC, p.name ASC',
    '          LIMIT 300`,',
    '    args: [seasonId, session.userId],',
    '  });',
    '  type HistoryBid = { playerName: string; mantraRole: string; amount: number; status: string };',
    '  const historyByRound = new Map<number, { roundId: number; roundName: string; resolvedAt: string; bids: HistoryBid[] }>();',
    '  for (const r of historyRes.rows) {',
    '    const roundId = r.roundId as number;',
    '    if (!historyByRound.has(roundId)) {',
    '      historyByRound.set(roundId, {',
    '        roundId,',
    '        roundName: r.roundName as string,',
    '        resolvedAt: r.resolvedAt as string,',
    '        bids: [],',
    '      });',
    '    }',
    '    historyByRound.get(roundId)!.bids.push({',
    '      playerName: r.playerName as string,',
    '      mantraRole: r.mantraRole as string,',
    '      amount: r.amount as number,',
    '      status: r.status as string,',
    '    });',
    '  }',
    '  const myHistory = Array.from(historyByRound.values());',
    ''
    ))

    # --- Modifica 4 (riga originale 8) ---
    $lines.InsertRange(7, [string[]]@(
    'import AstaHistory from "./AstaHistory";'
    ))
}

# Nuovo file: app/(main)/asta/AstaHistory.tsx (componente storico buste)
$okAstaHistory = $true
$astaHistoryPath = Join-Path (Get-Location).Path "app\(main)\asta\AstaHistory.tsx"
$astaHistoryDir = Split-Path $astaHistoryPath -Parent
if (-not (Test-Path -LiteralPath $astaHistoryDir)) {
    Write-Host "ERRORE: non trovo la cartella app\(main)\asta - esegui questo script dalla cartella principale del repo (fantacalcio-mantra)." -ForegroundColor Red
    $okAstaHistory = $false
} else {
    $writeHistory = $true
    if (Test-Path -LiteralPath $astaHistoryPath) {
        $ahText = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($astaHistoryPath))
        if ($ahText -match [regex]::Escape('HistoryRound')) {
            Write-Host "app\(main)\asta\AstaHistory.tsx sembra gia presente. Non faccio nulla." -ForegroundColor Yellow
            $writeHistory = $false
        }
    }
    if ($writeHistory) {
        $astaHistoryContent = @'
"use client";

import { useState } from "react";

type HistoryBid = { playerName: string; mantraRole: string; amount: number; status: string };
type HistoryRound = { roundId: number; roundName: string; resolvedAt: string; bids: HistoryBid[] };

function fmt(dt: string) {
  return new Date(dt).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AstaHistory({ history }: { history: HistoryRound[] }) {
  const [expanded, setExpanded] = useState<number | null>(history[0]?.roundId ?? null);

  if (history.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-700">Storico buste - le tue offerte</h2>
        <p className="text-xs text-gray-400 mt-0.5">Solo le tue offerte passate: gli importi degli altri utenti restano segreti.</p>
      </div>
      <div className="divide-y">
        {history.map((r) => {
          const won = r.bids.filter((b) => b.status === "won");
          const isOpen = expanded === r.roundId;
          return (
            <div key={r.roundId}>
              <button
                onClick={() => setExpanded(isOpen ? null : r.roundId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">{r.roundName}</p>
                  <p className="text-xs text-gray-400">
                    chiuso il {fmt(r.resolvedAt)} - {won.length} vinte su {r.bids.length} offerte
                  </p>
                </div>
                <span className="text-gray-400 text-sm">{isOpen ? "^" : "v"}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 uppercase">
                        <th className="py-1 pr-2">Giocatore</th>
                        <th className="py-1 pr-2">Ruolo</th>
                        <th className="py-1 pr-2 text-right">Offerta</th>
                        <th className="py-1"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {r.bids.map((b, i) => (
                        <tr key={i} className={b.status === "won" ? "bg-green-50" : ""}>
                          <td className="py-1.5 pr-2 font-medium">{b.playerName}</td>
                          <td className="py-1.5 pr-2 text-gray-500">{b.mantraRole}</td>
                          <td className="py-1.5 pr-2 text-right font-mono">{b.amount}</td>
                          <td className="py-1.5 text-xs">
                            {b.status === "won" ? (
                              <span className="text-green-700 font-semibold">vinta</span>
                            ) : (
                              <span className="text-gray-400">persa</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
'@
        [System.IO.File]::WriteAllText($astaHistoryPath, ($astaHistoryContent -replace "`n", "`r`n"), (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "File creato: app\(main)\asta\AstaHistory.tsx" -ForegroundColor Green
    }
}

$allOk = $okAstaPage -and $okAstaHistory

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

git add "app/(main)/asta/page.tsx" "app/(main)/asta/AstaHistory.tsx"
$status = git status --porcelain -- "app/(main)/asta/page.tsx" "app/(main)/asta/AstaHistory.tsx"
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Asta a buste: aggiunge storico offerte (vinte/perse) per gli utenti`n`nSu /asta, sotto il round aperto (o al posto suo se non c'e' nessun round`naperto), ogni utente vede ora le proprie offerte nei round gia chiusi:`nvinte e perse, con giocatore e cifra offerta. Solo le proprie - gli`nimporti degli altri utenti restano segreti anche a storico chiuso.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
}
