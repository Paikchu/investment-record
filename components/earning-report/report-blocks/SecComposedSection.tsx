import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import type { PublishedSecReport } from '@/shared/analysis-contract/report.ts';
import type { SecPresentation, SecPresentationBlock } from '@/shared/analysis-contract/sec-presentation.ts';
import { ReportBlockList } from './ReportBlocks.tsx';

export function SecComposedSection({ section, report }: { section: SecPresentation['sections'][number]; report: PublishedSecReport }) {
  return <div className="sec-composed-content" data-layout={section.layout} data-density={report.presentation?.density}>
    {section.blocks.map((block) => block.type === 'sec_chart'
      ? <SecTrendChart key={block.id} block={block} />
      : <ReportBlockList key={block.id} blocks={[block]} context={{ metrics: report.keyMetrics, fundamentals: null }} />)}
  </div>;
}

function SecTrendChart({ block }: { block: Extract<SecPresentationBlock, { type: 'sec_chart' }> }) {
  const { points } = block.trend;
  const low = Math.min(0, ...points.map((p) => p.value));
  const high = Math.max(0, ...points.map((p) => p.value));
  const span = high - low || 1;
  const y = (v: number) => 180 - (v - low) / span * 150;
  const x = (i: number) => 45 + i * 490 / Math.max(1, points.length - 1);
  const format = (value: number) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 2 }).format(value);
  return <figure className="report-block sec-trend-chart" id={block.id}>
    <figcaption><strong>{block.title}</strong><small>{block.trend.unit} · {block.trend.periodScope === 'annual' ? '年度' : '季度'} · {block.trend.basis.toUpperCase()} · SEC XBRL</small></figcaption>
    <svg viewBox="0 0 580 220" role="img" aria-labelledby={`${block.id}-title`}>
      <title id={`${block.id}-title`}>{`${block.title}，${points.map((p) => `${p.date}: ${p.value}`).join("；")}`}</title>
      <line x1="25" x2="555" y1={y(0)} y2={y(0)} className="sec-trend-zero" />
      {block.mark === 'line' && <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" className="sec-trend-line" strokeWidth="2" />}
      {points.map((p, i) => <g key={p.date}>
        {block.mark === 'bar' ? <rect x={x(i) - 12} y={Math.min(y(0), y(p.value))} width="24" height={Math.max(1, Math.abs(y(p.value) - y(0)))} className="sec-trend-mark" /> : <circle cx={x(i)} cy={y(p.value)} r="3" className="sec-trend-mark" />}
        <text x={x(i)} y={Math.max(15, y(p.value) - 8)} textAnchor="middle" fontSize="11" className="sec-trend-label">{format(p.value)}</text>
        {(i === 0 || i === points.length - 1) && <text x={x(i)} y="207" textAnchor="middle" fontSize="11" className="sec-trend-label">{p.date}</text>}
      </g>)}
    </svg>
    <details className="sec-chart-data"><summary>查看数据与来源</summary><Table><TableHeader><TableRow><TableHead>期间</TableHead><TableHead>数值（{block.trend.unit}）</TableHead><TableHead>SEC accession</TableHead></TableRow></TableHeader><TableBody>{points.map((p) => <TableRow key={p.date}><TableCell>{p.date}</TableCell><TableCell>{p.value.toLocaleString('zh-CN', { maximumFractionDigits: 10 })}</TableCell><TableCell>{p.accession}</TableCell></TableRow>)}</TableBody></Table></details>
  </figure>;
}
