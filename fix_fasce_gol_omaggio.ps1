$ErrorActionPreference = "Stop"

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

$okScoring = Update-CodeFile -RelativePath "app\lib\scoring.ts" -Marker "ScoreBand" -MinLines 428 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 321) ---
    $lines.RemoveRange(320, 1)
    $lines.InsertRange(320, [string[]]@(
    '  const bands = [...conv.bands].sort((a, b) => a.minScore - b.minScore);',
    '  if (bands.length === 0) return 0;',
    '  if (firstBandOverride !== undefined && firstBandOverride > 0) {',
    '    bands[0] = { ...bands[0], minScore: firstBandOverride };',
    '  }',
    '  if (score < bands[0].minScore) return 0;',
    '',
    '  const step = conv.extrapolateStep > 0 ? conv.extrapolateStep : 4;',
    '  for (let i = bands.length - 1; i >= 0; i--) {',
    '    if (score >= bands[i].minScore) {',
    '      if (i === bands.length - 1) {',
    '        return bands[i].goals + Math.floor((score - bands[i].minScore) / step);',
    '      }',
    '      return bands[i].goals;',
    '    }',
    '  }',
    '  return 0;'
    ))

    # --- Modifica 2 (riga originale 318) ---
    $lines.RemoveRange(317, 1)
    $lines.InsertRange(317, [string[]]@(
    '  conv: ScoreConversion = DEFAULT_SCORE_CONVERSION,',
    '  firstBandOverride?: number'
    ))

    # --- Modifica 3 (riga originale 309) ---
    $lines.RemoveRange(308, 6)
    $lines.InsertRange(308, [string[]]@(
    ' * Normalizza un oggetto scoreConversion letto dal DB (anche nel vecchio',
    ' * formato {enabled, minScore, step}, senza fasce esplicite) nel formato',
    ' * attuale a fasce. Cosi le leghe che avevano gia salvato minScore/step',
    ' * continuano a funzionare identiche a prima, e ogni campo nuovo mancante',
    ' * prende un default sicuro (disabilitato).',
    ' */',
    'export function normalizeScoreConversion(',
    '  raw: (Partial<ScoreConversion> & { minScore?: number; step?: number }) | null | undefined',
    '): ScoreConversion {',
    '  if (!raw) return { ...DEFAULT_SCORE_CONVERSION, bands: DEFAULT_SCORE_CONVERSION.bands.map((b) => ({ ...b })) };',
    '',
    '  let bands = raw.bands;',
    '  let extrapolateStep = raw.extrapolateStep;',
    '',
    '  if (!bands || !Array.isArray(bands) || bands.length === 0) {',
    '    // Formato precedente: fasce uniformi generate da minScore/step',
    '    const minScore = typeof raw.minScore === "number" ? raw.minScore : DEFAULT_SCORE_CONVERSION.bands[0].minScore;',
    '    const step = typeof raw.step === "number" && raw.step > 0 ? raw.step : DEFAULT_SCORE_CONVERSION.extrapolateStep;',
    '    bands = Array.from({ length: 6 }, (_, i) => ({ minScore: minScore + i * step, goals: i + 1 }));',
    '    extrapolateStep = step;',
    '  }',
    '  if (!extrapolateStep || extrapolateStep <= 0) extrapolateStep = DEFAULT_SCORE_CONVERSION.extrapolateStep;',
    '',
    '  return {',
    '    enabled: Boolean(raw.enabled),',
    '    bands: [...bands].sort((a, b) => a.minScore - b.minScore),',
    '    extrapolateStep,',
    '    homeFirstGoalThreshold: typeof raw.homeFirstGoalThreshold === "number" ? raw.homeFirstGoalThreshold : 0,',
    '    bonusGoalEnabled: Boolean(raw.bonusGoalEnabled),',
    '    bonusGoalDiffBandMargin:',
    '      typeof raw.bonusGoalDiffBandMargin === "number" ? raw.bonusGoalDiffBandMargin : DEFAULT_SCORE_CONVERSION.bonusGoalDiffBandMargin,',
    '    bonusGoalSameBandMargin:',
    '      typeof raw.bonusGoalSameBandMargin === "number" ? raw.bonusGoalSameBandMargin : DEFAULT_SCORE_CONVERSION.bonusGoalSameBandMargin,',
    '  };',
    '}',
    '',
    '/**',
    ' * Converte il punteggio totale di una formazione in numero di gol (sistema',
    ' * Mantra), usando le fasce configurate (non necessariamente a step fisso:',
    ' * le prime fasce possono essere piu larghe delle successive). Oltre',
    ' * l''ultima fascia definita, si continua ad aggiungere un gol ogni',
    ' * extrapolateStep punti. firstBandOverride sovrascrive SOLO la soglia',
    ' * della prima fascia (usato per la soglia fissa "quota" della squadra di',
    ' * casa, regola separata dal bonus punti fattore campo).'
    ))

    # --- Modifica 4 (riga originale 304) ---
    $lines.RemoveRange(303, 2)
    $lines.InsertRange(303, [string[]]@(
    '  bands: [',
    '    { minScore: 66, goals: 1 },',
    '    { minScore: 72, goals: 2 },',
    '    { minScore: 77, goals: 3 },',
    '    { minScore: 81, goals: 4 },',
    '    { minScore: 85, goals: 5 },',
    '    { minScore: 89, goals: 6 },',
    '  ],',
    '  extrapolateStep: 4,',
    '  homeFirstGoalThreshold: 0,',
    '  bonusGoalEnabled: false,',
    '  bonusGoalDiffBandMargin: 3,',
    '  bonusGoalSameBandMargin: 4,'
    ))

    # --- Modifica 5 (riga originale 302) ---
    $lines.InsertRange(301, [string[]]@(
    '// Fasce ufficiali di conversione punteggio->gol: le prime due sono piu larghe',
    '// (66-71,999 = 1 gol, 72-76,999 = 2 gol), poi si stabilizzano su 4 punti a gol.'
    ))

    # --- Modifica 6 (riga originale 298) ---
    $lines.RemoveRange(297, 2)
    $lines.InsertRange(297, [string[]]@(
    '  bands: ScoreBand[];       // fasce punteggio->gol, in ordine di minScore crescente',
    '  extrapolateStep: number;  // punti aggiuntivi per ogni gol oltre l''ultima fascia definita (default 4)',
    '  homeFirstGoalThreshold: number; // 0 = disabilitato; se >0, sovrascrive SOLO la soglia del 1 gol per la squadra di casa (fattore campo "quota fissa", indipendente dal bonus punti fattore campo)',
    '  bonusGoalEnabled: boolean;      // regola "vittoria e gol omaggio" (distacco minimo per fascia)',
    '  bonusGoalDiffBandMargin: number; // distacco minimo richiesto quando le due squadre sono in fasce diverse',
    '  bonusGoalSameBandMargin: number; // distacco minimo richiesto quando le due squadre sono nella stessa fascia'
    ))

    # --- Modifica 7 (riga originale 296) ---
    $lines.InsertRange(295, [string[]]@(
    'export type ScoreBand = { minScore: number; goals: number };',
    ''
    ))
}

