export type OptionRight = "call" | "put";
export type OptionSide = "long" | "short";
export type OptionMoneyness = "itm" | "atm" | "otm";

export type OptionContractDetail = {
  underlying: string;
  expiry: string;
  strike: number;
  right: OptionRight;
};

const monthNumbers: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/** `NVDA 15JAN27 180 P` — the IBKR local symbol shown by live quotes. */
const localSymbol = /^([A-Z][A-Z0-9.]*)\s+(\d{1,2})([A-Z]{3})(\d{2})\s+([\d.]+)\s+([CP])$/i;
/** `NVDA Jan15'27 180 PUT @AMEX` — the Flex contract description stored in snapshots. */
const flexDescription = /^([A-Z][A-Z0-9.]*)\s+([A-Z]{3})(\d{1,2})'(\d{2})\s+([\d.]+)\s+(CALL|PUT)\b/i;
/** `NVDA 270115P00180000` — the OCC option symbol. */
const occSymbol = /^([A-Z][A-Z0-9.]*)\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/i;

function isoDate(year: string, month: string, day: string): string | null {
  const monthNumber = monthNumbers[month.toUpperCase()] ?? Number(month);
  const dayNumber = Number(day);
  if (!monthNumber || monthNumber > 12 || !dayNumber || dayNumber > 31) return null;
  return `20${year}-${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
}

function detail(underlying: string, expiry: string | null, strike: number, right: string): OptionContractDetail | null {
  if (!expiry || !Number.isFinite(strike) || strike <= 0) return null;
  return { underlying: underlying.toUpperCase(), expiry, strike, right: right[0].toUpperCase() === "P" ? "put" : "call" };
}

/** Splits a broker contract label into its parts, or returns null so callers can fall back to the raw label. */
export function parseOptionContract(description: string): OptionContractDetail | null {
  const label = description.trim();

  const local = localSymbol.exec(label);
  if (local) return detail(local[1], isoDate(local[4], local[3], local[2]), Number(local[5]), local[6]);

  const flex = flexDescription.exec(label);
  if (flex) return detail(flex[1], isoDate(flex[4], flex[2], flex[3]), Number(flex[5]), flex[6]);

  const occ = occSymbol.exec(label);
  if (occ) return detail(occ[1], isoDate(occ[2], occ[3], occ[4]), Number(occ[6]) / 1000, occ[5]);

  return null;
}

/** A negative position is written (sold), which carries assignment risk rather than a premium claim. */
export function optionSide(quantity: number): OptionSide {
  return quantity < 0 ? "short" : "long";
}

/** Whole calendar days between two ISO dates, read in UTC so server and browser agree. */
export function daysToExpiry(expiry: string, asOf: string): number | null {
  const end = Date.parse(`${expiry}T00:00:00Z`);
  const start = Date.parse(`${asOf.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(end) || Number.isNaN(start)) return null;
  return Math.round((end - start) / 86_400_000);
}

export function optionMoneyness(contract: OptionContractDetail, underlyingPrice?: number): OptionMoneyness | null {
  if (!underlyingPrice || !Number.isFinite(underlyingPrice)) return null;
  const distance = (underlyingPrice - contract.strike) / contract.strike;
  if (Math.abs(distance) <= 0.005) return "atm";
  const inTheMoney = contract.right === "call" ? distance > 0 : distance < 0;
  return inTheMoney ? "itm" : "otm";
}

/** Whole strikes stay whole so `$180` never reads as `$180.00`; fractional chains keep both cents. */
export function strikeLabel(strike: number): string {
  const fractionDigits = Number.isInteger(strike) ? 0 : 2;
  return `$${new Intl.NumberFormat("en-US", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(strike)}`;
}
