import assert from "node:assert/strict";
import test from "node:test";
import { formatStockFundamentalValue } from "../lib/stock-detail-format.ts";

test("fundamentals percentage values are not multiplied a second time", () => {
  assert.equal(formatStockFundamentalValue("68.585", { unitFamily: "percent", displaySign: "as_reported" }), "68.6%");
});
test("cash outflows follow their display contract without changing signed earnings", () => {
  assert.equal(formatStockFundamentalValue("-35802000000", { unitFamily: "currency", displaySign: "outflow_magnitude" }), "358.02 亿");
  assert.equal(formatStockFundamentalValue("-120000000", { unitFamily: "currency", displaySign: "as_reported" }), "-1.2 亿");
});
test("missing and invalid values stay absent while actual zero remains zero", () => {
  const spec = { unitFamily: "currency", displaySign: "as_reported" } as const;
  for (const value of [null, undefined, "", "not-a-number"]) assert.equal(formatStockFundamentalValue(value, spec), "—");
  assert.equal(formatStockFundamentalValue("0", spec), "0");
});