$okVoteImporterA = Update-CodeFile -RelativePath "app\lib\voteImporter.ts" -Marker "Si usa SEMPRE la formazione di partenza" -MinLines 439 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 314) ---
    $lines.RemoveRange(313, 18)

    # --- Modifica 2 (riga originale 294) ---
    $lines.InsertRange(293, [string[]]@(
    '    defenseStartersByUser.set(',
    '      userId,',
    '      starterRows.map((s) => ({',
    '        mantraRole: s.mantraRole as string,',
    '        vote: s.vote as number | null,',
    '      }))',
    '    );',
    ''
    ))

    # --- Modifica 3 (riga originale 268) ---
    $lines.RemoveRange(267, 4)
    $lines.InsertRange(267, [string[]]@(
    '  // Titolari ORIGINALI (ruolo + voto grezzo, non fantavoto) di ciascun',
    '  // utente, per il modificatore difensivo calcolato piu sotto a livello di',
    '  // partita (serve conoscere ENTRAMBE le formazioni della partita, non solo',
    '  // la propria). Si usa SEMPRE la formazione di partenza, mai quella dopo',
    '  // le sostituzioni: un titolare assente (sv, senza voto) tra portiere e',
    '  // difensori disabilita il modificatore per quella squadra in quella',
    '  // giornata, indipendentemente da chi lo ha sostituito in panchina.'
    ))
}

