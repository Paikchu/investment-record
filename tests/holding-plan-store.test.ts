import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { getHoldingPlan, listHoldingPlans, saveHoldingPlan } from "../lib/holding-plan-store.ts";

function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE holding_plans (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, ticker TEXT NOT NULL, company_name TEXT NOT NULL, holding_reason TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(owner_email, ticker));
    CREATE TABLE plan_levels (id TEXT PRIMARY KEY, plan_id TEXT REFERENCES holding_plans(id), action TEXT, price_cents INTEGER, size_note TEXT, trigger_note TEXT, sort_order INTEGER);`);
  const database = {
    prepare(sql: string) {
      return { bind(...values: unknown[]) {
        const bindings = values as Array<string | number | null>;
        return { sql, bindings,
          async first<T>() { return (sqlite.prepare(sql).get(...bindings) ?? null) as T | null; },
          async all<T>() { return { results: sqlite.prepare(sql).all(...bindings).map(row => ({ ...row })) as T[] }; },
        };
      } };
    },
    async batch(statements: unknown[]) {
      sqlite.exec("BEGIN");
      try {
        for (const entry of statements) {
          const { sql, bindings } = entry as { sql: string; bindings: Array<string | number | null> };
          sqlite.prepare(sql).run(...bindings);
        }
        sqlite.exec("COMMIT");
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
      return [];
    },
  };
  return { sqlite, database };
}

const input = { ticker: "AAPL", holdingReason: "Services growth", levels: [{ id: "client-id", action: "add" as const, priceCents: 19000, sizeNote: "20 股", triggerNote: "估值回落", sortOrder: 0 }] };

test("shared plan can be saved, read and replaced without a user identity", async () => {
  const { sqlite, database } = createDatabase();
  try {
    const saved = await saveHoldingPlan(database, "Apple", input);
    assert.deepEqual(await getHoldingPlan(database, "AAPL"), saved);
    const edited = await saveHoldingPlan(database, "Apple", { ...input, holdingReason: "Updated by another visitor", levels: [] });
    assert.equal(edited.id, saved.id);
    assert.deepEqual(await getHoldingPlan(database, "AAPL"), edited);
    assert.equal((await listHoldingPlans(database)).length, 1);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM plan_levels").get()?.n, 0);
  } finally { sqlite.close(); }
});

test("latest legacy plan remains readable and editable; older records remain intact", async () => {
  const { sqlite, database } = createDatabase();
  try {
    sqlite.exec(`INSERT INTO holding_plans VALUES ('old', 'old@example.com', 'AAPL', 'Apple', 'older', '2025', '2025');
      INSERT INTO holding_plans VALUES ('recent', 'recent@example.com', 'AAPL', 'Apple', 'latest', '2026', '2026');
      INSERT INTO plan_levels VALUES ('client-id', 'old', 'add', 100, '', '', 0);`);
    assert.equal((await getHoldingPlan(database, "AAPL"))?.id, "recent");
    assert.deepEqual((await listHoldingPlans(database)).map(p => p.id), ["recent"]);
    const saved = await saveHoldingPlan(database, "Apple", input);
    assert.equal(saved.id, "recent");
    assert.deepEqual(await getHoldingPlan(database, "AAPL"), saved);
    assert.equal(sqlite.prepare("SELECT holding_reason FROM holding_plans WHERE id = 'old'").get()?.holding_reason, "older");
    assert.equal(sqlite.prepare("SELECT plan_id FROM plan_levels WHERE id = 'client-id'").get()?.plan_id, "old");
  } finally { sqlite.close(); }
});
