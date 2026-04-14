# Refactor Smoke Checklist

## Scope

用于验证 coaching-tools 重构后的主链路、迁移行为和会话状态。

## Manual Smoke Steps

1. 新用户创建
- 调用 `user-profile checkName`
- 调用 `user-profile loadOrCreate`
- 确认返回新建档案信息

2. 结构化练题闭环
- 调用 `question-generator`
- 让老师返回结构化题目（题目、选项、正确答案、解析）
- 调用 `timer start`，确认返回 `attemptId` 和 `epoch`
- 调用 `timer stop`，确认返回耗时和相同 `attemptId`
- 调用 `grading`（传 `attemptId`、`timeSeconds`）
- 调用 `points`（传 `attemptId`）
- 确认 history、积分、mastery 只写入一次

3. Session epoch
- 在 active attempt 期间切换用户
- 再调用 `timer status` / `timer stop`
- 确认返回 stale session 错误，而不是继续使用旧 attempt

4. Timeout recovery
- 启动计时，等待超时窗口后调用 `timer status`
- 确认 attempt 状态转为 `timed_out`

5. Duplicate identity
- 准备两个重名档案
- 确认 `checkName` / `loadOrCreate` 不会静默写入 shadow profile

6. Migration report
- 运行 `scripts/repair-user-profiles.ts`
- 检查 `output/repair-user-profiles-report.json`
- 确认 blocked / quarantine 记录不会被自动改写

## Healthy Signals

- `timer start` 总能返回 `attemptId` 与 `epoch`
- `points` 对同一 `attemptId` 第二次结算返回已处理状态，不重复加分
- prompt 资产测试与 tool contract 测试全部通过

## Failure Signals

- Windows 下再次出现 `EPERM rename ... .tmp -> *.json`
- 同一用户能同时创建两个 active attempt
- 切换用户后旧 epoch 仍能 stop/status 成功
- 对同一题仍额外调用 `updateMastery` 导致重复记录