$okVoteImporterB = Update-CodeFile -RelativePath "app\lib\voteImporter.ts" -Marker "gol omaggio" -MinLines 430 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 417) ---
    $lines.RemoveRange(416, 13)
    $lines.InsertRange(416, [string[]]@(
    '    } else {',
    '      // Distacco minimo di fantapunti per vincere (impostazione lega,',
    '      // minWinMargin): sotto questa soglia il risultato resta pareggio anche',
    '      // se un punteggio (o i gol da esso derivati) e piu alto dell altro.',
    '      // Calcolato sugli stessi punteggi mostrati (fattore campo gia incluso),',
    '      // cosi da coprire anche il caso "69.5 a 70" con margine reale 0.5.',
    '      const rawMargin = Math.abs(homeScore - awayScore);',
    '',
    '      if (rawMargin >= minWinMargin) {',
    '        if (scoreConversion.enabled && homeGoals !== null && awayGoals !== null) {',
    '          // Vittoria/sconfitta/pareggio decisi dagli STESSI gol mostrati nel tabellino',
    '          if (homeGoals > awayGoals) { homePoints = 3; awayPoints = 0; }',
    '          else if (awayGoals > homeGoals) { homePoints = 0; awayPoints = 3; }',
    '        } else {',
    '          // Senza conversione in gol: confronto diretto sugli STESSI punteggi mostrati',
    '          if (homeScore > awayScore) { homePoints = 3; awayPoints = 0; }',
    '          else if (awayScore > homeScore) { homePoints = 0; awayPoints = 3; }',
    '        }',
    '      }',
    '',
    '      // Il distacco minimo puo forzare un pareggio (rawMargin < minWinMargin)',
    '      // anche quando i gol convertiti sarebbero diversi (es. 71.5 vs 69.0 pt',
    '      // -> 2 vs 1 gol, ma sotto la soglia): senza questo allineamento si',
    '      // vedrebbe "2-1" etichettato "Pareggio", di nuovo un risultato mostrato',
    '      // che non corrisponde ai punti assegnati. Se il pareggio e stato deciso,',
    '      // i gol mostrati vengono allineati al piu basso dei due (non si regalano',
    '      // gol che il distacco minimo non ha confermato).',
    '      if (homePoints === 1 && awayPoints === 1 && homeGoals !== null && awayGoals !== null && homeGoals !== awayGoals) {',
    '        const tiedGoals = Math.min(homeGoals, awayGoals);',
    '        homeGoals = tiedGoals;',
    '        awayGoals = tiedGoals;',
    '      }'
    ))

    # --- Modifica 2 (riga originale 400) ---
    $lines.RemoveRange(399, 16)
    $lines.InsertRange(399, [string[]]@(
    '    if (scoreConversion.bonusGoalEnabled && scoreConversion.enabled && homeGoals !== null && awayGoals !== null) {',
    '      // Regola "vittoria e gol omaggio": distacco minimo diverso a seconda',
    '      // che le due squadre siano nella STESSA fascia (stessi gol convertiti,',
    '      // altrimenti sarebbe pareggio) o in fasce DIVERSE. Se il distacco',
    '      // richiesto e raggiunto, la squadra avanti vince E riceve un gol',
    '      // omaggio in piu rispetto a quanto darebbe la sola conversione; se',
    '      // non e raggiunto, e sempre pareggio (gol allineati al piu basso).',
    '      // Il vincitore deve inoltre aver raggiunto almeno la soglia del 1',
    '      // gol (la propria, se e la squadra di casa con soglia fissa). Per la',
    '      // squadra di casa la soglia include anche il bonus fattore campo',
    '      // (homeAdvantage): il punteggio mostrato lo contiene gia, quindi va',
    '      // sommato anche alla soglia richiesta, altrimenti il bonus farebbe',
    '      // raggiungere il minimo "gratis" (es. soglia 66 + fattore campo 2 =',
    '      // serve davvero 68, non 66).',
    '      const sameBand = homeGoals === awayGoals;',
    '      const requiredMargin = sameBand ? scoreConversion.bonusGoalSameBandMargin : scoreConversion.bonusGoalDiffBandMargin;',
    '      const diff = Math.round((homeScore - awayScore) * 100) / 100;',
    '      const leaderIsHome = diff > 0;',
    '      const leaderScore = leaderIsHome ? homeScore : awayScore;',
    '      const leaderMinThreshold = leaderIsHome',
    '        ? (homeFirstGoalOverride ?? scoreConversion.bands[0]?.minScore ?? 66) + homeAdvantage',
    '        : scoreConversion.bands[0]?.minScore ?? 66;',
    '',
    '      if (diff !== 0 && Math.abs(diff) >= requiredMargin && leaderScore >= leaderMinThreshold) {',
    '        if (leaderIsHome) { homePoints = 3; awayPoints = 0; homeGoals += 1; }',
    '        else { awayPoints = 3; homePoints = 0; awayGoals += 1; }',
    '      } else if (homeGoals !== awayGoals) {',
    '        const tiedGoals = Math.min(homeGoals, awayGoals);',
    '        homeGoals = tiedGoals;',
    '        awayGoals = tiedGoals;'
    ))

    # --- Modifica 3 (riga originale 393) ---
    $lines.RemoveRange(392, 2)
    $lines.InsertRange(392, [string[]]@(
    '    // Convert scores to goals (Mantra system): null quando la conversione e disabilitata.',
    '    // La squadra di casa puo avere una soglia fissa diversa per il 1 gol',
    '    // (homeFirstGoalThreshold, es. 68 invece di 66): regola separata dal',
    '    // bonus punti fattore campo, tocca solo la prima fascia.',
    '    const homeFirstGoalOverride =',
    '      scoreConversion.homeFirstGoalThreshold > 0 ? scoreConversion.homeFirstGoalThreshold : undefined;',
    '    let homeGoals = scoreConversion.enabled',
    '      ? convertScoreToGoals(homeScore, scoreConversion, homeFirstGoalOverride)',
    '      : null;'
    ))

    # --- Modifica 4 (riga originale 250) ---
    $lines.RemoveRange(249, 1)
    $lines.InsertRange(249, [string[]]@(
    '          scoreConversion = normalizeScoreConversion(JSON.parse(settingsRes.rows[0].scoreConversion as string));'
    ))

    # --- Modifica 5 (riga originale 16) ---
    $lines.InsertRange(15, [string[]]@(
    '  normalizeScoreConversion,'
    ))
}

