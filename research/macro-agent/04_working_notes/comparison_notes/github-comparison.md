# GitHub 研究摘记

- TradingAgents：固定 HEAD be952b8；setup.py 构建顺序分析和风险辩论图；FRED 加入实时 vintage 限定；学习拆责、证据时间和恢复，不采用全套交易栈。
- OpenBB：固定 HEAD 3e071fc；provider 与标准模型边界值得参考；LICENSE 原文为 AGPLv3，GitHub metadata 的 NOASSERTION 不是实际许可结论。
- MacroCycle：固定 HEAD 0ea9066；data_fetcher 中 PMI 和其他若干序列使用随机/模拟数据；business_cycle 使用启发式打分；不能把作者的效果数字当独立验证。
- Ultimate：固定 HEAD b91d5ff；supervisor 调用 SQL/图表/RAG 等 worker；部署包含多种微服务，当前项目无需照搬。
- Treasury auction 请求成功返回 JSON，但请求中的分页参数未限制到一条，保存的是较大响应；不把该探测当成已验证的分页接口契约。
- FRED、Treasury、TE 与 Cloudflare 官方文档已归档；未进行付费或认证 API 联调。
