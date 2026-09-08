# Earning-report 前端迁移

第二个 Dock Tab「公司业务分析」现在打开 `/analysis`。搜索、公司概览、财务图表、披露时间线和完整研报都由 investment record 的 React 前端渲染，子页面位于 `/analysis/stocks/:ticker` 和 `/analysis/stocks/:ticker/sec/:accession`。

## 数据边界

浏览器 → investment record `/api/analysis/v1/companies/...` → earning-report pipeline `/api/v1/companies/...`。

只迁移前端、展示用类型/计算函数及服务端只读客户端。没有迁移 pipeline、调度、D1/R2、管理接口，也没有修改投资记录原有 SEC 接口、数据库绑定或源项目。搜索沿用 investment record 已有的公开证券目录，不读取持仓数据。

组件位于 `components/earning-report`，展示逻辑与 API 合约位于 `lib/earning-report`。迁入样式限制在 `.earning-report` 容器内，避免影响第一个 Tab。原目录 `/Users/max/Developer/earning-report-analysis-recovery` 的 Git worktree 引用失效，本次以该目录实际源码为准，没有修复或删除源文件。

## 上线前配置

在 **investment record 的服务端运行环境**配置：

| 配置 | 值 |
| --- | --- |
| `EARNING_REPORT_PIPELINE_ORIGIN` | `https://earning-report-analysis-sec-pipeline.max-zhangyuchen.workers.dev` |
| `EARNING_REPORT_READ_TOKEN` | pipeline 已授权的只读凭证，对应源前端的 `ANALYSIS_READ_TOKEN`，需要 filings、analysis、fundamentals 读取权限 |

这两个名字与投资项目既有的 `SEC_PIPELINE_ORIGIN` 分离，不要覆盖原配置。不使用 `NEXT_PUBLIC_`，不把真实凭证写入 Git。

如果部署环境需要 Cloudflare Service Binding，可绑定 `EARNING_REPORT_PIPELINE` 到 `earning-report-analysis-sec-pipeline`；客户端会优先经此 binding 发送读取请求，仍需要上述只读凭证。可选的 `EARNING_REPORT_API_RATE_LIMIT` binding 用于限制公开读取流量。Binding 需要在实际托管环境配置，本次没有部署或修改线上配置。

本地 vinext/Cloudflare 开发可使用忽略提交的 `.dev.vars` 文件提供上述两个变量。没有凭证时，读取 API 返回 503，页面显示暂不可用；不会误报为公司没有报告。

## 验证

- `npm run build`
- `npm run test:earning-report`
- `npx eslint app/analysis app/api/analysis components/earning-report lib/earning-report components/navigation-dock.tsx tests/earning-report-integration.test.ts`
- 浏览器：投资首页 → 第二个 Tab → 搜索 MSFT → 财务图表与披露 → 完整研报 → 返回公司页；另检查 390px 窄屏。

本地端到端验证使用源项目真实只读 API handler、SQLite 测试库和合成 fixtures，没有生产数据写入。真实 pipeline 无凭证探测返回 401；用户已确认尚未配置凭证，因此真实数据联通与上线验证留待配置后执行。

本次本地验证：1440×1000 和 390×844，Playwright + 本机 Chrome（当前无 Browser skill）。页面标题、非空内容、无框架错误覆盖层、第二 Tab 高亮、搜索、指标选择开关/Escape、研报打开与返回、回到投资记录均通过。控制台只发现原项目 favicon.ico 404。全仓库 TypeScript 检查仍有既有错误（Cloudflare 类型配置、示例代码等）；补齐验证时的类型环境后，迁移文件未报错。