$okSettings = Update-CodeFile -RelativePath "app\actions\settings.ts" -Marker "scoreConvBands" -MinLines 150 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 49) ---
    $lines.RemoveRange(48, 7)
    $lines.InsertRange(48, [string[]]@(
    '',
    '  // Fasce: array [{minScore, goals}, ...] inviato come JSON da un campo',
    '  // nascosto (l''editor e lato client). Righe non valide vengono scartate;',
    '  // se non resta nulla di valido si torna alle fasce di default.',
    '  let scoreConvBands = DEFAULT_SCORE_CONVERSION.bands;',
    '  try {',
    '    const rawBands = JSON.parse((formData.get("scoreConvBands") as string) || "[]");',
    '    if (Array.isArray(rawBands)) {',
    '      const cleaned = rawBands',
    '        .map((b) => ({',
    '          minScore: parseFloat(b?.minScore),',
    '          goals: parseInt(b?.goals, 10),',
    '        }))',
    '        .filter((b) => !isNaN(b.minScore) && !isNaN(b.goals) && b.goals > 0)',
    '        .sort((a, b) => a.minScore - b.minScore);',
    '      if (cleaned.length > 0) scoreConvBands = cleaned;',
    '    }',
    '  } catch { /* usa default */ }',
    '',
    '  const scoreConvExtrapolateStepRaw = parseFloat(formData.get("scoreConvExtrapolateStep") as string);',
    '  const scoreConvExtrapolateStep =',
    '    !isNaN(scoreConvExtrapolateStepRaw) && scoreConvExtrapolateStepRaw > 0',
    '      ? scoreConvExtrapolateStepRaw',
    '      : DEFAULT_SCORE_CONVERSION.extrapolateStep;',
    '',
    '  // Soglia fissa "quota" per il 1 gol della squadra di casa (0 = disabilitata,',
    '  // regola separata dal bonus punti fattore campo qui sopra)',
    '  const homeFirstGoalThresholdRaw = parseFloat(formData.get("scoreConvHomeFirstGoalThreshold") as string);',
    '  const homeFirstGoalThreshold =',
    '    !isNaN(homeFirstGoalThresholdRaw) && homeFirstGoalThresholdRaw > 0 ? homeFirstGoalThresholdRaw : 0;',
    '',
    '  // Regola "vittoria e gol omaggio" (distacco minimo per fascia)',
    '  const bonusGoalEnabled = formData.get("scoreConvBonusGoalEnabled") === "1";',
    '  const bonusGoalDiffBandMarginRaw = parseFloat(formData.get("scoreConvBonusGoalDiffBandMargin") as string);',
    '  const bonusGoalDiffBandMargin =',
    '    !isNaN(bonusGoalDiffBandMarginRaw) && bonusGoalDiffBandMarginRaw >= 0',
    '      ? bonusGoalDiffBandMarginRaw',
    '      : DEFAULT_SCORE_CONVERSION.bonusGoalDiffBandMargin;',
    '  const bonusGoalSameBandMarginRaw = parseFloat(formData.get("scoreConvBonusGoalSameBandMargin") as string);',
    '  const bonusGoalSameBandMargin =',
    '    !isNaN(bonusGoalSameBandMarginRaw) && bonusGoalSameBandMarginRaw >= 0',
    '      ? bonusGoalSameBandMarginRaw',
    '      : DEFAULT_SCORE_CONVERSION.bonusGoalSameBandMargin;',
    '',
    '  const scoreConversion = JSON.stringify(',
    '    normalizeScoreConversion({',
    '      enabled: scoreConvEnabled,',
    '      bands: scoreConvBands,',
    '      extrapolateStep: scoreConvExtrapolateStep,',
    '      homeFirstGoalThreshold,',
    '      bonusGoalEnabled,',
    '      bonusGoalDiffBandMargin,',
    '      bonusGoalSameBandMargin,',
    '    })',
    '  );'
    ))

    # --- Modifica 2 (riga originale 47) ---
    $lines.RemoveRange(46, 1)
    $lines.InsertRange(46, [string[]]@(
    '  // Score-to-goals conversion (Mantra system): fasce personalizzabili'
    ))

    # --- Modifica 3 (riga originale 6) ---
    $lines.RemoveRange(5, 1)
    $lines.InsertRange(5, [string[]]@(
    'import { DEFAULT_GOAL_THRESHOLDS, DEFAULT_SCORE_CONVERSION, normalizeScoreConversion } from "@/app/lib/scoring";'
    ))
}

