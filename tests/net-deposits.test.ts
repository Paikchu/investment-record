import assert from "node:assert/strict";
import test from "node:test";
import { mergeCapitalFlows, totalNetDeposits, type CapitalFlowReport } from "../lib/net-deposits.ts";
const report: CapitalFlowReport = { accountId: "test", fundedDate: "2025-01-01", fromDate: "2025-01-01", toDate: "2025-12-31", flows: [{ id: "first", date: "2025-01-01", amount: 1000 }, { id: "second", date: "2025-12-01", amount: -100 }] };
test("retains older capital when the annual window rolls forward and replaces corrections without double counting", () => {
  const first = mergeCapitalFlows(undefined, report);
  const next = { ...report, fromDate: "2025-02-01", toDate: "2026-01-31", flows: [{ id: "second", date: "2025-12-01", amount: -150 }] };
  const merged = mergeCapitalFlows(first, next);
  assert.equal(totalNetDeposits(merged), 850);
  assert.deepEqual(mergeCapitalFlows(merged, next), merged);
});
test("rejects incomplete initial history, gaps, account changes and duplicate transactions", () => {
  assert.throws(() => mergeCapitalFlows(undefined, { ...report, fromDate: "2025-02-01" }), /bootstrap/);
  assert.throws(() => mergeCapitalFlows(report, { ...report, fromDate: "2026-01-02", toDate: "2026-02-01" }), /gap/);
  assert.throws(() => mergeCapitalFlows(report, { ...report, accountId: "other" }), /account/);
  assert.throws(() => mergeCapitalFlows(undefined, { ...report, flows: [report.flows[0], report.flows[0]] }), /duplicate/);
});
