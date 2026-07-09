import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match === null) {
      continue;
    }
    const [, key, rawValue] = match;
    if (key !== undefined && rawValue !== undefined && process.env[key] === undefined) {
      process.env[key] = unquoteEnvValue(rawValue);
    }
  }
}

function defaultTriggerExecutionId(): string {
  const kstDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return `local-hermes-${kstDate}`;
}

loadEnvLocal();

const triggerExecutionId =
  process.env["HERMES_TRIGGER_EXECUTION_ID"]?.trim() || defaultTriggerExecutionId();
const { scanHermes } = await import("@/lib/hermes/service");

try {
  const result = await scanHermes(triggerExecutionId);
  if (result.kind === "blocked_by_budget") {
    process.stderr.write(`${JSON.stringify({ triggerExecutionId, ...result })}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`${JSON.stringify({ triggerExecutionId, ...result })}\n`);
  }
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown Hermes scan error";
  process.stderr.write(`${JSON.stringify({ triggerExecutionId, error: message })}\n`);
  process.exitCode = 1;
}