$okPage = Update-CodeFile -RelativePath "app\(main)\admin\settings\page.tsx" -Marker "normalizeScoreConversion" -MinLines 100 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 51) ---
    $lines.RemoveRange(50, 1)
    $lines.InsertRange(50, [string[]]@(
    '            ? (() => { try { return normalizeScoreConversion(JSON.parse(raw.scoreConversion as string)); } catch { return DEFAULT_SCORE_CONVERSION; } })()'
    ))

    # --- Modifica 2 (riga originale 5) ---
    $lines.RemoveRange(4, 1)
    $lines.InsertRange(4, [string[]]@(
    'import { DEFAULT_GOAL_THRESHOLDS, DEFAULT_SCORE_CONVERSION, normalizeScoreConversion } from "@/app/lib/scoring";'
    ))
}

$okSettingsClient = Update-CodeFile -RelativePath "app\(main)\admin\settings\SettingsClient.tsx" -Marker "Vittoria e gol omaggio" -MinLines 560 -ApplyEdits {
    param($lines)

    # --- Modifica 1 (riga originale 443) ---
    $lines.InsertRange(442, [string[]]@(
    '        {/* Card 3b: Vittoria e gol omaggio */}',
    '        {scoreConvEnabled && (',
    '          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">',
    '            <div className="bg-pink-50 border-b border-pink-100 px-5 py-3 flex items-center gap-2">',
    '              <span className="text-lg">{"\u{1F381}"}</span>',
    '              <h2 className="font-semibold text-gray-700">Vittoria e gol omaggio</h2>',
    '            </div>',
    '            <div className="p-5 space-y-4">',
    '              <p className="text-sm text-gray-600">',
    '                Regola alternativa al &quot;Distacco minimo per vincere&quot; qui sopra: quando e attiva, decide',
    '                lei chi vince (e la ignora). Le due squadre devono raggiungere almeno la soglia del 1o gol; poi',
    '                serve un distacco minimo di fantapunti che dipende dal fatto che le due squadre siano nella{" "}',
    '                <strong>stessa fascia</strong> (stessi gol) o in <strong>fasce diverse</strong>. Se il distacco e',
    '                raggiunto, la squadra avanti vince e riceve anche un <strong>gol omaggio</strong> in piu rispetto',
    '                a quanto darebbe la sola conversione punteggio-gol.',
    '              </p>',
    '',
    '              <div className="flex items-center gap-3">',
    '                <button',
    '                  type="button"',
    '                  onClick={() => setBonusGoalEnabled(!bonusGoalEnabled)}',
    '                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${',
    '                    bonusGoalEnabled ? "bg-green-500" : "bg-gray-300"',
    '                  }`}',
    '                  aria-label="Attiva/disattiva vittoria e gol omaggio"',
    '                >',
    '                  <span',
    '                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${',
    '                      bonusGoalEnabled ? "translate-x-6" : "translate-x-0"',
    '                    }`}',
    '                  />',
    '                </button>',
    '                <span className="text-sm font-medium text-gray-700">',
    '                  {bonusGoalEnabled',
    '                    ? "\u2705 Attiva - sostituisce il distacco minimo per vincere qui sopra"',
    '                    : "\u274C Disattiva - resta valido il distacco minimo per vincere qui sopra"}',
    '                </span>',
    '              </div>',
    '',
    '              {bonusGoalEnabled && (',
    '                <div className="flex flex-wrap items-end gap-6">',
    '                  <div>',
    '                    <label className="text-sm font-medium text-gray-700 block mb-1">',
    '                      Distacco minimo - fasce diverse',
    '                    </label>',
    '                    <div className="flex items-center gap-2">',
    '                      <input',
    '                        type="number"',
    '                        min={0}',
    '                        max={20}',
    '                        step={0.5}',
    '                        value={bonusGoalDiffBandMargin}',
    '                        onChange={(e) => setBonusGoalDiffBandMargin(parseFloat(e.target.value) || 0)}',
    '                        className="w-24 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-400"',
    '                      />',
    '                      <span className="text-sm text-gray-500">pt</span>',
    '                    </div>',
    '                  </div>',
    '                  <div>',
    '                    <label className="text-sm font-medium text-gray-700 block mb-1">',
    '                      Distacco minimo - stessa fascia',
    '                    </label>',
    '                    <div className="flex items-center gap-2">',
    '                      <input',
    '                        type="number"',
    '                        min={0}',
    '                        max={20}',
    '                        step={0.5}',
    '                        value={bonusGoalSameBandMargin}',
    '                        onChange={(e) => setBonusGoalSameBandMargin(parseFloat(e.target.value) || 0)}',
    '                        className="w-24 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-400"',
    '                      />',
    '                      <span className="text-sm text-gray-500">pt</span>',
    '                    </div>',
    '                  </div>',
    '                </div>',
    '              )}',
    '            </div>',
    '          </div>',
    '        )}',
    ''
    ))

    # --- Modifica 2 (riga originale 430) ---
    $lines.RemoveRange(429, 4)

    # --- Modifica 3 (riga originale 416) ---
    $lines.RemoveRange(415, 10)
    $lines.InsertRange(415, [string[]]@(
    '                              <span className="inline-block font-bold px-3 py-0.5 rounded-full text-xs bg-green-100 text-green-700">',
    '                                {row.goals}'
    ))

    # --- Modifica 4 (riga originale 412) ---
    $lines.RemoveRange(411, 3)
    $lines.InsertRange(411, [string[]]@(
    '                        {scoreConvPreview.map((row) => (',
    '                          <tr key={row.range} className="bg-white even:bg-gray-50">',
    '                            <td className="border px-4 py-2 text-gray-700 font-mono text-xs">{row.range}</td>'
    ))

    # --- Modifica 5 (riga originale 396) ---
    $lines.InsertRange(395, [string[]]@(
    '                  <p className="text-xs text-gray-400 mt-1">',
    '                    Dopo l&apos;ultima fascia definita sopra, ogni {extrapolateStep}pt in piu = +1 gol',
    '                  </p>'
    ))

    # --- Modifica 6 (riga originale 375) ---
    $lines.RemoveRange(374, 20)
    $lines.InsertRange(374, [string[]]@(
    '                {/* Step di estrapolazione oltre l''ultima fascia */}',
    '                <div>',
    '                  <label className="text-sm font-medium text-gray-700 block mb-1">',
    '                    Punti per ogni gol oltre l&apos;ultima fascia',
    '                  </label>',
    '                  <div className="flex items-center gap-2">',
    '                    <input',
    '                      type="number"',
    '                      min={1}',
    '                      max={10}',
    '                      step={0.5}',
    '                      value={extrapolateStep}',
    '                      onChange={(e) => setExtrapolateStep(parseFloat(e.target.value) || 4)}',
    '                      className="w-24 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"',
    '                    />',
    '                    <span className="text-sm text-gray-500">pt / gol</span>'
    ))

    # --- Modifica 7 (riga originale 352) ---
    $lines.RemoveRange(351, 22)
    $lines.InsertRange(351, [string[]]@(
    '                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Fasce di conversione</h3>',
    '                  <p className="text-xs text-gray-500 mb-3">',
    '                    Ogni riga dice: a partire da quanti punti si ottiene quel numero di gol. Le fasce non devono',
    '                    per forza avere la stessa larghezza (es. la 1a e la 2a possono essere piu larghe delle altre).',
    '                  </p>',
    '                  <div className="overflow-x-auto">',
    '                    <table className="text-sm border-collapse w-full max-w-md">',
    '                      <thead>',
    '                        <tr className="bg-gray-50">',
    '                          <th className="border px-3 py-2 text-left font-medium text-gray-600">Da (pt)</th>',
    '                          <th className="border px-3 py-2 text-left font-medium text-gray-600">Gol</th>',
    '                          <th className="border px-3 py-2"></th>',
    '                        </tr>',
    '                      </thead>',
    '                      <tbody>',
    '                        {bands.map((band, idx) => (',
    '                          <tr key={idx} className="bg-white">',
    '                            <td className="border px-2 py-1.5">',
    '                              <input',
    '                                type="number"',
    '                                step={0.5}',
    '                                value={band.minScore}',
    '                                onChange={(e) => updateBand(idx, "minScore", parseFloat(e.target.value))}',
    '                                className="w-24 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"',
    '                              />',
    '                            </td>',
    '                            <td className="border px-2 py-1.5">',
    '                              <input',
    '                                type="number"',
    '                                min={1}',
    '                                value={band.goals}',
    '                                onChange={(e) => updateBand(idx, "goals", parseInt(e.target.value, 10))}',
    '                                className="w-16 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"',
    '                              />',
    '                            </td>',
    '                            <td className="border px-2 py-1.5 text-center">',
    '                              <button',
    '                                type="button"',
    '                                onClick={() => removeBand(idx)}',
    '                                disabled={bands.length <= 1}',
    '                                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"',
    '                              >',
    '                                x',
    '                              </button>',
    '                            </td>',
    '                          </tr>',
    '                        ))}',
    '                      </tbody>',
    '                    </table>',
    '                  </div>',
    '                  <button',
    '                    type="button"',
    '                    onClick={addBand}',
    '                    className="mt-2 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-lg font-medium"',
    '                  >',
    '                    + Aggiungi fascia',
    '                  </button>',
    '                </div>'
    ))

    # --- Modifica 8 (riga originale 350) ---
    $lines.RemoveRange(349, 1)
    $lines.InsertRange(349, [string[]]@(
    '                {/* Editor fasce */}'
    ))

    # --- Modifica 9 (riga originale 260) ---
    $lines.InsertRange(259, [string[]]@(
    '            {bonusGoalEnabled && (',
    '              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">',
    '                Hai attivato piu sotto la regola &quot;Vittoria e gol omaggio&quot;: quando e attiva,',
    '                questa impostazione viene ignorata (si usano le soglie per fascia di quella regola).',
    '              </p>',
    '            )}'
    ))

    # --- Modifica 10 (riga originale 245) ---
    $lines.InsertRange(244, [string[]]@(
    '',
    '            <div className="mt-5 pt-5 border-t border-gray-100">',
    '              <p className="text-sm text-gray-600 mb-3">',
    '                <strong>Regola separata</strong>: indipendentemente dal bonus punti qui sopra, puoi fissare una',
    '                soglia diversa (una &quot;quota&quot;) per il <strong>1o gol</strong> della sola squadra di casa,',
    '                invece della soglia normale della prima fascia (vedi Fasce di conversione piu sotto). Le fasce',
    '                successive (2o gol, 3o gol...) non cambiano.',
    '              </p>',
    '              <div>',
    '                <label className="text-sm font-medium text-gray-700 block mb-1">',
    '                  Quota 1o gol in casa',
    '                </label>',
    '                <div className="flex items-center gap-3">',
    '                  <input',
    '                    type="number"',
    '                    min={0}',
    '                    max={100}',
    '                    step={0.5}',
    '                    value={homeFirstGoalThreshold}',
    '                    onChange={(e) => setHomeFirstGoalThreshold(parseFloat(e.target.value) || 0)}',
    '                    className="w-28 border rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-500"',
    '                  />',
    '                  <span className="text-sm text-gray-500">',
    '                    punti {homeFirstGoalThreshold > 0 ? `(invece di ${sortedBands[0]?.minScore ?? 66})` : ""}',
    '                  </span>',
    '                </div>',
    '                <p className="text-xs text-gray-400 mt-1">',
    '                  Imposta <strong>0</strong> per disabilitare (si usa sempre la soglia normale della prima fascia)',
    '                </p>',
    '              </div>',
    '            </div>'
    ))

    # --- Modifica 11 (riga originale 98) ---
    $lines.RemoveRange(97, 2)
    $lines.InsertRange(97, [string[]]@(
    '        <input type="hidden" name="scoreConvBands" value={JSON.stringify(bands)} />',
    '        <input type="hidden" name="scoreConvExtrapolateStep" value={extrapolateStep} />',
    '        <input type="hidden" name="scoreConvHomeFirstGoalThreshold" value={homeFirstGoalThreshold} />',
    '        {/* Vittoria e gol omaggio */}',
    '        <input type="hidden" name="scoreConvBonusGoalEnabled" value={bonusGoalEnabled ? "1" : "0"} />',
    '        <input type="hidden" name="scoreConvBonusGoalDiffBandMargin" value={bonusGoalDiffBandMargin} />',
    '        <input type="hidden" name="scoreConvBonusGoalSameBandMargin" value={bonusGoalSameBandMargin} />'
    ))

    # --- Modifica 12 (riga originale 96) ---
    $lines.RemoveRange(95, 1)
    $lines.InsertRange(95, [string[]]@(
    '        {/* Conversione punteggio -> gol (fasce) */}'
    ))

    # --- Modifica 13 (riga originale 69) ---
    $lines.RemoveRange(68, 1)
    $lines.InsertRange(68, [string[]]@(
    '  }, [sortedBands, extrapolateStep]);'
    ))

    # --- Modifica 14 (riga originale 60) ---
    $lines.RemoveRange(59, 8)
    $lines.InsertRange(59, [string[]]@(
    '    const rows: { range: string; goals: string }[] = [];',
    '    if (sortedBands.length === 0) return rows;',
    '    rows.push({ range: `< ${sortedBands[0].minScore} pt`, goals: "0" });',
    '    sortedBands.forEach((band, i) => {',
    '      const next = sortedBands[i + 1];',
    '      if (next) {',
    '        const high = next.minScore - 0.5;',
    '        rows.push({',
    '          range: high >= band.minScore ? `${band.minScore} - ${high} pt` : `${band.minScore} pt`,',
    '          goals: String(band.goals),',
    '        });',
    '      } else {',
    '        const step = extrapolateStep > 0 ? extrapolateStep : 4;',
    '        rows.push({',
    '          range: `>= ${band.minScore} pt`,',
    '          goals: `${band.goals} (poi +1 ogni ${step}pt)`,',
    '        });',
    '      }',
    '    });'
    ))

    # --- Modifica 15 (riga originale 58) ---
    $lines.RemoveRange(57, 1)
    $lines.InsertRange(57, [string[]]@(
    '  const sortedBands = useMemo(',
    '    () => [...bands].filter((b) => !isNaN(b.minScore) && !isNaN(b.goals)).sort((a, b) => a.minScore - b.minScore),',
    '    [bands]',
    '  );',
    '',
    '  const updateBand = (idx: number, field: "minScore" | "goals", value: number) => {',
    '    setBands((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));',
    '  };',
    '  const removeBand = (idx: number) => {',
    '    setBands((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));',
    '  };',
    '  const addBand = () => {',
    '    setBands((prev) => {',
    '      const last = [...prev].sort((a, b) => a.minScore - b.minScore).at(-1);',
    '      const nextMin = last ? last.minScore + (extrapolateStep || 4) : 66;',
    '      const nextGoals = last ? last.goals + 1 : 1;',
    '      return [...prev, { minScore: nextMin, goals: nextGoals }];',
    '    });',
    '  };',
    '',
    '  /** Anteprima calcolata dalle fasce ordinate + step di estrapolazione oltre l''ultima */'
    ))

    # --- Modifica 16 (riga originale 52) ---
    $lines.RemoveRange(51, 2)
    $lines.InsertRange(51, [string[]]@(
    '  const [bands, setBands] = useState<{ minScore: number; goals: number }[]>(',
    '    settings.scoreConversion.bands.length > 0',
    '      ? settings.scoreConversion.bands',
    '      : [{ minScore: 66, goals: 1 }]',
    '  );',
    '  const [extrapolateStep, setExtrapolateStep] = useState<number>(settings.scoreConversion.extrapolateStep);',
    '',
    '  /* Soglia fissa "quota" per il 1o gol della squadra di casa (regola',
    '     separata dal bonus punti fattore campo qui sopra; 0 = disabilitata) */',
    '  const [homeFirstGoalThreshold, setHomeFirstGoalThreshold] = useState<number>(',
    '    settings.scoreConversion.homeFirstGoalThreshold',
    '  );',
    '',
    '  /* Regola "vittoria e gol omaggio" (distacco minimo per fascia, regola',
    '     separata dal "distacco minimo per vincere" qui sopra) */',
    '  const [bonusGoalEnabled, setBonusGoalEnabled] = useState<boolean>(settings.scoreConversion.bonusGoalEnabled);',
    '  const [bonusGoalDiffBandMargin, setBonusGoalDiffBandMargin] = useState<number>(',
    '    settings.scoreConversion.bonusGoalDiffBandMargin',
    '  );',
    '  const [bonusGoalSameBandMargin, setBonusGoalSameBandMargin] = useState<number>(',
    '    settings.scoreConversion.bonusGoalSameBandMargin',
    '  );'
    ))

    # --- Modifica 17 (riga originale 50) ---
    $lines.RemoveRange(49, 1)
    $lines.InsertRange(49, [string[]]@(
    '  /* -- Conversione punteggio -> gol (fasce personalizzabili) -- */'
    ))

    # --- Modifica 18 (riga originale 28) ---
    $lines.RemoveRange(27, 2)
    $lines.InsertRange(27, [string[]]@(
    '      bands: { minScore: number; goals: number }[];',
    '      extrapolateStep: number;',
    '      homeFirstGoalThreshold: number;',
    '      bonusGoalEnabled: boolean;',
    '      bonusGoalDiffBandMargin: number;',
    '      bonusGoalSameBandMargin: number;'
    ))
}

