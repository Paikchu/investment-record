/** Read-only report DTOs migrated from earning-report; generation and ingestion stay in the pipeline. */
import type { AnalysisFact, ManagerReview, PublishedSecReport, SecNodeSpecV2 } from "./sec-analysis.ts";

export type SecSummaryImportance = "high" | "medium" | "low";

export type SecEventCategory = "earnings_update" | "guidance" | "m&a" | "executive" | "legal" | "other";

export type SecSummaryBullet = {
  label: string;
  detail: string;
  importance: SecSummaryImportance;
};

export type SecHeadingCandidate = {
  title: string;
  level: number;
  start: number;
};

export type SecDocument = {
  text: string;
  headings: SecHeadingCandidate[];
};

export type SecNodeSpec = SecNodeSpecV2;

export type SecNodePlan = {
  nodes: SecNodeSpec[];
  outlineSections: number;
  clamped?: number;
  /** Planning defects worth publishing — invented history series ids. */
  warnings?: string[];
};

export type SecWorkflowEvidence = {
  start: number;
  end: number;
  score: number;
  reasons: string[];
  excerpt: string;
};

export type SecNodeResult = {
  id: string;
  title: string;
  status: "complete" | "empty" | "error";
  findings: SecSummaryBullet[];
  narrative: string;
  facts?: AnalysisFact[];
  evidence: SecWorkflowEvidence[];
  evidenceIds?: string[];
  error?: string;
};

export type SecFiling = {
  ticker: string;
  cik: string;
  cikNumber: number;
  companyName: string;
  form: string;
  filingDate: string;
  reportDate: string;
  accessionNumber: string;
  primaryDocument: string;
  description: string;
  items: string;
  documentUrl: string;
  indexUrl: string;
};

export type SecFilingSummary = {
  ticker: string;
  form: string;
  filingDate: string;
  accessionNumber: string;
  headline: string;
  bullets: SecSummaryBullet[];
  analystView: string;
  /** Event filings only: what kind of 8-K/6-K this is. */
  eventCategory?: SecEventCategory;
  report?: string;
  version?: number;
  nodes?: SecNodeResult[];
  plan?: SecNodePlan;
  managerReview?: ManagerReview;
  repairRounds?: number;
  source: "deepseek" | "error";
  generatedAt: string;
  error?: string;
};

export type SecFilingWithSummary = SecFiling & {
  summary: SecFilingSummary | null;
  analysis?: PublishedSecReport | null;
};

export type SecFilingFeed = {
  ticker: string;
  company: { ticker: string; cik: string; name: string } | null;
  filings: SecFilingWithSummary[];
  fetchedAt: string | null;
  status: "ready" | "empty" | "pending" | "unsupported" | "not_applicable" | "stale";
  error?: string;
};

export type SecCompany = {
  ticker: string;
  cik: string;
  cikNumber: number;
  name: string;
};


export type SecSubmissionPart = {
  /** SEC official `<TYPE>` marker, e.g. "8-K", "6-K", "EX-99.1". */
  type: string;
  filename: string;
  text: string;
};
