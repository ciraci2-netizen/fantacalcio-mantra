$ErrorActionPreference = 'Stop'
Write-Host '=== Asta a buste: svincolo automatico + rinomina menu + rimozione Bacheca ===' -ForegroundColor Cyan

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

$okAutoMigrate = Update-CodeFile -RelativePath "app\lib\autoMigrate.ts" -Marker 'MarketOffer_legacy' -MinLines 116 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 116) ---
    $lines.InsertRange(115, [string[]]@(
    '',
    '  // --- Riparazione Market/MarketOffer con lo schema vecchio/sbagliato ---',
    '  // CREATE TABLE IF NOT EXISTS sopra non tocca una tabella che esiste gia',
    '  // (anche se con le colonne sbagliate), quindi qui sistemiamo i database',
    '  // dove il bug descritto sopra ha gia creato le tabelle nella forma errata.',
    '',
    '  // Market: mancano solo colonne "in piu" (name, budget), senza vincoli che',
    '  // impediscano righe esistenti - un semplice ALTER ADD COLUMN basta ed e',
    '  // sicuro anche se le colonne ci sono gia (fallisce e viene ignorato).',
    '  try { await db.execute(`ALTER TABLE "Market" ADD COLUMN "name" TEXT NOT NULL DEFAULT ''Mercato''`); } catch { /* gia presente */ }',
    '  try { await db.execute(`ALTER TABLE "Market" ADD COLUMN "budget" INTEGER NOT NULL DEFAULT 0`); } catch { /* gia presente */ }',
    '',
    '  // SealedBid.releasePlayerId: colonna aggiunta dopo, stesso discorso del',
    '  // Market qui sopra - solo una colonna in piu, ALTER ADD COLUMN basta.',
    '  try { await db.execute(`ALTER TABLE "SealedBid" ADD COLUMN "releasePlayerId" INTEGER`); } catch { /* gia presente */ }',
    '',
    '  // MarketOffer: la versione vecchia ha toUserId/offeredPlayerId/',
    '  // requestedPlayerId NOT NULL senza default, quindi non basta aggiungere le',
    '  // colonne mancanti (playerId/price/note) - le INSERT del codice attuale',
    '  // fallirebbero comunque per quei vincoli. Va ricostruita. Lo facciamo solo',
    '  // se serve davvero (rilevando l''assenza della colonna "playerId"), e senza',
    '  // cancellare eventuali righe: la tabella vecchia viene rinominata invece',
    '  // di essere eliminata (in pratica sara sempre vuota, perche con lo schema',
    '  // sbagliato ogni "Metti in vendita" falliva gia prima di arrivare',
    '  // all''INSERT, ma meglio non fidarsi e conservarla comunque).',
    '  try {',
    '    await db.execute(`SELECT playerId FROM "MarketOffer" LIMIT 1`);',
    '  } catch {',
    '    try { await db.execute(`ALTER TABLE "MarketOffer" RENAME TO "MarketOffer_legacy"`); } catch { /* tabella non esisteva ancora */ }',
    '    try {',
    '      await db.execute(`CREATE TABLE IF NOT EXISTS "MarketOffer" (',
    '        id         INTEGER PRIMARY KEY AUTOINCREMENT,',
    '        marketId   INTEGER NOT NULL,',
    '        fromUserId INTEGER NOT NULL,',
    '        toUserId   INTEGER,',
    '        playerId   INTEGER NOT NULL,',
    '        price      INTEGER NOT NULL DEFAULT 0,',
    '        note       TEXT    NOT NULL DEFAULT '''',',
    '        status     TEXT    NOT NULL DEFAULT ''pending'',',
    '        createdAt  TEXT    NOT NULL DEFAULT (datetime(''now''))',
    '      )`);',
    '    } catch { /* qualcosa e gia andato storto: non blocchiamo la richiesta */ }',
    '  }'
    ))

    # --- Modifica 2 (riga originale 52) ---
    $lines.RemoveRange(51, 9)
    $lines.InsertRange(51, [string[]]@(
    '      id         INTEGER PRIMARY KEY AUTOINCREMENT,',
    '      marketId   INTEGER NOT NULL,',
    '      fromUserId INTEGER NOT NULL,',
    '      toUserId   INTEGER,',
    '      playerId   INTEGER NOT NULL,',
    '      price      INTEGER NOT NULL DEFAULT 0,',
    '      note       TEXT    NOT NULL DEFAULT '''',',
    '      status     TEXT    NOT NULL DEFAULT ''pending'',',
    '      createdAt  TEXT    NOT NULL DEFAULT (datetime(''now''))',
    '    )`,',
    '    // Asta a buste sugli svincolati: in precedenza create solo dal pulsante',
    '    // manuale "Esegui migrazioni" (app/actions/dbMigrate.ts) - se non e mai',
    '    // stato premuto, /admin/asta va in errore perche la tabella non esiste.',
    '    // Portate anche qui cosi si creano da sole al primo caricamento.',
    '    `CREATE TABLE IF NOT EXISTS "AuctionRound" (',
    '      id         INTEGER PRIMARY KEY AUTOINCREMENT,',
    '      seasonId   INTEGER NOT NULL,',
    '      name       TEXT    NOT NULL DEFAULT ''Asta svincolati'',',
    '      startDate  TEXT,',
    '      endDate    TEXT    NOT NULL,',
    '      resolvedAt TEXT,',
    '      createdAt  TEXT    NOT NULL DEFAULT (datetime(''now''))',
    '    )`,',
    '    `CREATE TABLE IF NOT EXISTS "SealedBid" (',
    '      id               INTEGER PRIMARY KEY AUTOINCREMENT,',
    '      roundId          INTEGER NOT NULL,',
    '      playerId         INTEGER NOT NULL,',
    '      userId           INTEGER NOT NULL,',
    '      amount           INTEGER NOT NULL,',
    '      releasePlayerId  INTEGER,',
    '      status           TEXT    NOT NULL DEFAULT ''pending'',',
    '      createdAt        TEXT    NOT NULL DEFAULT (datetime(''now'')),',
    '      UNIQUE(roundId, playerId, userId)'
    ))

    # --- Modifica 3 (riga originale 49) ---
    $lines.InsertRange(48, [string[]]@(
    '      budget    INTEGER NOT NULL DEFAULT 0,'
    ))

    # --- Modifica 4 (riga originale 48) ---
    $lines.InsertRange(47, [string[]]@(
    '      name      TEXT    NOT NULL DEFAULT ''Mercato'','
    ))

    # --- Modifica 5 (riga originale 45) ---
    $lines.InsertRange(44, [string[]]@(
    '    // NB: lo schema di Market/MarketOffer qui sotto deve restare allineato',
    '    // con app/actions/market.ts (Market.name/budget, MarketOffer.playerId/',
    '    // price/note). Una versione precedente di questo file creava queste due',
    '    // tabelle con colonne diverse (copiate per errore dal modello scambi',
    '    // giocatore-per-giocatore di TradeOffer), incompatibili con le action:',
    '    // "Crea mercato" e "Metti in vendita" fallivano sempre con "no such',
    '    // column". Il blocco di riparazione piu sotto sistema anche i database',
    '    // dove queste tabelle erano gia state create con lo schema sbagliato.'
    ))

    # --- Modifica 6 (riga originale 7) ---
    $lines.RemoveRange(6, 1)
    $lines.InsertRange(6, [string[]]@(
    ' * Safe to call on every request - runs only once per server process.'
    ))
}