if ($okScoring -and $okVoteImporterA -and $okVoteImporterB -and $okSettings -and $okPage -and $okSettingsClient) {
    Write-Host ""
    Write-Host "Verifico il codice con TypeScript..." -ForegroundColor Cyan
    $tscOutput = npx tsc --noEmit 2>&1
    $tscOutput | Where-Object { $_ -notmatch "generated/prisma" }
    $tscErrors = $tscOutput | Where-Object { $_ -match "error TS" -and $_ -notmatch "generated/prisma" }

    if ($tscErrors) {
        Write-Host ""
        Write-Host "ERRORE: TypeScript ha trovato problemi (vedi sopra). Nessuna modifica e stata salvata su git." -ForegroundColor Red
    } else {
        git add "app\lib\scoring.ts" "app\lib\voteImporter.ts" "app\actions\settings.ts" "app\(main)\admin\settings\page.tsx" "app\(main)\admin\settings\SettingsClient.tsx"
        git commit -m "Fasce di conversione personalizzabili, quota fissa 1 gol in casa, regola vittoria e gol omaggio"
        git push

        Write-Host ""
        Write-Host "Fatto. Controlla il deploy su Vercel tra un minuto." -ForegroundColor Cyan
        Write-Host "IMPORTANTE: le nuove regole sono TUTTE disattivate di default (non cambia nulla finche non le attivi)." -ForegroundColor Yellow
        Write-Host "Vai su Admin - Impostazioni per configurarle, poi Admin - Voti - Calcola punteggi sulle giornate che vuoi ricalcolare." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Uno o piu file non sono stati aggiornati - controlla i messaggi rossi sopra. Nessuna modifica e stata salvata su git." -ForegroundColor Red
}
