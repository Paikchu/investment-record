import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLanguage, translate } from '../lib/language.ts';

test('language preferences accept only supported locales and fall back to Chinese', () => {
  assert.equal(parseLanguage('en'), 'en');
  for (const value of [null, undefined, '', 'fr', 'zh-CN']) assert.equal(parseLanguage(value), 'zh-CN');
});
test('interface translations preserve spacing, original notes and financial values', () => {
  assert.equal(translate('当前净值', 'en'), 'Net asset value');
  assert.equal(translate(' 当前持仓 ', 'en'), ' Current holdings ');
  for (const text of ['当前净值', '自定义持仓原因', '$123,456.78', 'AAPL']) assert.equal(translate(text, 'zh-CN'), text);
  assert.equal(translate('自定义持仓原因', 'en'), '自定义持仓原因');
  assert.equal(translate('$123,456.78', 'en'), '$123,456.78');
});
