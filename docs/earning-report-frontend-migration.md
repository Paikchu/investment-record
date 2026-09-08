# Earning Report 前端集成

## 正确的仓库与版本

目标是 GitHub `Paikchu/investment-record`（本地 `/Users/max/Investment/投资记录`），main 推送会自动触发现有 Cloudflare Workers Builds。

前端来源为 GitHub `Paikchu/earning-report-analysis` 的 main，2026-09-08 拉取到 `4f9ec2b`。以该提交实际源码和线上 `/stocks/ORCL` 页面为依据，替换第一次误用的 recovery 旧版前端。源项目的本地分支和未提交修改保持不动。

## 与第一次迁移的区别

| 范围 | 当前行为 |
| --- | --- |
| 公司页 | 与源 main 一致，只挂载业务前瞻和披露时间线；移除独立 FundamentalCharts、指标选择器及季度快照 |
| 业务前瞻 | 同步自适应标题字号、段落展开、两列判断与 subgrid 对齐、按需内容块 |
| 完整研报 | 同步 ReportBlocks、RichText 和对应最新 API 数据契约 |
| 图表 | 仅保留源 main 的研报内容块图表渲染能力；不恢复已删除的独立基本面区域 |
| 样式 | 完整同步 main 样式、Source Serif 4 / Noto Serif SC 字体、纸色背景、布局、披露线条和节点 |
| 隔离 | 每个 CSS selector 直接添加 `.earning-report` 前缀，保留 `::before` / `::after`；不把伪元素放入 `:is()` |

宿主保留第二个 Dock Tab，首页是 `/analysis`，公司及报告路径是 `/analysis/stocks/:ticker` 和 `/analysis/stocks/:ticker/sec/:accession`。该页取消宿主额外的 10% 两侧留白，使用源前端自身的留白。样式作用域及 `body:has(.earning-report)` 限定只影响第二 Tab。

## 数据边界与配置

浏览器 → investment record `/api/analysis/v1/companies/...` → earning-report pipeline `/api/v1/companies/...`。

只迁移前端、公开数据契约及服务端读取客户端，不迁移 pipeline、数据库、调度或管理写入接口。证券搜索使用宿主公开证券目录，不读取持仓。

在 investment record 服务端配置：

- `EARNING_REPORT_PIPELINE_ORIGIN`：仅无 Service Binding、使用 HTTP 访问时需要，值为 `https://earning-report-analysis-sec-pipeline.max-zhangyuchen.workers.dev`。
- `EARNING_REPORT_READ_TOKEN`：源前端 `ANALYSIS_READ_TOKEN` 对应的已授权只读凭证。

不要覆盖投资项目原有 `SEC_PIPELINE_ORIGIN`。仓库已声明 `EARNING_REPORT_PIPELINE` Service Binding 指向 `earning-report-analysis-sec-pipeline`；绑定存在时无需地址变量，但仍需只读凭证。可选 `EARNING_REPORT_API_RATE_LIMIT` 约束公开读取流量。未配置时返回 503 和不可用状态，不回退到投资数据库。

## 验证

- `npm run build`
- `npm run test:earning-report`：读取代理与富文本安全/格式回归测试。
- 迁移文件 ESLint。
- 使用线上 ORCL 公开 API 响应对照：1496×1000、390×844；确认无独立基本面面板、无横向溢出、时间线伪元素存在、段落展开/收起、研报打开与返回。

本地 QA 使用隔离的临时预览目录和只读代理，未写入真实凭证或修改生产数据。因本机 workerd 比生产兼容日期旧，仅临时预览目录降低运行时兼容日期，目标仓库的 Cloudflare 配置保持不变。视觉对照不等于正式环境 pipeline 凭证已配置。
