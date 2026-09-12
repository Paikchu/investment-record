# 本地代码现状核查

2026-09-09；源代码检查，未检查线上状态。

- HEAD：bf1150b；main；财报相关原有脏改动保留。
- components/navigation-dock.tsx：第三个入口 /macro；app/macro/page.tsx：占位 main。
- lib/macro-dashboard.ts：V1 有事实、传导、channels、来源、日历；要求持仓快照匹配。prepareMacroDashboardForDisplay 已支持仅快照不匹配时降级，不能照搬旧记忆描述为必然崩溃。
- V1 的 impact 新鲜度要求过去 24 小时内来源，适合当日事件但不能用作所有宏观序列的新鲜度标准；每项 impact 要非空持仓 ticker，不适合通用宏观报告。V2 分离公共状态与个人映射。
- package.json：React、Vinext、Tailwind、Drizzle、UI 已有；没有直接声明 zod/echarts。
- workers/pipeline/wrangler.jsonc：Workflows、D1、R2、10 分钟临时 Cron；staging 没有 D1。
- wrangler.jsonc：Web D1 与 EARNING_REPORT_PIPELINE service binding；主 Web Cron 空。
- workers/pipeline/src/index.ts：持久步骤及工作流入口。
- workers/pipeline/src/read-api/router.ts：公司 filings/analysis/fundamentals 读 API；未发现宏观路由。
- app/api：quotes、earnings、财报等；未发现 macro 目录。
- lib/earning-report/web/analysis-proxy.ts：服务端凭证、匿名公开读代理、错误转换；因此个人持仓不能直接混入公共宏观响应。

拟定方案只依赖已发现的运行模式，不假定现有 API 已支持盘中收益率、共识或新闻。
