# Profile Migration Policy

## Purpose

本 runbook 定义旧 `data/users/*.json` 的迁移、阻塞和隔离策略。目标是让 shape-only 旧档案可以安全 lazy migrate，而语义不可信的档案必须进入 repair 或 quarantine。

## Classification Table

| 分类 | 适用情况 | 允许行为 |
|---|---|---|
| `lazy` | 仅缺少 `id`、`examTypes`、`region`、`studyPlan` 等 shape 字段；其余核心结构完整 | 允许运行时自动补齐并写回标准化档案 |
| `blocked` | duplicate name / duplicate id、未知 `examTypes`、无效 `region`、无效 `studyPlan`、局部迁移残留等“可解析但语义不安全”的档案 | 禁止自动写回；必须经 repair 流程处理 |
| `quarantine` | JSON 无法解析、核心字段缺失、streak/mastery/history 结构损坏等无法做确定性修复的档案 | 禁止自动修复；必须人工确认后再处理 |

## Repair Script

脚本：`scripts/repair-user-profiles.ts`

默认行为：

- 扫描 `data/users/`
- 为每个档案生成分类和问题列表
- 输出 JSON 报告到 `output/repair-user-profiles-report.json`

启用 `--apply` 时：

- 仅对 `lazy` 记录执行标准化写回
- `blocked` / `quarantine` 记录仍然只出现在报告里，不会自动改写

## Required Backup Boundary

在任何 apply 型修复前，必须备份完整持久化集合：

- `data/users/`
- `data/attempts/`
- identity indexes
- quarantine records
- migration metadata / manifest

不要只备份 `data/users/`。

## Rollback Rule

- 一旦出现 normalized writes，旧 runtime 不能再与新 runtime 对同一数据目录并发写入。
- 回滚必须走 restore-from-snapshot，而不是“切回旧分支继续写”。

## Audit Expectations

- 每次 repair 都应保留报告文件
- 报告至少包含：源文件、分类、问题列表、目标文件、是否写回
- cutover 后应同步更新 migration manifest / epoch
