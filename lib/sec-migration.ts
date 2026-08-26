export const SEC_MIGRATION_TABLES = [
  "sec_cache",
  "sec_filing_summaries",
  "sec_filings",
  "sec_periods",
  "sec_filing_periods",
  "sec_filing_blocks",
  "sec_evidence",
  "sec_facts",
  "sec_module_snapshots",
  "sec_memory_items",
  "sec_memory_events",
  "sec_memory_jobs",
  "sec_memory_extractions",
  "sec_company_memory_threads",
  "sec_comparisons",
  "sec_analysis_runs",
  "sec_analysis_jobs",
  "sec_published_reports",
] as const;

export type SecMigrationTable = (typeof SEC_MIGRATION_TABLES)[number];

export function isSecMigrationTable(value: string): value is SecMigrationTable {
  return (SEC_MIGRATION_TABLES as readonly string[]).includes(value);
}

export type MigrationRow = Record<string, unknown>;

export async function readMigrationPage(database: MigrationDatabase, table: SecMigrationTable, cursor: number, limit: number) {
  const safeCursor = Math.max(0, Math.trunc(cursor) || 0);
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit) || 50));
  const result = await database.prepare(`SELECT * FROM ${table} ORDER BY rowid LIMIT ? OFFSET ?`).bind(safeLimit + 1, safeCursor).all<MigrationRow>();
  const page = result.results.slice(0, safeLimit);
  const rows = await Promise.all(page.map(async (row) => ({ ...row, _sha256: await sha256(canonicalJson(row)) })));
  return {
    table,
    cursor: safeCursor,
    nextCursor: result.results.length > safeLimit ? safeCursor + safeLimit : null,
    rows,
  };
}

export type MigrationStatement = { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }>; }; };
export type MigrationDatabase = { prepare(sql: string): MigrationStatement };

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
