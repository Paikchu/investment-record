import assert from "node:assert/strict";
import test from "node:test";
import { hasInternalSecAccess } from "../lib/sec-api.ts";

test("requires the exact internal refresh key", async () => {
  assert.equal(await hasInternalSecAccess(new Request("https://site.test"), "secret"), false);
  assert.equal(await hasInternalSecAccess(new Request("https://site.test", { headers: { "x-sec-refresh-key": "wrong" } }), "secret"), false);
  assert.equal(await hasInternalSecAccess(new Request("https://site.test", { headers: { "x-sec-refresh-key": "secret" } }), "secret"), true);
  assert.equal(await hasInternalSecAccess(new Request("https://site.test", { headers: { "x-sec-refresh-key": "secret" } }), ""), false);
});