$okDbMigrate = Update-CodeFile -RelativePath "app\actions\dbMigrate.ts" -Marker 'ADD COLUMN \"releasePlayerId\"' -MinLines 267 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 220) ---
    $lines.InsertRange(219, [string[]]@(
    '  // Svincolo contestuale all''offerta nell''asta a buste: se lo slot di ruolo',
    '  // e pieno, l''utente puo indicare gia in fase di offerta quale proprio',
    '  // giocatore svincolare per fare posto. Lo svincolo scatta da solo, e solo',
    '  // se l''offerta vince (vedi resolveRound in app/lib/auction.ts).',
    '  try { await db.execute(`ALTER TABLE "SealedBid" ADD COLUMN "releasePlayerId" INTEGER`); } catch { /* gia presente */ }',
    ''
    ))
}

$okAuctionLib = Update-CodeFile -RelativePath "app\lib\auction.ts" -Marker 'consumedReleases' -MinLines 266 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 253) ---
    $lines.InsertRange(252, [string[]]@(
    '      releasedPlayerName,'
    ))

    # --- Modifica 2 (riga originale 239) ---
    $lines.RemoveRange(238, 1)
    $lines.InsertRange(238, [string[]]@(
    '',
    '    let releasedPlayerName: string | undefined;',
    '    if (winnerReleasePlayerId) {',
    '      await db.execute({ sql: `DELETE FROM "Roster" WHERE userId = ? AND playerId = ?`, args: [winner.userId, winnerReleasePlayerId] });',
    '      consumedReleases.add(winnerReleasePlayerId);',
    '      releasedPlayerName = rosterPlayerName.get(winnerReleasePlayerId);',
    '      // Uno svincolo libera esattamente lo slot occupato dal nuovo acquisto:',
    '      // saldo netto zero, non tocchiamo slotsUsed per questo pool.',
    '    } else {'
    ))

    # --- Modifica 3 (riga originale 225) ---
    $lines.InsertRange(224, [string[]]@(
    '      winnerReleasePlayerId = releasePlayerId;'
    ))

    # --- Modifica 4 (riga originale 222) ---
    $lines.RemoveRange(221, 1)
    $lines.InsertRange(221, [string[]]@(
    '',
    '      let releasePlayerId: number | null = null;',
    '      if (full) {',
    '        // Slot pieno: l''offerta vince comunque se l''utente ha indicato un',
    '        // proprio giocatore da svincolare (stesso "pool" ruolo), che e',
    '        // ancora davvero in rosa sua e non gia promesso a un''altra offerta',
    '        // vincente di questo stesso round.',
    '        const candidate = b.releasePlayerId;',
    '        if (',
    '          candidate &&',
    '          !consumedReleases.has(candidate) &&',
    '          rosterOwner.get(candidate) === b.userId',
    '        ) {',
    '          releasePlayerId = candidate;',
    '        } else {',
    '          skippedForSlots = true;',
    '          continue;',
    '        }',
    '      }'
    ))

    # --- Modifica 5 (riga originale 213) ---
    $lines.InsertRange(212, [string[]]@(
    '    let winnerReleasePlayerId: number | null = null;'
    ))

    # --- Modifica 6 (riga originale 211) ---
    $lines.RemoveRange(210, 1)
    $lines.InsertRange(210, [string[]]@(
    '    // bids e gia ordinato per amount DESC, poi createdAt ASC (pareggio -> prima offerta)'
    ))

    # --- Modifica 7 (riga originale 191) ---
    $lines.InsertRange(190, [string[]]@(
    '      releasePlayerId: (row.releasePlayerId as number | null) ?? null,'
    ))

    # --- Modifica 8 (riga originale 181) ---
    $lines.RemoveRange(180, 1)
    $lines.InsertRange(180, [string[]]@(
    '    id: number; playerId: number; userId: number; amount: number; releasePlayerId: number | null;'
    ))

    # --- Modifica 9 (riga originale 175) ---
    $lines.RemoveRange(174, 3)
    $lines.InsertRange(174, [string[]]@(
    '  // Giocatori gia "consumati" come svincolo in questa risoluzione: evita che',
    '  // lo stesso giocatore di rosa venga proposto come svincolo per due offerte',
    '  // vincenti diverse dello stesso utente.',
    '  const consumedReleases = new Set<number>();',
    '',
    '  // Quanto ciascun utente sta gia "spendendo"/occupando fra i giocatori',
    '  // assegnati in QUESTO stesso round, mano a mano che si procede - evita che',
    '  // qualcuno vinca piu giocatori di quanti crediti o slot di rosa abbia.'
    ))

    # --- Modifica 10 (riga originale 173) ---
    $lines.InsertRange(172, [string[]]@(
    '    rosterOwner.set(pid, uid);',
    '    rosterPlayerName.set(pid, r.name as string);'
    ))

    # --- Modifica 11 (riga originale 170) ---
    $lines.InsertRange(169, [string[]]@(
    '    const pid = r.playerId as number;'
    ))

    # --- Modifica 12 (riga originale 168) ---
    $lines.InsertRange(167, [string[]]@(
    '  // Per validare/eseguire uno svincolo contestuale: a chi appartiene oggi',
    '  // ciascun giocatore in rosa, e il suo nome (per il messaggio di riepilogo).',
    '  const rosterOwner = new Map<number, number>(); // playerId -> userId',
    '  const rosterPlayerName = new Map<number, string>(); // playerId -> nome'
    ))

    # --- Modifica 13 (riga originale 165) ---
    $lines.RemoveRange(164, 1)
    $lines.InsertRange(164, [string[]]@(
    '    `SELECT r.userId, r.playerId, p.mantraRole, p.name FROM "Roster" r JOIN "Player" p ON p.id = r.playerId`'
    ))

    # --- Modifica 14 (riga originale 154) ---
    $lines.RemoveRange(153, 1)
    $lines.InsertRange(153, [string[]]@(
    '  // decadono, il giocatore non e piu uno svincolato da assegnare qui.'
    ))

    # --- Modifica 15 (riga originale 152) ---
    $lines.RemoveRange(151, 1)
    $lines.InsertRange(151, [string[]]@(
    '  // Giocatori gia assegnati nel frattempo (es. l''admin li ha messi in rosa a'
    ))

    # --- Modifica 16 (riga originale 141) ---
    $lines.RemoveRange(140, 1)
    $lines.InsertRange(140, [string[]]@(
    '    sql: `SELECT sb.id, sb.playerId, sb.userId, sb.amount, sb.releasePlayerId,',
    '                 p.name as playerName, p.mantraRole, u.teamName, u.credits'
    ))

    # --- Modifica 17 (riga originale 130) ---
    $lines.RemoveRange(129, 1)
    $lines.InsertRange(129, [string[]]@(
    ' * Idempotente: un round gia risolto (resolvedAt valorizzato) non viene'
    ))

    # --- Modifica 18 (riga originale 126) ---
    $lines.RemoveRange(125, 3)
    $lines.InsertRange(125, [string[]]@(
    ' * pendente, vince l''offerta piu alta (a parita la piu vecchia) fra quelle',
    ' * che il vincitore puo davvero permettersi - se anche la migliore offerta',
    ' * supera il budget residuo di chi l''ha fatta (caso limite: e gia successo'
    ))

    # --- Modifica 19 (riga originale 113) ---
    $lines.RemoveRange(112, 2)
    $lines.InsertRange(112, [string[]]@(
    ' * caricamento di /asta e /admin/asta: se non c''e nulla di scaduto non fa',
    ' * nulla, quindi e sicura ed economica da richiamare spesso.'
    ))

    # --- Modifica 20 (riga originale 89) ---
    $lines.RemoveRange(88, 1)
    $lines.InsertRange(88, [string[]]@(
    '            WHERE sb.userId = ? AND sb.status = ''pending'' AND ar.resolvedAt IS NULL AND sb.id != ?',
    '              AND sb.releasePlayerId IS NULL`,'
    ))

    # --- Modifica 21 (riga originale 73) ---
    $lines.InsertRange(72, [string[]]@(
    ' *',
    ' * Un''offerta pendente con releasePlayerId valorizzato (l''utente ha gia',
    ' * indicato quale proprio giocatore svincolare se vince) NON viene contata',
    ' * come slot aggiuntivo occupato: e uno scambio a saldo zero, non un',
    ' * acquisto puro - vedi resolveRound per l''esecuzione dello svincolo.'
    ))

    # --- Modifica 22 (riga originale 70) ---
    $lines.RemoveRange(69, 2)
    $lines.InsertRange(69, [string[]]@(
    ' * chiusi (cosi non si puo fare offerte per piu portieri di quanti slot',
    ' * liberi si abbiano, sommando piu offerte contemporanee). `excludeBidId`'
    ))

    # --- Modifica 23 (riga originale 68) ---
    $lines.RemoveRange(67, 1)
    $lines.InsertRange(67, [string[]]@(
    ' * Slot di rosa (portieri / movimento) gia occupati da un utente, contando'
    ))

    # --- Modifica 24 (riga originale 44) ---
    $lines.RemoveRange(43, 4)
    $lines.InsertRange(43, [string[]]@(
    ' * Budget residuo di un utente: crediti totali meno quanto gia speso in rosa',
    ' * meno quanto gia "impegnato" in offerte pendenti su round non ancora',
    ' * chiusi (cosi non si possono promettere piu crediti di quanti se ne hanno,',
    ' * sommando piu offerte contemporanee). `excludeBidId` esclude la propria'
    ))

    # --- Modifica 25 (riga originale 38) ---
    $lines.RemoveRange(37, 1)
    $lines.InsertRange(37, [string[]]@(
    '/** Vero se un round con questa startDate non e ancora iniziato (o non ne ha una). */'
    ))

    # --- Modifica 26 (riga originale 25) ---
    $lines.InsertRange(24, [string[]]@(
    '  releasedPlayerName?: string;'
    ))

    # --- Modifica 27 (riga originale 14) ---
    $lines.RemoveRange(13, 1)
    $lines.InsertRange(13, [string[]]@(
    ' * Non c''e un cron dedicato: la chiusura/assegnazione scatta "pigramente" al'
    ))

    # --- Modifica 28 (riga originale 9) ---
    $lines.RemoveRange(8, 4)
    $lines.InsertRange(8, [string[]]@(
    ' * partecipante puo fare UNA offerta segreta per giocatore (invisibile agli',
    ' * altri finche il round non si chiude - vedi app/actions/auction.ts per la',
    ' * sottomissione). Alla chiusura vince l''offerta piu alta per ciascun',
    ' * giocatore; a parita vince la piu vecchia (chi ha offerto per primo).'
    ))
}

