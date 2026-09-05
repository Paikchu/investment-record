import type { IbkrPosition, IbkrTrade, TradeQueryPeriod } from "./portfolio-snapshot.ts";

const FLEX_BASE_URL = "https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService";
const RETRYABLE_CODES = new Set(["1001", "1003", "1004", "1005", "1006", "1007", "1008", "1009", "1018", "1019", "1021"]);
const TIME_ZONE_OFFSETS: Record<string, number> = {
  UTC: 0,
  GMT: 0,
  EST: -5 * 60,
  EDT: -4 * 60,
  CST: -6 * 60,
  CDT: -5 * 60,
  MST: -7 * 60,
  MDT: -6 * 60,
  PST: -8 * 60,
  PDT: -7 * 60,
};

export interface FlexSyncSource {
  provider: "IBKR";
  method: "FLEX";
  reportDate: string;
  queryId: string;
}

export interface FlexRawSyncInput {
  generatedAt: string;
  summary: { net_liquidation: number };
  balances: { balances: Array<{ currency: string; cash_balance: number }> };
  positions: { positions: IbkrPosition[] };
  trades: { trades: IbkrTrade[] };
  tradeStatus: "current";
  queryPeriod: TradeQueryPeriod;
  source: FlexSyncSource;
}

export type FlexRecord = Record<string, string>;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("IBKR Flex CSV contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

export function parseFlexSections(text: string): Map<string, FlexRecord[]> {
  const rows = parseCsv(text);
  const headers = new Map<string, string[]>();
  const sections = new Map<string, FlexRecord[]>();

  for (const row of rows) {
    const [kind, sectionCode, ...values] = row;
    if (!kind || !sectionCode) continue;
    if (kind === "HEADER") {
      headers.set(sectionCode, values);
      continue;
    }
    if (kind !== "DATA") continue;
    const header = headers.get(sectionCode);
    if (!header) throw new Error(`IBKR Flex section ${sectionCode} has data before its header`);
    const record = Object.fromEntries(header.map((name, index) => [name, values[index] ?? ""]));
    const existing = sections.get(sectionCode) ?? [];
    existing.push(record);
    sections.set(sectionCode, existing);
  }

  return sections;
}

function numberField(record: FlexRecord, name: string): number {
  const value = record[name]?.trim().replaceAll(",", "");
  if (!value) throw new Error(`IBKR Flex field ${name} is missing`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`IBKR Flex field ${name} is not numeric`);
  return parsed;
}

function optionalNumber(record: FlexRecord, name: string, fallback = 0): number {
  const value = record[name]?.trim().replaceAll(",", "");
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`IBKR Flex field ${name} is not numeric`);
  return parsed;
}

function isoDate(value: string): string {
  if (!/^\d{8}$/.test(value)) throw new Error(`Invalid IBKR Flex report date: ${value || "empty"}`);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function parseFlexDateTime(value: string): { iso: string; tradeDate: string } {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2});(\d{2})(\d{2})(\d{2})\s+([A-Za-z]{3,4})$/);
  if (!match) throw new Error(`Invalid timezone-qualified IBKR Flex time: ${value || "empty"}`);
  const [, year, month, day, hour, minute, second, zone] = match;
  const offsetMinutes = TIME_ZONE_OFFSETS[zone.toUpperCase()];
  if (offsetMinutes === undefined) throw new Error(`Unsupported IBKR Flex timezone: ${zone}`);
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) - offsetMinutes * 60_000;
  return { iso: new Date(utc).toISOString(), tradeDate: `${year}-${month}-${day}` };
}

function latestBy(records: FlexRecord[], field: string): FlexRecord | undefined {
  return [...records].filter((record) => record[field]).sort((left, right) => right[field].localeCompare(left[field]))[0];
}

