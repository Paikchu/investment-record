# MAX · 投资记录

个人投资账本。首页读取 IBKR 组合快照，个股详情按当前 ChatGPT 身份读取持仓计划、SEC 文件和 AI 解读。

## GitHub → Cloudflare 自动部署

GitHub `Paikchu/investment-record` 已连接 Cloudflare Workers Builds，目标 Worker 是 `investment-record`。推送 `main` 后，Cloudflare 自动执行：

| 设置 | 值 |
| --- | --- |
| 根目录 | 仓库根目录 |
| 生产分支 | `main` |
| 构建命令 | `npm run build` |
| 部署命令 | `npx wrangler deploy` |

根目录 `wrangler.jsonc` 管理独立 Cloudflare Worker，Vite 从该文件读取配置并生成 `dist/server/wrangler.json`。已启用 `nodejs_compat`，D1 `DB` 绑定到 `investment-record-db`。数据库 ID 是资源标识，不是密钥。

原失败原因是 Vite 把本地占位数据库 ID `00000000-0000-4000-8000-000000000000` 写进部署产物，导致 Cloudflare 报错 10181。现在使用实际数据库。

首次数据库结构已通过仓库的 7 个迁移初始化。后续增加迁移时，在部署前执行：

```bash
npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
```

本地数据库初始化将 `--remote` 换成 `--local`。务必指定根配置，避免使用构建产物中相对路径不同的迁移目录。

运行时 Secret 在 Cloudflare Worker 的 Settings → Variables and Secrets 配置；本地 `.env.local` 不会自动上传，构建日志也不应包含密钥。新增 D1 目前只有表结构，首页使用仓库快照；原 Sites 的实时 D1 数据、持仓计划和 SEC 内容没有自动迁入。

独立 Cloudflare 不提供 Sites 的 ChatGPT 登录网关。首页可以查看，依赖登录的持仓计划与详情功能需要另行配置认证；Worker 会删除客户端传入的 `oai-authenticated-user-*` 头，避免身份伪造。IBKR 定时 Worker 仍连接原 Sites，尚未切换到此部署。

普通代码更新可运行 `git push github main` 自动发布。仓库 GitHub remote 为 `github`，Sites remote 为 `origin`。

