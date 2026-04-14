# Refactor Smoke Checklist

## Scope

用于验证 summary-first 产品方向下的主链路、迁移行为与导出能力。

## Manual Smoke Steps

1. 新用户创建
- 调用 `user-profile checkName`
- 调用 `user-profile loadOrCreate`
- 补充考试类型 / 身份 / 地区
- 确认返回的新档案信息不再展示积分、等级、连胜

2. 知识点总结
- 请求总结某个模块或题型
- 确认回答先给知识框架，再补易错点或经典例题

3. 截图题讲解
- 上传一张内容是题目的图片
- 确认系统按截图题流程讲解，而不是要求 timer / 判题 / 积分
- 若图片不清晰或题面不完整，确认系统要求补图或补文字，而不是硬讲

4. 状元路由
- 设置 `identity=working` 与 `examTypes=[guokao]`
- 确认命中在职国考状元骨架
- 设置 `identity=campus`、`examTypes=[shengkao]`、`region=重庆`
- 确认命中应届省考状元骨架，并体现重庆语境

5. 显式导出
- 请求“导出成 markdown”
- 请求“导出成 html”
- 确认文件写入 `output/`
- 确认不发生静默覆盖

6. Migration report
- 运行 `scripts/repair-user-profiles.ts`
- 检查 `output/repair-user-profiles-report.json`
- 确认旧 score 字段缺失不会被误判为坏档案

## Healthy Signals

- `user-profile` 返回身份/考试类型/地区相关信息，但不再返回积分、等级、连胜
- 状元路由与 `identity + examTypes + region` 保持一致
- prompt 资产测试、tool contract 测试、export 测试和 smoke 测试全部通过

## Failure Signals

- README 或 orchestrator 仍把 timer/points 当核心能力
- `shiyedanwei` 被错误映射到国考/省考状元
- 截图题不清晰时系统仍假装识别成功
- 导出在没有明确意图时自动写入 `output/`
