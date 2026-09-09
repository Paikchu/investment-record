import assert from "node:assert/strict";
import test from "node:test";

test("parses the contract labels the broker actually sends", async () => {
  const { parseOptionContract } = await import("../lib/option-contract.ts");

  assert.deepEqual(parseOptionContract("NVDA 15JAN27 180 P"), {
    underlying: "NVDA", expiry: "2027-01-15", strike: 180, right: "put",
  });
  assert.deepEqual(parseOptionContract("NVDA Jan15'27 180 PUT @AMEX"), {
    underlying: "NVDA", expiry: "2027-01-15", strike: 180, right: "put",
  });
  assert.deepEqual(parseOptionContract("INTC Nov20'26 70 PUT @AMEX"), {
    underlying: "INTC", expiry: "2026-11-20", strike: 70, right: "put",
  });
  assert.deepEqual(parseOptionContract("AAPL 19JUN26 232.5 C"), {
    underlying: "AAPL", expiry: "2026-06-19", strike: 232.5, right: "call",
  });
  assert.deepEqual(parseOptionContract("NVDA 270115P00180000"), {
    underlying: "NVDA", expiry: "2027-01-15", strike: 180, right: "put",
  });
});

test("falls back to the raw label instead of guessing", async () => {
  const { parseOptionContract } = await import("../lib/option-contract.ts");

  assert.equal(parseOptionContract("NVDA"), null);
  assert.equal(parseOptionContract("NVIDIA CORP"), null);
  assert.equal(parseOptionContract("NVDA 15XXX27 180 P"), null);
});

test("reads a written contract as an obligation", async () => {
  const { optionSide } = await import("../lib/option-contract.ts");

  assert.equal(optionSide(-1), "short");
  assert.equal(optionSide(2), "long");
  assert.equal(optionSide(0), "long");
});

test("counts days to expiry in UTC so the server and browser agree", async () => {
  const { daysToExpiry } = await import("../lib/option-contract.ts");

  assert.equal(daysToExpiry("2027-01-15", "2026-09-09T23:40:00.000Z"), 128);
  assert.equal(daysToExpiry("2026-09-09", "2026-09-09T00:00:01.000Z"), 0);
  assert.equal(daysToExpiry("2026-09-01", "2026-09-09T12:00:00.000Z"), -8);
  assert.equal(daysToExpiry("not-a-date", "2026-09-09T12:00:00.000Z"), null);
});

test("flags moneyness from the underlying quote", async () => {
  const { optionMoneyness, parseOptionContract } = await import("../lib/option-contract.ts");
  const put = parseOptionContract("NVDA 15JAN27 180 P")!;
  const call = parseOptionContract("NVDA 15JAN27 180 C")!;

  assert.equal(optionMoneyness(put, 224.2), "otm");
  assert.equal(optionMoneyness(put, 150), "itm");
  assert.equal(optionMoneyness(call, 224.2), "itm");
  assert.equal(optionMoneyness(call, 150), "otm");
  assert.equal(optionMoneyness(put, 180.4), "atm");
  assert.equal(optionMoneyness(put, undefined), null);
});

test("prints strikes without inventing cents", async () => {
  const { strikeLabel } = await import("../lib/option-contract.ts");

  assert.equal(strikeLabel(180), "$180");
  assert.equal(strikeLabel(232.5), "$232.50");
  assert.equal(strikeLabel(1180), "$1,180");
});
