# MAX · 投资记录

私人投资账本。首页读取 IBKR 静态快照，个股详情按当前 ChatGPT 身份读取持仓计划、SEC 文件和 AI 解读。

## 数据边界

- `data/portfolio-snapshot.json`：IBKR 账户、持仓和成交快照，不是实时行情；已清仓 ticker 由保留的 Flex 成交自动归档到历史账本。
- `data/us-securities.json`：由 Nasdaq Trader 官方目录生成的美股与 ETF 搜索索引。
- `data/earnings-calendar.json`：未来 90 天 Nasdaq 财报日历快照；日期按美股市场日展示，并换算北京查看时段。
- D1 `DB`：按 `owner_email + ticker` 保存持仓原因和规划点位。
- D1 `DB`：缓存 SEC ticker/CIK、最近文件、清洗后的正文和 DeepSeek 中文解读。
- 客户端不提交 owner；服务端从 `oai-authenticated-user-email` 读取身份。
- SEC 定时任务只通过受保护的内部 API 写入 D1，不访问或修改 IBKR。

## 本地命令

```bash
npm install
npm run dev
npm test
npm run lint
npm run build
```

更新 IBKR 快照：

```bash
npm run snapshot:update -- --input /absolute/path/to/ibkr-export.json
```

通过 IBKR Flex Web Service API 生成更新器输入：

```bash
npm run ibkr:flex:fetch -- --query-id 1628251 --output /absolute/path/to/ibkr-flex-input.json
node --experimental-strip-types scripts/update-portfolio-snapshot.ts --input /absolute/path/to/ibkr-flex-input.json
```

macOS 默认从 Keychain 服务 `com.max-investment-record.ibkr-flex` 读取 Token；其他环境使用未提交的 `IBKR_FLEX_TOKEN`。Token 不得写入仓库、命令参数或日志。Flex Query 必须使用 CSV、section code/line descriptor、分 section column headers，以及带时区的成交时间。

生产环境由 `max-investment-record-sec-cron` Cloudflare Worker 在上海时间周二至周六 14:00 调用 Flex Web Service API。Worker 通过受保护的内部接口把新报告原子写入 D1；首页、持仓详情和证券搜索在请求时优先读取 D1，因此日常同步不需要 Codex、Git 提交或重新部署站点。`IBKR_FLEX_TOKEN` 只保存在 Worker Secret，`PORTFOLIO_SYNC_KEY` 同时作为 Worker Secret 和 Sites Secret 保存。

更新证券目录：

```bash
npm run symbols:update
```

单独更新财报日历：

```bash
npm run earnings:update
```

修改 `db/schema.ts` 后生成迁移：

```bash
npm run db:generate
```

SEC 本地配置复制自 `.env.example`。`AI_API_KEY` 与 `SEC_REFRESH_KEY` 必须作为密钥保存；`SEC_USER_AGENT` 必须包含可联系的邮箱。

检查或部署 SEC 定时任务：

```bash
npm run sec-cron:check
npm run sec-cron:deploy
```

## 路由

- `/`：组合与按 ticker 聚合的投资账本。
- `/positions/[ticker]`：持仓构成、持仓原因和规划点位。
- `GET /api/sec/[ticker]/filings`：认证后的最近 5 份 SEC 文件与缓存 AI 解读。
- `GET /api/internal/sec/watchlist`：定时任务读取正股监控列表，要求 `x-sec-refresh-key`。
- `POST /api/internal/sec/refresh/[ticker]`：定时刷新单个 ticker，要求 `x-sec-refresh-key`。
- `GET /api/symbols?q=`：认证后的证券搜索，最多 10 条。
- `PUT /api/plans/[ticker]`：认证、同源校验后的计划保存接口。

净入金由 Flex Cash Transactions 的 Deposits/Withdrawals，加 Transfers 的现金及证券转移市值自动计算（按账户 USD 本位币折算，排除交易、股息、利息和税费）。采集器查询最近 365 天；首次必须覆盖 DateFunded，后续在 portfolio_state payload 中保留早期流水并替换重叠窗口。现金明细必须与 Cash Report 对账；缺失字段、断档或账户变化会中止更新。首次允许同一报告日期补算本金；自动模式不接受浏览器本地手动覆盖。

上线需同时更新 Sites 与 sec-cron Worker，并完成首次历史初始化。如果首次查询窗口已晚于 DateFunded，必须先取得覆盖首次入金的历史报告完成初始化，不能把最近一年净入金当作累计本金。
