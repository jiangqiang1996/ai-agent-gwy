# Coaching Tools Refactor

## Overview

当前插件已经从单文件实现收敛为三层结构：

- `plugins/coaching-tools/tools/`：OpenCode tool adapter 层，负责 schema、入参整形和结果文本
- `plugins/coaching-tools/services/`：领域服务层，负责 profile、export、session continuity 等核心能力
- `plugins/coaching-tools/storage/` 与 `plugins/coaching-tools/migrations/`：文件持久化、迁移分级、identity index、session pointer、migration manifest

## Core State Model

- `UserProfile`：长期聚合状态，保存身份、考试类型、地区、mastery、history、studyPlan
- `SessionPointerRecord`：最小会话连续性记录，用于跟踪当前 session 绑定的 profile
- `NameClaimRecord`：名字占用/阻塞索引，避免 duplicate-name 修复期间出现 shadow profile
- `MigrationManifestRecord`：记录 cutover epoch、已迁移用户、隔离身份和 backup 来源

## Core Product Flow

1. 用户请求知识点总结、框架梳理、截图讲题、经典例题或导出。
2. 编排器根据考试类型、地区和身份组装老师 / 状元骨架阵容。
3. 截图题场景先收敛成 `QuestionArtifact`，再进入老师讲解。
4. 用户明确要求导出时，`export-document` 将内容写入 `output/`。

## Compatibility Notes

- orchestrator 仍保留 `agent.tools` 配置作为 custom tool 兼容例外。
- 旧 score/timer 字段目前仍可被读取为 legacy 数据，但不再属于公开产品主契约。

## Testing Surface

- 仓库与迁移：`tests/coaching-tools/*repository*.test.ts`, `profile-migration.test.ts`, `profile-schema-cleanup.test.ts`
- 工具注册与 contract：`plugin-registration.test.ts`, `tool-contracts.test.ts`, `export-service.test.ts`, `end-to-end-smoke.test.ts`
- 提示词资产：`tests/prompts/*.test.ts`