export function normalizeFlexStatement(
  csv: string,
  options: { generatedAt: string; queryPeriod: TradeQueryPeriod; queryId: string },
): FlexRawSyncInput {
  const sections = parseFlexSections(csv);
  const nav = latestBy(sections.get("EQUT") ?? [], "ReportDate");
  if (!nav) throw new Error("IBKR Flex report has no NAV rows (EQUT)");
  const reportDateCompact = nav.ReportDate;
  const reportDate = isoDate(reportDateCompact);

  const cashRows = (sections.get("CRTT") ?? []).filter((record) => record.ToDate === reportDateCompact);
  const cash = cashRows.find((record) => record.CurrencyPrimary === "USD" && record.LevelOfDetail === "Currency")
    ?? cashRows.find((record) => record.CurrencyPrimary === "USD" && record.LevelOfDetail === "BaseCurrency")
    ?? cashRows.find((record) => record.LevelOfDetail === "BaseCurrency");
  if (!cash) throw new Error("IBKR Flex report has no USD/base-currency cash row (CRTT)");

  const positions = (sections.get("POST") ?? [])
    .filter((record) => record.ReportDate === reportDateCompact && record.LevelOfDetail === "SUMMARY")
    .filter((record) => record.AssetClass === "STK" || record.AssetClass === "OPT")
    .map((record): IbkrPosition => {
      const quantity = numberField(record, "Quantity");
      const multiplier = optionalNumber(record, "Multiplier", record.AssetClass === "OPT" ? 100 : 1);
      const costBasisMoney = optionalNumber(record, "CostBasisMoney", Number.NaN);
      const costBasisPrice = optionalNumber(record, "CostBasisPrice", Number.NaN);
      const averagePrice = Number.isFinite(costBasisMoney) && quantity !== 0 && multiplier !== 0
        ? costBasisMoney / quantity / multiplier
        : costBasisPrice;
      const underlying = record.UnderlyingSymbol || record.Symbol;
      const description = record.Description || record.Symbol;
      return {
        asset_class: record.AssetClass,
        average_price: averagePrice,
        contract_description: record.AssetClass === "OPT" && !description.toUpperCase().startsWith(underlying.toUpperCase())
          ? `${underlying} ${description}`
          : description,
        contract_id: numberField(record, "Conid"),
        currency: record.CurrencyPrimary,
        market_price: numberField(record, "MarkPrice"),
        market_value: numberField(record, "PositionValue"),
        position: quantity,
        symbol: underlying,
        unrealized_pnl: numberField(record, "FifoPnlUnrealized"),
      };
    });

  if (positions.length === 0) throw new Error("IBKR Flex report has no nonzero STK/OPT summary positions");

  const trades = (sections.get("TRNT") ?? [])
    .filter((record) => record.LevelOfDetail === "EXECUTION")
    .filter((record) => record.AssetClass === "STK" || record.AssetClass === "OPT")
    .map((record): IbkrTrade => {
      const time = parseFlexDateTime(record.DateTime);
      return {
        commission: optionalNumber(record, "IBCommission"),
        company_name: record.Description,
        description: record.Description,
        exchange: record.Exchange,
        net_amount: optionalNumber(record, "NetCash"),
        order_id: optionalNumber(record, "IBOrderID"),
        price: numberField(record, "TradePrice"),
        realized_pnl: optionalNumber(record, "FifoPnlRealized"),
        sec_type: record.AssetClass,
        side: record["Buy/Sell"],
        size: numberField(record, "Quantity"),
        symbol: record.AssetClass === "OPT" ? record.UnderlyingSymbol || record.Symbol : record.Symbol,
        trade_date: time.tradeDate,
        trade_id: record.TradeID,
        trade_time: time.iso,
      };
    });

  const tradeIds = new Set<string>();
  for (const trade of trades) {
    if (!trade.trade_id) throw new Error("IBKR Flex execution is missing TradeID");
    if (tradeIds.has(trade.trade_id)) throw new Error(`IBKR Flex report contains duplicate execution TradeID ${trade.trade_id}`);
    tradeIds.add(trade.trade_id);
  }

  return {
    generatedAt: options.generatedAt,
    summary: { net_liquidation: numberField(nav, "Total") },
    balances: { balances: [{ currency: "USD", cash_balance: numberField(cash, "EndingCash") }] },
    positions: { positions },
    trades: { trades },
    tradeStatus: "current",
    queryPeriod: options.queryPeriod,
    source: { provider: "IBKR", method: "FLEX", reportDate, queryId: options.queryId },
  };
}

