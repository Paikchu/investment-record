# Pipeline 仓库迁移

## 来源与范围

来源 `Paikchu/earning-report-analysis@7dba791f18bf9740924bbbba6efbf4c3a202f382`，
目标 `Paikchu/investment-record`。仅迁入分析 Pipeline、共享类型、后端测试和消费示例。
业务源代码、Wrangler 资源配置与 migrations 保持原样。旧仓库保留历史副本，后续 Pipeline 修改只提交新仓库。

## Cloudflare Builds

现有 Worker：`earning-report-analysis-sec-pipeline`。在 Settings → Builds 切换 Git 仓库：

| 设置 | 值 |
| --- | --- |
| Git repository | `Paikchu/investment-record` |
| Production branch | `main` |
| Root directory | `/` |
| Build command | `npm run check:pipeline:boundary && npm run typecheck:pipeline && npm run worker:pipeline:check` |
| Deploy command | `npm run worker:pipeline:deploy` |
| Non-production builds | 关闭，与迁移前一致 |

继续使用现有 Builds API token，不创建或扩大权限。运行时 Secrets 留在原 Worker。
切换仓库不会自动复制构建配置；应逐项核对。投资看板 Worker 仍使用自己的构建与部署命令。

## 验证

先运行后端边界检查、类型检查、后端测试、Pipeline dry-run、前端 build。
远端 migrations 核对必须通过，不能通过重建 D1 或修改历史 migration 来规避。
切换后须看到新仓库提交的构建成功，并确认 `/health`、`/ready`、
只读 API 鉴权、投资看板实际读数据、Cron 和四个 Workflows 仍可用。

## 回滚

切换前的生产版本：`46929877-ae84-40dc-916b-4a94a6c1200a`。
若迁移部署出现问题，可在同一 Worker 恢复该版本，并把 Builds 仓库恢复为
`Paikchu/earning-report-analysis`，根目录 `/`，Build command `npm run worker:pipeline:check`，
Deploy command `npm run worker:pipeline:deploy`，生产分支 `main`。
本次迁移不改变数据库结构，不需要数据回滚。
