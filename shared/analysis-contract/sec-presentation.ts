import type { ReportBlock } from './report-blocks.ts';

export type SecSourceMaterial = {
  type: string;
  filename: string;
  url: string;
  status: 'read' | 'unsupported';
};

export type SecTrend = {
  metricKey: string;
  unit: string;
  basis: string;
  periodScope: 'quarter' | 'annual';
  points: Array<{ date: string; value: number; accession: string }>;
};

export type SecPresentationBlock = Exclude<ReportBlock, { type: 'chart' }> | {
  type: 'sec_chart';
  /** Business analysis this chart supports. Optional only for older saved reports. */
  nodeId?: string;
  id: string;
  title: string;
  mark: 'bar' | 'line';
  trend: SecTrend;
};

export type SecPresentation = {
  version: 'sec-presentation.v1';
  density: 'comfortable' | 'compact';
  sections: Array<{
    id: string;
    title: string;
    layout: 'flow' | 'grid';
    blocks: SecPresentationBlock[];
  }>;
};

export const SEC_PRESENTATION_SCHEMA = {
  density: 'comfortable|compact',
  sections: '[{title, layout:flow|grid, blocks:[{type: narrative|findings|callout|evidence|metrics|chart, nodeId?, metricKeys?, metricKey?, title?, tone?, mark?:bar|line}]}]',
  rules: [
    '围绕公司业务问题自定义 1–12 个章节、顺序和标题。不要机械套用固定财务模板。每章最多 8 个块。',
    'narrative/findings/callout/evidence 必须引用已完成 nodeId；正文、结论和证据由该节点填入，不重新写事实。',
    'metrics 只能引用本次 keyMetrics 中实际输出且可验证的 metricKey；chart 引用 availableCharts 中的 metricKey，可选 bar 或 line，数值由系统填入。',
    '每个 chart 必须指定已完成的 nodeId，并紧跟同一 nodeId 的 narrative/findings/callout，放在同一章节。图表要回答该节点的业务问题，不单独集中到图表章节。',
    '先解释业务判断，再用图验证规模、趋势或财务结果，并说明该图能说明什么、不能证明什么；标题应说明观察角度。整体收入趋势不能替代客户留存、分部收入或单位经济的数据，也不能独自证明因果。',
    '只在 availableCharts 有适合本业务问题的数据时绘图；不为装饰插图、不要求每节有图，缺少业务指标时明确数据缺口。',
    'flow 用于连贯分析；grid 用于并列比较。callout 的 tone 可为 neutral/positive/negative/caution。',
    '每个已完成节点至少出现一次 narrative/findings/callout；证据、数据质量和来源由系统保留。',
    '所有视觉样式由网站设计系统统一提供；不得指定颜色、字体、圆角、阴影或自定义样式。只选择上述结构、密度和图表类型。',
    '不要输出 HTML、CSS、JavaScript 或图表数据点。没有对应证据或跨期数据就不画图。',
  ],
} as const;
