import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSecTrends, composeSecPresentation } from '../../workers/pipeline/src/sec/presentation.ts';
import { buildSecAnalysisBrief, type SecHistorySnapshot } from '../../workers/pipeline/src/sec/analysis.ts';
import { prepareSecFiling } from '../../workers/pipeline/src/sec/pipeline.ts';
import type { SecFiling, SecNodeResult } from '../../workers/pipeline/src/sec/sec.ts';

const node: SecNodeResult = { id: 'business', title: '需求质量', status: 'complete', narrative: '客户用量增加推动增长。', findings: [], evidence: [{ start: 0, end: 15, excerpt: 'Customer usage.', score: 80, reasons: [] }] };
const composition = { sections: [{ title: '公司靠什么增长', layout: 'grid', blocks: [{ type: 'narrative', nodeId: 'business', text: 'invented' }, { type: 'chart', nodeId: 'business', metricKey: 'revenue', mark: 'bar', points: [999] }] }] };
const trend = { metricKey: 'revenue', unit: 'USD', basis: 'gaap', periodScope: 'annual' as const, points: [{ date: '2025-06-30', value: 100, accession: 'old' }, { date: '2026-06-30', value: 120, accession: 'new' }] };

test('composition resolves node text and chart data exclusively from trusted inputs', () => {
  const result = composeSecPresentation(composition, [node], [], [trend]);
  assert.equal(result?.sections[0].layout, 'grid');
  assert.deepEqual(result?.sections[0].blocks[0], { type: 'prose', id: 'sec-composed-1-block-1', title: '', text: node.narrative });
  assert.equal(result?.sections[0].blocks[1].type, 'sec_chart');
  assert.doesNotMatch(JSON.stringify(result), /invented|999/);
});

test('invalid references, unknown blocks and omitted business nodes fall back to the legacy report', () => {
  for (const block of [{ type: 'html', nodeId: 'business' }, { type: 'narrative', nodeId: 'missing' }, { type: 'chart', metricKey: 'invented' }, { type: 'metrics', metricKeys: ['missing'] }]) {
    assert.equal(composeSecPresentation({ sections: [{ title: 'Test', blocks: [block] }] }, [node], [], [trend]), undefined);
  }
  assert.equal(composeSecPresentation(composition, [node, { ...node, id: 'omitted' }], [], [trend]), undefined);
  assert.equal(composeSecPresentation({}, [node], [], []), undefined);
});

test('charts exclude future filings, other units and duplicate periods', () => {
  const point = (date: string, value: string, filed = date) => ({ observationId: date, seriesId: 'revenue' as const, metricKey: 'revenue', value, unit: 'USD', currency: 'USD', basis: 'gaap' as const, periodScope: 'annual' as const, endDate: date, sourceAccession: date, sourceFiledAt: filed, sourceVersion: 'test', qualityStatus: 'validated_xbrl' as const });
  const history: SecHistorySnapshot = { registryVersion: 'sec-canonical-series.v1', series: [{ seriesId: 'revenue', quarters: [], annual: [point('2026-06-30', '120'), point('2026-06-30', '999', '2027-01-01'), point('2025-06-30', '100'), { ...point('2024-06-30', '80'), unit: 'EUR', currency: 'EUR' }, point('2027-06-30', '200')] }] };
  const brief = buildSecAnalysisBrief({ ticker: 'TEST', filingId: 'new', periodId: 'TEST:2026-06-30:annual', periodScope: 'annual', reportDate: '2026-06-30', history, memorySummary: '', memoryItems: [] });
  const trends = buildSecTrends(brief, '2026-07-30', '2026-06-30');
  assert.deepEqual(trends[0].points.map((p) => p.value), [100, 120]);
});

const filing: SecFiling = { ticker: 'TEST', companyName: 'Test', cik: '0000000001', cikNumber: 1, form: '10-K', accessionNumber: '0000000001-26-000001', filingDate: '2026-07-30', reportDate: '2026-06-30', primaryDocument: 'annual.htm', description: '', items: '', documentUrl: 'https://www.sec.gov/annual.htm', indexUrl: 'https://www.sec.gov/index.htm' };
const part = (type: string, filename: string, text: string) => `<DOCUMENT>\n<TYPE>${type}\n<FILENAME>${filename}\n<TEXT>${text}</TEXT>\n</DOCUMENT>\n`;

test('periodic filing includes a text deck with separate provenance and marks PDFs as unread', async () => {
  const envelope = part('10-K', 'annual.htm', '<h1>Business</h1><p>Subscription revenue grew.</p>') + part('EX-99.2', 'deck.htm', '<h1>Investor presentation</h1><p>Customer usage increased.</p>') + part('EX-99.3', 'slides.pdf', '%PDF-1.7 binary');
  const prepared = await prepareSecFiling(filing, { userAgent: 'test', fetcher: async () => new Response(envelope) });
  assert.equal(prepared.sourceMaterials?.length, 3);
  assert.equal(prepared.sourceMaterials?.[2].status, 'unsupported');
  assert.match(prepared.document.text, /Customer usage/);
  assert.doesNotMatch(prepared.document.text, /PDF-1.7/);
  assert.ok(prepared.outline.some((s) => s.title.includes('deck.htm')));
  assert.equal(new Set(prepared.blockIds).size, prepared.blockIds.length);
  for (const block of prepared.blocks) assert.equal(prepared.document.text.slice(block.start, block.end).replace(/\s+/g, ' ').trim(), block.body.replace(/\s+/g, ' ').trim());
  assert.ok(prepared.materialWarnings?.some((w) => w.includes('slides.pdf')));
});

test('unavailable envelope retains primary report and a visible coverage warning', async () => {
  const prepared = await prepareSecFiling(filing, { userAgent: 'test', fetcher: async (url) => String(url).endsWith('.txt') ? new Response('', { status: 404 }) : new Response('<h1>Business</h1><p>Primary report remains readable.</p>') });
  assert.match(prepared.document.text, /Primary report/);
  assert.equal(prepared.sourceMaterials?.length, 1);
  assert.ok(prepared.materialWarnings?.some((w) => w.includes('未成功读取')));
});


test('charts must directly follow the business explanation they support', () => {
  const prose = { type: 'narrative', nodeId: 'business' };
  const chart = { type: 'chart', nodeId: 'business', metricKey: 'revenue' };
  const compose = (sections: unknown[]) => composeSecPresentation({ sections }, [node], [], [trend]);
  assert.equal(compose([{ title: 'Business', blocks: [prose, { ...chart, nodeId: undefined }] }]), undefined);
  assert.equal(compose([{ title: 'Business', blocks: [prose] }, { title: 'Charts', blocks: [chart] }]), undefined);
  assert.equal(compose([{ title: 'Business', blocks: [chart, prose] }]), undefined);
  const result = compose([{ title: 'Business', blocks: [prose, chart] }]);
  const plotted = result?.sections[0].blocks[1];
  assert.equal(plotted?.type, 'sec_chart');
  if (plotted?.type === 'sec_chart') assert.equal(plotted.nodeId, node.id);
});
