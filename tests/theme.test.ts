import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { themeScript } from '../lib/theme-script.ts';
import { buildTradingViewConfig } from '../lib/tradingview.ts';

for (const [saved, systemDark, expected] of [['light', true, false], ['dark', false, true], ['system', true, true], [null, false, false], ['invalid', true, true]] as const) {
  test(`initial theme ${saved} / system dark ${systemDark}`, () => {
    let dark = false;
    const meta = { content: '' };
    const root = { classList: { toggle: (_: string, value: boolean) => { dark = value; } }, style: { colorScheme: '' } };
    runInNewContext(themeScript, { localStorage: { getItem: () => saved }, matchMedia: () => ({ matches: systemDark }), document: { documentElement: root, querySelector: () => meta } });
    assert.equal(dark, expected);
    assert.equal(meta.content, expected ? '#18181b' : '#fafafa');
    assert.equal(root.style.colorScheme, expected ? 'dark' : 'light');
  });
}
test('blocked storage falls back to system', () => {
  let dark = false;
  runInNewContext(themeScript, { localStorage: { getItem: () => { throw Error('blocked'); } }, matchMedia: () => ({ matches: true }), document: { documentElement: { classList: { toggle: (_: string, value: boolean) => { dark = value; } }, style: {} }, querySelector: () => null } });
  assert.equal(dark, true);
});
test('charts follow theme while retaining their symbol', () => {
  const config = buildTradingViewConfig('AMEX:SPY', 'dark');
  assert.equal(config.theme, 'dark');
  assert.equal(config.backgroundColor, '#18181b');
  assert.equal(config.symbol, 'AMEX:SPY');
});
