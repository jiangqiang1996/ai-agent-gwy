# Coaching Tools Refactor

## Overview

当前插件已经从单文件实现收敛为三层结构：

- `plugins/coaching-tools/tools/`：OpenCode tool adapter 层，负责 schema、入参整形和结果文本
- `plugins/coaching-tools/services/`：领域服务层，负责 profile、attempt、timer、result 等状态转换
- `plugins/coaching-tools/storage/` 与 `plugins/coaching-tools/migrations/`：文件持久化、迁移分级、identity index、session pointer、migration manifest

## Core State Model

- `UserProfile`：长期聚合状态，保存积分、等级、连胜、mastery、history、studyPlan
- `AttemptRecord`：练题闭环的权威记录，保存题目、正确答案、timer 元数据、evaluation、apply 状态
- `SessionPointerRecord`：会话级 convenience pointer，使用 `epoch` 解决切换用户后的陈旧指针
- `NameClaimRecord`：名字占用/阻塞索引，避免 duplicate-name 修复期间出现 shadow profile
- `MigrationManifestRecord`：记录 cutover epoch、已迁移用户、隔离身份和 backup 来源

## Practice Flow

1. `question-generator` 选择科目并给老师生成题目模板。
2. 老师输出结构化题目。
3. `timer start` 注册 `AttemptRecord`，把状态置为 `registered -> active`，并返回 `attemptId + epoch`。
4. `timer stop` / `grading` / `points` 通过同一个 `attemptId` 驱动后续流程。
5. `result-service` 在 `evaluated -> applying -> applied` 受保护迁移中，统一写入积分、history 与 mastery。

## Compatibility Notes

- 当前仍保留 orchestrator 的 `agent.tools` 配置，原因是 custom tool 在 `permission` 下的等价访问语义尚未验证完成。
- `timer` 工具保留了旧内存计时的回退路径，用于在 prompts 全量切到新 contract 之前减少破坏性变更。

## Testing Surface

- 仓库与迁移：`tests/coaching-tools/*repository*.test.ts`, `profile-migration.test.ts`
- 服务状态机：`profile-service.test.ts`, `practice-service.test.ts`, `timer-service.test.ts`, `result-service.test.ts`
- 保护性状态测试：`attempt-transition-guard.test.ts`
- 工具注册与 contract：`plugin-registration.test.ts`, `tool-contracts.test.ts`, `tooling-smoke.test.ts`
- 提示词资产：`tests/prompts/*.test.ts`
