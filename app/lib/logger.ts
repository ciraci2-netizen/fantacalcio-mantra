/**
 * Structured logger — outputs JSON lines, searchable in Vercel logs.
 * Usage: log("import_votes", { matchday: 5, matched: 200, ms: 1200 })
 */

type LogLevel = "info" | "warn" | "error";

type LogEvent =
  | "import_votes"
  | "calculate_scores"
  | "auto_lock"
  | "lineup_save"
  | "scraper_retry"
  | "scraper_fail"
  | "cron_run"
  | "health_check"
  | "rate_limit_hit"
  | "error";

export function log(
  event: LogEvent,
  data: Record<string, unknown> = {},
  level: LogLevel = "info"
) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logError(event: LogEvent, error: unknown, extra: Record<string, unknown> = {}) {
  log(event, {
    ...extra,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack?.split("\n")[1]?.trim() : undefined,
  }, "error");
}