$okAuctionAction = Update-CodeFile -RelativePath "app\actions\auction.ts" -Marker 'Svincolo contestuale' -MinLines 163 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 158) ---
    $lines.RemoveRange(157, 1)
    $lines.InsertRange(157, [string[]]@(
    '  if (bid.resolvedAt || bid.status !== "pending") return "Il round e gia chiuso.";'
    ))

    # --- Modifica 2 (riga originale 132) ---
    $lines.RemoveRange(131, 2)
    $lines.InsertRange(131, [string[]]@(
    '      sql: `INSERT INTO "SealedBid" (roundId, playerId, userId, amount, releasePlayerId) VALUES (?, ?, ?, ?, ?)`,',
    '      args: [roundId, playerId, session.userId, amount, releasePlayerId],'
    ))

    # --- Modifica 3 (riga originale 129) ---
    $lines.RemoveRange(128, 1)
    $lines.InsertRange(128, [string[]]@(
    '    await db.execute({ sql: `UPDATE "SealedBid" SET amount = ?, releasePlayerId = ? WHERE id = ?`, args: [amount, releasePlayerId, existingBidId] });'
    ))

    # --- Modifica 4 (riga originale 122) ---
    $lines.RemoveRange(121, 3)
    $lines.InsertRange(121, [string[]]@(
    '      return (isPor',
    '        ? `Slot portieri gia al completo (${limits.numPortieri}): scegli quale portiere svincolare per fare posto.`',
    '        : `Slot giocatori di movimento gia al completo (${limits.numMovimento}): scegli quale giocatore svincolare per fare posto.`);'
    ))

    # --- Modifica 5 (riga originale 120) ---
    $lines.RemoveRange(119, 1)

    # --- Modifica 6 (riga originale 115) ---
    $lines.RemoveRange(114, 3)
    $lines.InsertRange(114, [string[]]@(
    '  // Svincolo contestuale: se indicato, deve essere un TUO giocatore in',
    '  // rosa, dello stesso "pool" del giocatore che stai cercando di prendere',
    '  // (portiere per portiere, movimento per movimento - i ruoli DC/TER/M/OFF/',
    '  // ATT condividono lo stesso slot), e non gia promesso a un''altra tua',
    '  // offerta pendente (non ha senso pensare di svincolare due volte lo',
    '  // stesso giocatore per due offerte diverse).',
    '  const isPor = mantraRole === "POR";',
    '  if (releasePlayerId) {',
    '    const releaseRes = await db.execute({',
    '      sql: `SELECT p.mantraRole FROM "Roster" r JOIN "Player" p ON p.id = r.playerId WHERE r.userId = ? AND r.playerId = ?`,',
    '      args: [session.userId, releasePlayerId],',
    '    });',
    '    const releaseRole = releaseRes.rows[0]?.mantraRole as string | undefined;',
    '    if (!releaseRole) return "Il giocatore da svincolare selezionato non e nella tua rosa.";',
    '    const releaseIsPor = releaseRole === "POR";',
    '    if (releaseIsPor !== isPor) {',
    '      return "Il giocatore da svincolare deve essere dello stesso tipo di slot (portiere/movimento) di quello che stai prendendo.";',
    '    }',
    '    const pledgedRes = await db.execute({',
    '      sql: `SELECT sb.id FROM "SealedBid" sb JOIN "AuctionRound" ar ON ar.id = sb.roundId',
    '            WHERE sb.userId = ? AND sb.releasePlayerId = ? AND sb.status = ''pending'' AND ar.resolvedAt IS NULL AND sb.id != ?`,',
    '      args: [session.userId, releasePlayerId, existingBidId ?? -1],',
    '    });',
    '    if (pledgedRes.rows.length > 0) {',
    '      return "Hai gia indicato questo giocatore come svincolo per un''altra offerta in corso.";',
    '    }',
    '  }',
    '',
    '  // Non ha senso fare un''offerta per un ruolo per cui non c''e piu posto in',
    '  // rosa, contando anche le altre offerte pendenti (vedi roleSlotsUsed) - a',
    '  // meno che l''offerta non porti con se uno svincolo valido, che libera lo',
    '  // slot al posto suo.',
    '  if (!existingBidId && !releasePlayerId) {'
    ))

    # --- Modifica 7 (riga originale 104) ---
    $lines.RemoveRange(103, 1)
    $lines.InsertRange(103, [string[]]@(
    '  if (takenRes.rows.length > 0) return "Questo giocatore non e piu svincolato.";'
    ))

    # --- Modifica 8 (riga originale 96) ---
    $lines.RemoveRange(95, 2)
    $lines.InsertRange(95, [string[]]@(
    '  if (round.startDate && new Date(round.startDate as string).getTime() > now) return "L''asta non e ancora iniziata.";',
    '  if (new Date(round.endDate as string).getTime() <= now) return "L''asta e scaduta.";'
    ))

    # --- Modifica 9 (riga originale 94) ---
    $lines.RemoveRange(93, 1)
    $lines.InsertRange(93, [string[]]@(
    '  if (!round || round.resolvedAt) return "Questo round non e piu aperto.";'
    ))

    # --- Modifica 10 (riga originale 83) ---
    $lines.InsertRange(82, [string[]]@(
    '  const releaseRaw = (formData.get("releasePlayerId") as string) || "";',
    '  const releasePlayerId = releaseRaw ? parseInt(releaseRaw) : null;'
    ))

    # --- Modifica 11 (riga originale 65) ---
    $lines.RemoveRange(64, 1)
    $lines.InsertRange(64, [string[]]@(
    '        result.winners',
    '          .map((w) => `${w.playerName} -> ${w.teamName} (${w.amount})${w.releasedPlayerName ? ` [svincolato ${w.releasedPlayerName}]` : ""}`)',
    '          .join(", ")'
    ))

    # --- Modifica 12 (riga originale 39) ---
    $lines.RemoveRange(38, 1)
    $lines.InsertRange(38, [string[]]@(
    '  if (openRes.rows.length > 0) return "C''e gia un round non ancora chiuso: chiudilo prima di aprirne uno nuovo.";'
    ))

    # --- Modifica 13 (riga originale 17) ---
    $lines.RemoveRange(16, 1)
    $lines.InsertRange(16, [string[]]@(
    '// --- Admin: apre un nuovo round (fallisce se ce n''e gia uno non risolto) ---'
    ))
}

