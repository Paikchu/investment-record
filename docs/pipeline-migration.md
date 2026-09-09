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

## 2026-09-09 切换验收

- 代码迁入提交：`c7b6180f244369ec6a2ff2ff50710fcda0cc7093`。
- 235 项 Pipeline 测试、19 项投资看板分析接入测试全部通过。
- Pipeline 类型检查、边界检查、dry-run 和投资看板 production build 通过。
- 生产 D1 的 12 条已应用迁移与迁入文件匹配；业务源码、共享契约、资源配置和迁移文件逐字节保持一致。
- Cloudflare Settings → Builds 已显示 `Paikchu/investment-record`、`main` 和上述独立命令。
- 保留原构建 token、关闭 preview builds；watch paths 暂保留 `*`，新仓库每次 main 提交都会触发构建。
- 此验收提交用于触发切换后的首次 Git 自动部署；最终构建和线上探针结果以 Cloudflare 为准。

Cloudflare 连接向导可能建议把根目录 `wrangler.jsonc` 的 Worker 名改成 Pipeline 名。
不要应用该建议：根配置属于投资看板，Pipeline 命令明确指定 `workers/pipeline/wrangler.jsonc`。

首次新仓库 Pipeline 构建成功（`d83aecb2-be97-41a5-bead-62fd40e86a05`），
部署版本 `6acec965-04b3-4f97-b6b9-c6d17f583e39`，`/ready` 的六项检查均通过。
前端首次部署暴露旧 Cloudflare Vite 插件生成 `legacy_env` 与 Wrangler 4.127.1 的不兼容；
将插件同步到来源项目的 1.54.2 后，前端重新 build、前端部署 dry-run、投资定时 Worker dry-run 均通过。
