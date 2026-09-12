import assert from "node:assert/strict";
import test from "node:test";
import { selectReportContinuity, loadReportContinuity, continuityReviewNode } from "../../workers/pipeline/src/sec/continuity.ts";
import { createAnalysisDatabase } from "./helpers/analysis-backend.ts";
import type { SecFiling } from "../../workers/pipeline/src/sec/sec.ts";

const filing = { ticker: "TEST", accessionNumber: "current", form: "10-Q", reportDate: "2026-06-30", filingDate: "2026-08-01" } as SecFiling;
const quote = "此前判断核心业务增长取决于订单转化与客户持续投入，需要后续财报确认。";
function row(id: string, form: string, reportDate: string, filingDate: string, extra = {}) {
  return { accessionNumber: id, form, reportDate, filingDate, documentUrl: `https://www.sec.gov/${id}`,
    payload: JSON.stringify({ ticker: "TEST", accessionNumber: id, source: "deepseek", generatedAt: `${filingDate}T12:00:00Z`, headline: id, report: quote, ...extra }) };
}

test("selects complete annual, previous quarter, year-ago and events without duplicate periods", () => {
  const rows = [row("annual", "10-K", "2025-12-31", "2026-02-01"), row("q1", "10-Q", "2026-03-31", "2026-05-01"),
    row("yoy", "10-Q", "2025-06-30", "2025-08-01"), row("event", "8-K", "2026-07-01", "2026-07-01", { eventCategory: "guidance" }),
    row("future", "10-Q", "2026-09-30", "2026-11-01"), row("current", "10-Q", "2026-06-30", "2026-08-01")];
  const context = selectReportContinuity(filing, rows);
  assert.deepEqual(context.reports.map((r) => r.accessionNumber), ["annual", "q1", "yoy", "event"]);
  assert.ok(context.reports.every((r) => r.text.endsWith(quote)));
  assert.equal(context.reports[0].reason, "latest_annual");
});

test("rejects later regenerated, oversized, malformed and foreign-company reports", () => {
  const context = selectReportContinuity(filing, [
    row("late", "10-K", "2025-12-31", "2026-02-01", { generatedAt: "2026-08-02T00:00:00Z" }),
    row("huge", "10-Q", "2026-03-31", "2026-05-01", { report: "x".repeat(16001) }),
    row("foreign", "10-Q", "2025-06-30", "2025-08-01", { ticker: "OTHER" }),
    { ...row("bad", "10-Q", "2026-03-31", "2026-05-01"), payload: "{" },
  ]);
  assert.deepEqual(context.reports, []);
  assert.equal(context.warnings.length, 2);
});

test("amendments replace duplicate periods and reused annual/year-ago is loaded once", () => {
  const context = selectReportContinuity({ ...filing, form: "10-K", reportDate: "2026-12-31", filingDate: "2027-02-01" }, [
    row("original", "10-K", "2025-12-31", "2026-02-01"), row("amended", "10-K/A", "2025-12-31", "2026-03-01"),
  ]);
  assert.deepEqual(context.reports.map((r) => r.accessionNumber), ["amended"]);
});

test("review checks old quote and current evidence; omission never becomes contradiction", () => {
  const context = selectReportContinuity(filing, [row("q1", "10-Q", "2026-03-31", "2026-05-01")]);
  const valid = { accessionNumber: "q1", priorJudgment: quote, status: "supported", evidenceIds: ["ev:current"], explanation: "本期证据显示订单转化改善。", nextTest: "继续验证现金回款。" };
  assert.match(continuityReviewNode(context, { reviews: [valid] }, new Set(["ev:current"])).findings[0].label, /得到支持/);
  for (const reviews of [[], [{ ...valid, priorJudgment: "编造的历史判断" }], [{ ...valid, evidenceIds: ["ev:old"] }]]) {
    const node = continuityReviewNode(context, { reviews }, new Set(["ev:current"]));
    assert.match(node.findings[0].label, /尚不能验证/);
    assert.doesNotMatch(node.findings[0].detail, /订单转化改善/);
  }
});

test("real migrated SQL loads historical reports and excludes the current accession", async () => {
  const db = await createAnalysisDatabase();
  for (const r of [row("q1", "10-Q", "2026-03-31", "2026-05-01"), row("current", "10-Q", "2026-06-30", "2026-08-01")]) {
    await db.prepare(`INSERT INTO sec_filings (filing_id,ticker,accession_number,cik,form,filing_date,report_date,document_url,index_url)
      VALUES (?, 'TEST', ?, '1', ?, ?, ?, ?, 'https://www.sec.gov')`).bind(r.accessionNumber, r.accessionNumber, r.form, r.filingDate, r.reportDate, r.documentUrl).run();
    await db.prepare("INSERT INTO sec_filing_summaries(ticker,accession_number,payload) VALUES('TEST',?,?)").bind(r.accessionNumber, r.payload).run();
  }
  const context = await loadReportContinuity(db, filing);
  assert.deepEqual(context.reports.map((r) => r.accessionNumber), ["q1"]);
});