$okAstaPage = Update-CodeFile -RelativePath "app\(main)\asta\page.tsx" -Marker 'myRosterRes' -MinLines 112 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 104) ---
    $lines.InsertRange(103, [string[]]@(
    '      myRoster={myRoster}'
    ))

    # --- Modifica 2 (riga originale 95) ---
    $lines.InsertRange(94, [string[]]@(
    '  const myRoster = myRosterRes.rows.map((r) => ({',
    '    id: r.id as number,',
    '    name: r.name as string,',
    '    mantraRole: r.mantraRole as string,',
    '  }));',
    ''
    ))

    # --- Modifica 3 (riga originale 92) ---
    $lines.RemoveRange(91, 1)
    $lines.InsertRange(91, [string[]]@(
    '    myBids[b.playerId as number] = {',
    '      bidId: b.id as number,',
    '      amount: b.amount as number,',
    '      releasePlayerId: (b.releasePlayerId as number | null) ?? null,',
    '    };'
    ))

    # --- Modifica 4 (riga originale 90) ---
    $lines.RemoveRange(89, 1)
    $lines.InsertRange(89, [string[]]@(
    '  const myBids: Record<number, { bidId: number; amount: number; releasePlayerId: number | null }> = {};'
    ))

    # --- Modifica 5 (riga originale 70) ---
    $lines.InsertRange(69, [string[]]@(
    '    db.execute({',
    '      sql: `SELECT p.id, p.name, p.mantraRole',
    '            FROM "Roster" r JOIN "Player" p ON p.id = r.playerId',
    '            WHERE r.userId = ? ORDER BY p.mantraRole ASC, p.name ASC`,',
    '      args: [session.userId],',
    '    }),'
    ))

    # --- Modifica 6 (riga originale 65) ---
    $lines.RemoveRange(64, 1)
    $lines.InsertRange(64, [string[]]@(
    '      sql: `SELECT id, playerId, amount, releasePlayerId FROM "SealedBid" WHERE roundId = ? AND userId = ? AND status = ''pending''`,'
    ))

    # --- Modifica 7 (riga originale 57) ---
    $lines.RemoveRange(56, 1)
    $lines.InsertRange(56, [string[]]@(
    '  const [playersRes, myBidsRes, limits, slotsUsed, myRosterRes] = await Promise.all(['
    ))
}

