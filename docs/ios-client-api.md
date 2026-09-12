# Investment Record iOS client

The SwiftUI client lives in `/Users/max/Developer/InvestmentPlanApp`. It uses the same public Web API, not the Pipeline's credentialed origin. No Pipeline token or provider key belongs in the app.

## Portfolio read

`GET /api/mobile/v1/portfolio`, `Cache-Control: private, no-store`.

`schemaVersion` is `mobile-portfolio.v1`. The payload is built by `lib/mobile-portfolio.ts` from the same snapshot and accounting helpers as the Web homepage:

- `account`: snapshot account plus net P&L, return, leverage and net assets excluding option unrealized P&L.
- `positionGroups`, `historicalPositionGroups`, stock/option/net position values.
- `allocation`, `sectorAllocation`, `heatmapHoldings`: the existing Web projections; clients must not substitute gross exposure for net-asset allocation.
- `trades`: display fields only; broker order/query/position identifiers are excluded.
- `tradeSync`: delayed/current status separate from the portfolio read.
- `generatedAt`: original snapshot timestamp, never the request time.
- `dataSource`: `live` means the database read succeeded, not that the underlying snapshot is real-time. `fallback` means the checked-in fallback used by Web was returned after the DB read failed.

This route has the same public read boundary as the existing Web portfolio page. It does not create a new identity or grant access to private Pipeline routes.

## Existing endpoints

Search, quotes, earnings, company analysis, fundamentals, filing pagination and filing detail retain their existing contracts. Plans use the existing list/detail GET and ticker PUT routes. PUT expects `holdingReason` and `levels` (`priceCents`, action, notes, order), and the existing same-origin header check. Origin is not authentication. This change neither weakens nor adds to the existing Web authorization scheme.

## Verification and release

Focused contract tests: `tests/mobile-portfolio.test.ts`. Run with the existing tsx test configuration. The iOS DTO has been checked against generated portfolio JSON and real read responses for the existing endpoints.

The new route requires a normal origin/main automatic deployment before the production iOS homepage can use it. No manual Wrangler deployment. Only the main application target changes; no Pipeline code or migration changes are required.