官方参考：[Workers Builds 配置](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)、[Vite 配置入口](https://developers.cloudflare.com/workers/vite-plugin/reference/api/)。

## 当前同步状态

- Sites 项目：`投资记录`
- Sites Project ID：`appgprj_6a5d814863408191a9a0fc4a03ff3c9e`
- 线上地址：<https://investment-record.max-zhangyuchen.chatgpt.site>
- 本地分支：`main`
- 本次同步提交：`1204aa1ff22168430aeb9e7fab57b6bc67f5490f`
- 本次同步时线上最新版本：Sites version 178
- 当前访问策略：公开

这份目录是 Sites 源仓库的本地 Git 克隆。`origin` 指向 Sites 提供的源码仓库；访问令牌是短期凭证，不写入 remote、Git 配置或文件。

GitHub 备份仓库使用独立的 `github` remote，保留原有 Sites `origin`。仓库包含投资快照，默认使用私有可见性；本地 `.env*` 与 `.dev.vars*` 密钥文件不提交。

## 本地启动

需要 Node.js 22.13 或更高版本。

```bash
npm ci
npm run dev
```

常用检查：

```bash
npm test
npm run lint
npm run build
npm run sec-cron:check
```

## 环境变量文件

### `.env.local`

根目录的 `.env.local` 是 2026-09-08 从当前 Sites 生产环境同步的本地副本，目前只有：

```text
PORTFOLIO_SYNC_KEY
```

它用于保护 `/api/internal/portfolio/sync`，必须和独立 Cloudflare Worker 中同名 Secret 保持完全一致。`.env.local` 已被 `.gitignore` 的 `.env*` 规则排除，禁止提交、复制到 README、日志或命令行参数中。

### `.env.example`

`.env.example` 只列出代码支持的配置项和示例默认值，不代表生产环境已经配置。当前 Sites 生产环境没有配置其中其余变量。

### Worker Secret 的限制

Cloudflare 不允许在 Secret 创建后重新读取明文，因此无法把现有 Worker Secret 的值导出到本地。本次只验证到生产 Worker 存在以下 Secret 名称：

- `IBKR_FLEX_TOKEN`
- `MAX_SITE_BYPASS_TOKEN`
- `PORTFOLIO_SYNC_KEY`

这些值应继续保留在 Cloudflare Secret 中。若确需本地调试独立 Worker，在 `workers/sec-cron/.dev.vars` 中手动提供；该文件同样不得提交。Cloudflare 官方建议敏感值使用 Secret，本地使用 `.dev.vars` 或 `.env`，并加入 Git 忽略规则：<https://developers.cloudflare.com/workers/configuration/environment-variables/>。

## 原 Sites 架构与独立定时 Worker

本项目不是单个 Worker，而是两个清晰的运行边界：

| 层 | 负责内容 | 配置入口 |
| --- | --- | --- |
| Sites Web 应用 | Vinext/React 页面、API Routes、D1 读写、身份头 | `.openai/hosting.json` + Sites 环境变量 |
| `max-investment-record-sec-cron` Worker | IBKR 定时同步、SEC Workflow、R2 中间产物 | `workers/sec-cron/wrangler.jsonc` + Worker Secrets |

### 1. Sites Web 应用

`.openai/hosting.json` 必须保留现有 Project ID，不能新建第二个 Sites 项目：

```json
{
  "project_id": "appgprj_6a5d814863408191a9a0fc4a03ff3c9e",
  "d1": "DB",
  "r2": null
}
```

- `DB` 是 Sites 管理的 D1 binding，业务代码通过 `env.DB` 使用它。不要把本地占位的 D1 ID 当成生产数据库 ID。Cloudflare 的 D1 binding 机制见：<https://developers.cloudflare.com/d1/get-started/>。
- Sites 生产 Secret 保留 `PORTFOLIO_SYNC_KEY`。
- 源码包含的 `AI_API_KEY`、`SEC_REFRESH_KEY`、`SEC_PIPELINE_ORIGIN`、`SEC_BOOTSTRAP_PUBLIC_KEY` 目前没有配置到 Sites 生产环境。只有在重新启用对应的 SEC 调用链时才补齐，不要为了“配置完整”而放入无效值。
- 原 Sites 应用通过 Sites 保存版本和部署；GitHub 独立 Cloudflare 应用使用根目录 Wrangler 配置及上文自动部署流程。

### 2. 独立定时 Worker

`workers/sec-cron/wrangler.jsonc` 是 Worker 配置的唯一事实来源。当前配置包含：

- Worker：`max-investment-record-sec-cron`
- 普通变量：`MAX_SITE_ORIGIN`、`IBKR_FLEX_QUERY_ID`、`SEC_USER_AGENT`、`SEC_ANALYSIS_MODEL`
- Workflow bindings：`SEC_ANALYSIS_WORKFLOW`、`SEC_MEMORY_WORKFLOW`
- R2 binding：`SEC_FILINGS` → `max-investment-record-sec-filings`
- Cron：`0 6 * * 2-6`，Cloudflare Cron 使用 UTC，即北京时间周二至周六 14:00

R2 与 Workflow 都通过 binding 注入 Worker，不需要在代码里保存账号级 API 密钥。参考 Cloudflare 的 [R2 binding](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)、[Workflow binding](https://developers.cloudflare.com/workflows/build/trigger-workflows/) 与 [Cron Trigger](https://developers.cloudflare.com/workers/configuration/cron-triggers/) 文档。

当前仓库配置里的 `MAX_SITE_ORIGIN` 仍是旧地址 `https://max-investment-record.max-zhangyuchen.chatgpt.site`，而 Sites 当前线上地址是 `https://investment-record.max-zhangyuchen.chatgpt.site`。下次部署 Worker 前，应先验证旧地址是否仍为有效别名；若不是，更新为当前线上地址后再部署。

### 3. Secret 配置

生产 Secret 不写入 `wrangler.jsonc`。需要新建或轮换时使用标准输入交互：

```bash
npx wrangler secret put IBKR_FLEX_TOKEN --config workers/sec-cron/wrangler.jsonc
npx wrangler secret put MAX_SITE_BYPASS_TOKEN --config workers/sec-cron/wrangler.jsonc
npx wrangler secret put PORTFOLIO_SYNC_KEY --config workers/sec-cron/wrangler.jsonc
```

其中：

- `IBKR_FLEX_TOKEN`：只存在 Worker，用于读取 IBKR Flex。
- `MAX_SITE_BYPASS_TOKEN`：只存在 Worker，用于调用受 Sites 访问控制保护的内部接口。
- `PORTFOLIO_SYNC_KEY`：Sites 与 Worker 两边必须使用同一个随机值，形成第二道应用级鉴权。

源码还支持 `SEC_REFRESH_KEY`，以及 `AI_API_KEY` 或 `SEC_BOOTSTRAP_PRIVATE_KEY`。它们当前不在已部署 Worker 的 Secret 列表中；只有恢复对应 SEC 刷新/分析路径时才配置，并同时核对 Sites 侧的配套变量。

### 4. 建议的发布顺序

1. 先确认 `.env.local` 没有进入 Git，并运行测试、lint 和 build。
2. 若 Worker 配置或 Worker 代码变化，运行 `npm run sec-cron:check`。
3. 先设置或轮换 Secret，再运行 `npm run sec-cron:deploy`；脚本带 `--keep-vars`，避免部署时意外清除现有变量。
4. Web 应用通过原 Sites 项目保存并部署精确的 Git 提交。
5. 验证 Worker Secret 名称、Cron、Workflow、R2 binding，以及内部同步接口返回；不要用一次部署成功代替端到端验证。

## 数据边界

- `data/portfolio-snapshot.json`：IBKR 账户、持仓和成交快照，不是实时行情；已清仓 ticker 由保留的 Flex 成交自动归档到历史账本。
- `data/us-securities.json`：由 Nasdaq Trader 官方目录生成的美股与 ETF 搜索索引。
- `data/earnings-calendar.json`：未来 90 天 Nasdaq 财报日历快照；日期按美股市场日展示，并换算北京查看时段。
- D1 `DB`：按 `owner_email + ticker` 保存持仓原因和规划点位，并缓存 SEC 文件、正文与分析结果。
- 客户端不提交 owner；服务端从 `oai-authenticated-user-email` 读取身份。
- SEC 定时任务只通过受保护的内部 API 写入 D1，不直接修改 IBKR。

## 数据更新命令

更新 IBKR 快照：

```bash
npm run snapshot:update -- --input /absolute/path/to/ibkr-export.json
```

通过 IBKR Flex Web Service API 生成更新器输入：

```bash
npm run ibkr:flex:fetch -- --query-id 1628251 --output /absolute/path/to/ibkr-flex-input.json
node --experimental-strip-types scripts/update-portfolio-snapshot.ts --input /absolute/path/to/ibkr-flex-input.json
```

macOS 默认从 Keychain 服务 `com.max-investment-record.ibkr-flex` 读取 Token；其他环境使用未提交的 `IBKR_FLEX_TOKEN`。Token 不得写入仓库、命令参数或日志。

其他维护命令：

```bash
npm run symbols:update
npm run earnings:update
npm run review:check
npm run macro:check
npm run market-close:build
npm run market-close:check
npm run db:generate
```

## 主要路由

- `/`：组合与按 ticker 聚合的投资账本。
- `/positions/[ticker]`：持仓构成、持仓原因和规划点位。
- `GET /api/sec/[ticker]/filings`：认证后的最近 SEC 文件与缓存 AI 解读。
- `GET /api/internal/sec/watchlist`：定时任务读取正股监控列表。
- `POST /api/internal/sec/refresh/[ticker]`：定时刷新单个 ticker。
- `GET /api/symbols?q=`：认证后的证券搜索，最多 10 条。
- `PUT /api/plans/[ticker]`：认证、同源校验后的计划保存接口。

净入金由 Flex Cash Transactions 的 Deposits/Withdrawals，加 Transfers 的现金及证券转移市值自动计算。首次必须覆盖 DateFunded；缺失字段、时间断档或账户变化会中止更新，不能把最近一年净入金误当累计本金。