$okAstaClient = Update-CodeFile -RelativePath "app\(main)\asta\AstaClient.tsx" -Marker 'RosterPlayer' -MinLines 237 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 219) ---
    $lines.RemoveRange(218, 9)
    $lines.InsertRange(218, [string[]]@(
    '                      {byRole[role].map((p) => {',
    '                        const isPor = p.mantraRole === "POR";',
    '                        return (',
    '                          <BidRow',
    '                            key={p.id}',
    '                            roundId={round.id}',
    '                            player={p}',
    '                            myBid={myBids[p.id]}',
    '                            remainingBudget={remainingBudget}',
    '                            poolFull={isPor ? porFull : movFull}',
    '                            releaseOptions={isPor ? porOptions : movOptions}',
    '                          />',
    '                        );',
    '                      })}'
    ))

    # --- Modifica 2 (riga originale 125) ---
    $lines.InsertRange(124, [string[]]@(
    '  const porFull = slotsUsed.por >= limits.numPortieri;',
    '  const movFull = slotsUsed.mov >= limits.numMovimento;',
    '  const porOptions = myRoster.filter((r) => r.mantraRole === "POR");',
    '  const movOptions = myRoster.filter((r) => r.mantraRole !== "POR");',
    ''
    ))

    # --- Modifica 3 (riga originale 115) ---
    $lines.InsertRange(114, [string[]]@(
    '  myRoster: RosterPlayer[];'
    ))

    # --- Modifica 4 (riga originale 104) ---
    $lines.InsertRange(103, [string[]]@(
    '  myRoster,'
    ))

    # --- Modifica 5 (riga originale 93) ---
    $lines.RemoveRange(92, 1)
    $lines.InsertRange(92, [string[]]@(
    '        <p className="text-xs text-amber-600 mt-1">Superi il tuo budget residuo ({remainingBudget})</p>'
    ))

    # --- Modifica 6 (riga originale 88) ---
    $lines.RemoveRange(87, 1)
    $lines.InsertRange(87, [string[]]@(
    '          Hai offerto <strong>{myBid.amount}</strong> crediti (segreta, visibile solo a te finche il round e aperto)',
    '          {releasedName && (',
    '            <>',
    '              {" "}- se vinci, svincolerai <strong>{releasedName}</strong> per fare posto (promessa: se non vinci, resta in rosa)',
    '            </>',
    '          )}'
    ))

    # --- Modifica 7 (riga originale 86) ---
    $lines.InsertRange(85, [string[]]@(
    '      {showReleasePicker && releaseOptions.length === 0 && (',
    '        <p className="text-xs text-amber-600 mt-1">Slot pieni e nessun giocatore disponibile da svincolare in questo ruolo.</p>',
    '      )}',
    '      {poolFull && releaseOptions.length > 0 && !releasePlayerId && (',
    '        <p className="text-xs text-amber-600 mt-1">Slot pieni: scegli chi svincolare per fare posto, altrimenti l&apos;offerta verra rifiutata.</p>',
    '      )}'
    ))

    # --- Modifica 8 (riga originale 52) ---
    $lines.InsertRange(51, [string[]]@(
    '          {showReleasePicker && releaseOptions.length > 0 && (',
    '            <select',
    '              name="releasePlayerId"',
    '              value={releasePlayerId}',
    '              onChange={(e) => setReleasePlayerId(e.target.value)}',
    '              className="border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 max-w-[9rem]"',
    '              title="Giocatore da svincolare se l''offerta vince"',
    '            >',
    '              <option value="">- nessuno svincolo -</option>',
    '              {releaseOptions.map((r) => (',
    '                <option key={r.id} value={r.id}>',
    '                  {r.name}',
    '                </option>',
    '              ))}',
    '            </select>',
    '          )}'
    ))

    # --- Modifica 9 (riga originale 49) ---
    $lines.RemoveRange(48, 1)
    $lines.InsertRange(48, [string[]]@(
    '        <form action={bidAction} className="flex items-center gap-1 shrink-0 flex-wrap justify-end">'
    ))

    # --- Modifica 10 (riga originale 36) ---
    $lines.RemoveRange(35, 1)
    $lines.InsertRange(35, [string[]]@(
    '      <div className="flex items-center gap-2 flex-wrap">'
    ))

    # --- Modifica 11 (riga originale 33) ---
    $lines.InsertRange(32, [string[]]@(
    '  const [releasePlayerId, setReleasePlayerId] = useState(myBid?.releasePlayerId ? String(myBid.releasePlayerId) : "");',
    '',
    '  const showReleasePicker = poolFull || Boolean(myBid?.releasePlayerId);',
    '  const releasedName = releaseOptions.find((r) => String(r.id) === releasePlayerId)?.name;'
    ))

    # --- Modifica 12 (riga originale 29) ---
    $lines.InsertRange(28, [string[]]@(
    '  poolFull: boolean;',
    '  releaseOptions: RosterPlayer[];'
    ))

    # --- Modifica 13 (riga originale 24) ---
    $lines.InsertRange(23, [string[]]@(
    '  poolFull,',
    '  releaseOptions,'
    ))

    # --- Modifica 14 (riga originale 17) ---
    $lines.RemoveRange(16, 1)
    $lines.InsertRange(16, [string[]]@(
    'type MyBid = { bidId: number; amount: number; releasePlayerId: number | null };',
    'type RosterPlayer = { id: number; name: string; mantraRole: string };'
    ))
}

