export interface CapitalFlow { id: string; date: string; amount: number }
export interface CapitalFlowReport {
  accountId: string;
  fundedDate: string;
  fromDate: string;
  toDate: string;
  flows: CapitalFlow[];
}
export type CapitalFlowHistory = CapitalFlowReport;

// Replace the overlapping report window, retaining older transactions forever.
export function mergeCapitalFlows(previous: CapitalFlowHistory | undefined, report: CapitalFlowReport): CapitalFlowHistory {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(date).toISOString().slice(0, 10) === date;
  if (![report.fromDate, report.toDate, report.fundedDate].every(validDate) || report.fromDate > report.toDate) throw new Error("Invalid capital flow coverage dates");
  if (previous && (previous.accountId !== report.accountId || previous.fundedDate !== report.fundedDate)) throw new Error("Capital flow account changed");
  if (!previous && report.fromDate > report.fundedDate) throw new Error("Capital flow report does not cover first funding; historical bootstrap required");
  if (previous && (report.toDate < previous.toDate || Date.parse(report.fromDate) > Date.parse(previous.toDate) + 86400000)) throw new Error("Capital flow report has a coverage gap or is stale");
  const ids = new Set<string>();
  for (const flow of report.flows) {
    if (!flow.id || ids.has(flow.id) || !validDate(flow.date) || flow.date < report.fromDate || flow.date > report.toDate || !Number.isFinite(flow.amount)) throw new Error("Invalid or duplicate capital flow");
    ids.add(flow.id);
  }
  const retained = (previous?.flows ?? []).filter(flow => flow.date < report.fromDate && !ids.has(flow.id));
  return { ...report, fromDate: previous && previous.fromDate < report.fromDate ? previous.fromDate : report.fromDate, flows: [...retained, ...report.flows].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)) };
}

export function totalNetDeposits(history: CapitalFlowHistory): number {
  return Math.round(history.flows.reduce((sum, flow) => sum + flow.amount, 0) * 100) / 100;
}
