# Position Detail Workspace Dialog — Design QA

Historical visual QA record for the retired dialog UI; not a description of the current deployment or authentication model.

- Source visual truth: `/var/folders/49/38jdkjdd6td5m_rltdcm5bgm0000gn/T/codex-clipboard-e248fff2-fa1e-4581-9fd7-03211facd705.png`
- Final implementation screenshot: `/Users/max/Documents/Codex/2026-07-23/bang/work/design-qa/position-dialog-1440-final.png`
- Full-view comparison: `/Users/max/Documents/Codex/2026-07-23/bang/work/design-qa/source-vs-dialog-1440-final.jpg`
- Responsive evidence: `/Users/max/Documents/Codex/2026-07-23/bang/work/design-qa/position-dialog-820.png`, `/Users/max/Documents/Codex/2026-07-23/bang/work/design-qa/position-dialog-390.png`
- Viewports: desktop `1440 × 1000`, tablet `820 × 1000`, mobile `390 × 844`; device pixel ratio `1`.
- Source pixels: `1836 × 1340`. Final desktop pixels: `1440 × 1000`. Comparison normalized the source to `1392px` wide and compared it with the `1392 × 952` modal crop at equal density.
- State: homepage with the NVDA workspace dialog open. The historical local preview did not have the hosted runtime bindings, so the plan editor rendered its unavailable state.

## Fidelity Review

- Fonts and typography: existing serif/sans families, weights, hierarchy, numeric alignment, and ticker scale match the source.
- Spacing and layout: hero, five-metric summary, instrument table, thesis editor, and planning section preserve the source rhythm inside the added sticky modal toolbar.
- Colors and tokens: paper, navy ink, muted labels, profit green, borders, and backdrop use the existing product tokens.
- Image and asset fidelity: the source contains no raster imagery, logos, illustrations, or non-standard icons; no replacement assets were introduced.
- Copy and content: all holding metrics, contract labels, bilingual section kickers, field copy, and snapshot time remain intact.
- Focused comparison: the full-view montage keeps the table and form text readable, so a second crop was unnecessary.

## Comparison History

- Pass 1 found a P2 desktop proportion mismatch: modal content was narrower than the source and the thesis textarea was too short.
- Fix: expanded the desktop content body to `min(1360px, calc(100% - 48px))`, set the desktop plan editor to `83%`, and raised the textarea to `168px`.
- Pass 2: the final montage shows matching content proportions and vertical rhythm. No P0, P1, or P2 visual findings remain.

## Interaction Checks

- Held-position rows and the add-plan entry open dialogs without changing `/` or creating navigation history.
- Close button, backdrop click, and Escape close the detail dialog; page scroll unlocks and focus returns to the originating row.
- Dialog dimensions are `1392 × 952` at `1440px`, `772 × 952` at `820px`, and full-screen `390 × 844` on mobile.
- No horizontal overflow at any tested breakpoint. Browser console: no warnings or errors.
- Automated coverage verifies the authenticated plan-read route, plan-store save path, no-link homepage entry, responsive CSS, and retained standalone detail route.

## Residual Test Gap

- Plan loading and saving were not exercised in that historical local browser session because runtime bindings were unavailable; the unavailable state and storage/API tests passed.

final result: passed