$okNavbar = Update-CodeFile -RelativePath "app\components\Navbar.tsx" -Marker '1F528' -MinLines 227 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 30) ---
    $lines.RemoveRange(29, 1)

    # --- Modifica 2 (riga originale 28) ---
    $lines.RemoveRange(27, 1)
    $lines.InsertRange(27, [string[]]@(
    '  { href: "/asta",        label: "Buste",       icon: "\u{1F528}" },'
    ))
}

# BottomNav.tsx: rimuove la voce 'Bacheca' dal menu in basso (mobile).
$okBottomNav = $true
$bottomNavPath = Join-Path (Get-Location).Path "app\components\BottomNav.tsx"
if (-not (Test-Path -LiteralPath $bottomNavPath)) {
    Write-Host "ERRORE: non trovo app\components\BottomNav.tsx" -ForegroundColor Red
    $okBottomNav = $false
} else {
    $bnBytes = [System.IO.File]::ReadAllBytes($bottomNavPath)
    $bnText = [System.Text.Encoding]::UTF8.GetString($bnBytes)
    if ($bnText -notmatch [regex]::Escape('label: "Bacheca"')) {
        Write-Host "app\components\BottomNav.tsx sembra gia aggiornato. Non faccio nulla." -ForegroundColor Yellow
    } else {
        $bnLines = New-Object System.Collections.Generic.List[string]
        $bnLines.AddRange([string[]]($bnText -split "`r`n|`n"))
        $bnLines.RemoveAll([Predicate[string]]{ param($l) $l -match [regex]::Escape('label: "Bacheca"') }) | Out-Null
        $bnNewText = [string]::Join("`r`n", $bnLines)
        [System.IO.File]::WriteAllText($bottomNavPath, $bnNewText, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "File aggiornato: app\components\BottomNav.tsx" -ForegroundColor Green
    }
}

$allOk = $okAutoMigrate -and $okDbMigrate -and $okAuctionLib -and $okAuctionAction -and $okAstaPage -and $okAstaClient -and $okNavbar -and $okBottomNav

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

git add app/lib/autoMigrate.ts app/actions/dbMigrate.ts app/lib/auction.ts app/actions/auction.ts "app/(main)/asta/page.tsx" "app/(main)/asta/AstaClient.tsx" app/components/Navbar.tsx app/components/BottomNav.tsx
$status = git status --porcelain -- app/lib/autoMigrate.ts app/actions/dbMigrate.ts app/lib/auction.ts app/actions/auction.ts "app/(main)/asta/page.tsx" "app/(main)/asta/AstaClient.tsx" app/components/Navbar.tsx app/components/BottomNav.tsx
if (-not $status) {
    Write-Host 'Nessuna modifica da committare (tutto gia allineato).' -ForegroundColor Yellow
} else {
    git commit -m "Asta a buste: svincolo automatico in fase di offerta, rinomina menu, rimuove Bacheca`n`nSe lo slot di ruolo e pieno, l'utente puo indicare gia nel modulo di offerta`nquale proprio giocatore svincolare per fare posto: lo svincolo scatta da`nsolo (e libera il posto negli svincolati) solo se l'offerta vince, altrimenti`nil giocatore resta in rosa. Corregge anche lo schema Market/MarketOffer nel`npercorso di auto-migrazione (dormiente) e rinomina 'Asta' in 'Buste' nel`nmenu, rimuovendo la voce Bacheca.`n`nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`nClaude-Session: https://claude.ai/code/session_01R1gaBcPLQJgEt53rDE5sGx"
    git push origin main
    Write-Host ''
    Write-Host 'Fatto: commit creato e pushato su GitHub. Vercel fara partire il nuovo deploy in automatico.' -ForegroundColor Green
    Write-Host 'IMPORTANTE: dopo il deploy, vai su /admin e premi di nuovo Esegui migrazione DB per aggiungere la colonna releasePlayerId.' -ForegroundColor Cyan
}
