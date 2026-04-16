# AI Agent Gwy - 项目规范

## 项目概述

公务员/事业单位考试多代理辅导体系。基于 OpenCode 平台构建。

## 目录结构

- `.opencode/agents/` — 代理定义 (.md 文件)
- `.opencode/plugins/` — 插件 (custom tools 注册)
- `.opencode/rules/` — 共享提示词规则
- `.opencode/skills/` — 技能 (用户主动触发的操作)
- `data/users/` — 用户档案 (JSON, gitignored)
- `output/` — 导出文件与运行报告
- `docs/brainstorms/` — 需求文档
- `docs/plans/` — 技术规划

## 代理命名规范

所有代理使用可读的英文短横线命名：
- 老师: `xingce-zong-teacher`, `xingce-yanyu-teacher`, `shenlun-zong-teacher` 等
- 学生: `guokao-working-champion`, `guokao-campus-champion`, `shengkao-working-champion`, `shengkao-campus-champion` 等
- 特殊: `orchestrator` (编排器), `exam-info-teacher` (考情教研), `time-management-teacher` (时间管理)
- **禁止** 使用纯数字命名 (如 `666`, `667`)

## 代理 .md 文件格式

```markdown
# {角色名称}

## 角色定位
{一句话身份描述}

## 专业能力
- {能力列表}

## 教学风格 / 答题原则
1. **{原则名}**：{描述}

## 回答格式
- 2-3 句话，提供独特视角
- 禁止重复其他代理已说过的内容
```

## 输出格式规范

多代理回答采用 **简短角色发言 + 最终整合结论** 结构：
- 每个代理发言不超过 2-3 句话
- 必须提供独特视角，不得复述其他代理内容
- 编排器负责合并相同观点、标注分歧、给出最终结论

## 提示词去重规范

- 共享考试上下文、状元路由、题目输入工作流、导出流程、输出格式等规则放在 `.opencode/rules/`
- agent 文件只保留角色专属内容，不复制共享说明
- 修改运行时契约时，优先同步 `.opencode/rules/` 与 `orchestrator.md`

## OpenCode 配置兼容说明

- 在 custom tools 的 `permission` 等价访问语义验证完成前，`opencode.json` 可以临时保留 orchestrator 的 `agent.tools` 配置作为兼容例外
- 一旦确认 `permission` 能完整覆盖 custom tools 访问，再移除该兼容层

## 数据目录

用户数据存放在项目根目录的 `data/` 下（与 `.opencode/` 同级），不放在 `.opencode/` 内部。
- `data/users/{username}.json` — 每个用户一个 JSON 文件
- `data/` 已加入 `.gitignore`，用户数据不会被提交到 git

## 分阶段实现

- Phase 1: 行测总结优先 (全行测 6 模块 + 4 个状元骨架 + 知识点总结 + 经典例题 + 图片题目讲解 + 导出)
- Phase 2: 行测完整 (叶子题型老师 + 更细知识画像 + 更强图片题目解析 + 科学推理老师)
- Phase 3: 申论与主观题 (申论老师 + 分级评分) ✅ 已完成基础框架
- Phase 4: 事业单位与完整体系 (事业单位老师 + 更完整身份/地区体系 + 时间管理 + 考情)