function xmlValue(xml: string, tag: string): string | undefined {
  return xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))?.[1]?.trim();
}

function flexError(xml: string): { code: string; message: string } | null {
  const status = xmlValue(xml, "Status");
  if (status?.toLowerCase() !== "fail") return null;
  return { code: xmlValue(xml, "ErrorCode") ?? "unknown", message: xmlValue(xml, "ErrorMessage") ?? "Unknown Flex Web Service error" };
}

export async function fetchFlexStatement(options: {
  token: string;
  queryId: string;
  periodDays: number;
  userAgent?: string;
  fetcher?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  retryDelaysMs?: number[];
  baseUrl?: string;
}): Promise<string> {
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const retryDelays = options.retryDelaysMs ?? [2_000, 4_000, 8_000, 16_000, 30_000];
  const baseUrl = options.baseUrl ?? FLEX_BASE_URL;
  const headers = { "user-agent": options.userAgent ?? "max-investment-record/1.0" };
  if (!/^\d+$/.test(options.queryId)) throw new Error("IBKR Flex query ID must be numeric");
  if (!/^\d+$/.test(options.token)) throw new Error("IBKR Flex token must be numeric");
  if (!Number.isInteger(options.periodDays) || options.periodDays < 1 || options.periodDays > 365) {
    throw new Error("IBKR Flex period must be between 1 and 365 days");
  }

  const sendUrl = new URL(`${baseUrl}/SendRequest`);
  sendUrl.searchParams.set("t", options.token);
  sendUrl.searchParams.set("q", options.queryId);
  sendUrl.searchParams.set("v", "3");
  sendUrl.searchParams.set("p", String(options.periodDays));
  const sendResponse = await fetcher(sendUrl, { headers, signal: AbortSignal.timeout(30_000) });
  const sendBody = await sendResponse.text();
  if (!sendResponse.ok) throw new Error(`IBKR Flex SendRequest failed with HTTP ${sendResponse.status}`);
  const sendError = flexError(sendBody);
  if (sendError) throw new Error(`IBKR Flex ${sendError.code}: ${sendError.message}`);
  const referenceCode = xmlValue(sendBody, "ReferenceCode");
  if (!referenceCode || !/^\d+$/.test(referenceCode)) throw new Error("IBKR Flex SendRequest returned no valid reference code");

  const statementUrl = new URL(`${baseUrl}/GetStatement`);
  statementUrl.searchParams.set("t", options.token);
  statementUrl.searchParams.set("q", referenceCode);
  statementUrl.searchParams.set("v", "3");

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const response = await fetcher(statementUrl, { headers, signal: AbortSignal.timeout(30_000) });
    const body = await response.text();
    if (!response.ok) throw new Error(`IBKR Flex GetStatement failed with HTTP ${response.status}`);
    const error = body.trimStart().startsWith("<") ? flexError(body) : null;
    if (!error) {
      if (!body.includes('"HEADER"') || !body.includes('"DATA"')) throw new Error("IBKR Flex statement is not a sectioned CSV report");
      return body;
    }
    if (!RETRYABLE_CODES.has(error.code) || attempt === retryDelays.length) {
      throw new Error(`IBKR Flex ${error.code}: ${error.message}`);
    }
    await sleep(retryDelays[attempt]);
  }

  throw new Error("IBKR Flex statement could not be retrieved");
}

export function queryPeriodDays(period: TradeQueryPeriod, now: Date): number {
  if (period === "DAYS_7") return 7;
  if (period === "DAYS_30") return 30;
  if (period === "DAYS_60") return 60;
  if (period === "DAYS_90") return 90;
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  return Math.min(365, Math.max(1, Math.ceil((now.getTime() - start) / 86_400_000) + 1));
}
