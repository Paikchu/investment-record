# 投资记录定时任务 Worker

Cloudflare 名称：`max-investment-record-sec-cron`。这是 investment-record 项目的一部分，
源码已由 `Paikchu/investment-record` 仓库维护，不需要从 earning-report-analysis 再迁入。
名称中的 `sec` 来自历史用途；当前两条 Cron 的主要职责是组合数据和财报日历。

| 计划（UTC） | 北京时间 | 当前职责 |
| --- | --- | --- |
| `0 6 * * 2-6` | 周二至周六 14:00 | 读取 IBKR Flex，校验后同步投资账本 |
| `15 * * * *` | 每小时第 15 分钟 | 调用投资看板内部接口刷新财报日历 |

`index.ts` 按 Cron 表达式分支并返回，因此这两条计划不会落入历史 SEC 扫描分支。
新财报发现、公司分析、Memory 和基本面刷新由 [`../pipeline`](../pipeline/README.md) 负责。

## 资源与代码

- `index.ts`：定时分派与 HTTP/Workflow 入口。
- `ibkr-sync.ts`：IBKR 拉取、标准化和发布；复用仓库根目录 `lib/`，部署从根目录执行。
- `wrangler.jsonc`：Worker 配置和两条 Cron。
- `PORTFOLIO_SITE` Service Binding 指向 `investment-record`。
- `IBKR_FLEX_TOKEN`、`PORTFOLIO_SYNC_KEY` 保留在 Worker Secrets 中；同步密钥须与前端一致。
- `SEC_ANALYSIS_WORKFLOW`、`SEC_MEMORY_WORKFLOW` 与 `SEC_FILINGS` R2 是保留的历史 SEC 资源，
  当前两条 Cron 不使用这些分析 Workflow。不要把它们误认为 Pipeline 的四个 Workflow。
- `/health` 的 `modelConfigured` 只表示历史 SEC 模型配置，不是 IBKR 或财报日历的就绪状态。

## 发布关系

推送 `main` 后，Cloudflare 为 `investment-record` 执行：

```sh
npm run build
npm run deploy:cloudflare
```

其中 `deploy:cloudflare` 依次核对/应用投资账本迁移、部署前端、执行 `npm run sec-cron:deploy`。
因此此 Worker 不需要另外连接 GitHub；Cloudflare Settings → Builds 显示未独立连接是预期状态。

单独验证或部署时，在仓库根目录执行：

```sh
npm run sec-cron:check
npm run sec-cron:deploy
```

部署脚本明确使用本目录配置与 Worker 名，移除前端构建注入的 Worker 名称覆盖，
并用 `--keep-vars` 保留运行时变量。Pipeline 的独立 Git 构建不会部署此 Worker。
