---
title: "feat: Export Format Selection Rebalance — Markdown Default for Simple Content"
type: feat
status: completed
date: 2026-04-15
---

# feat: Export Format Selection Rebalance — Markdown Default for Simple Content

## Overview

调整导出格式自动选择规则，将默认格式从 HTML 改为 Markdown。简单的 mermaid 图、数学公式、不含图片的题目等常规内容默认导出为 `.md` 文件。仅当内容包含复杂交互（Tab、折叠）、动态特效（Canvas、Chart.js）、复杂图片（SVG、Canvas 绘图）等需要浏览器渲染的组件时，才使用 HTML。

## Problem Frame

当前格式自动选择规则过于偏向 HTML — 只要有公式、mermaid 图、或 2+ 标题就选 HTML。这导致大多数知识点总结（包含简单公式和 mermaid 流程图）都被导出为 `.html`，而用户其实只需要一个可在任何 markdown 编辑器中查看的 `.md` 文件。HTML 导出应有明确门槛：只在浏览器渲染确实必要时使用。

## Requirements Trace

- R1. 简单 mermaid 图（` ```mermaid ` 代码块）导出为 markdown 格式
- R2. 数学公式（`$...$` / `$$...$$`）导出为 markdown 格式
- R3. 不含图片的题目（题干、选项、解析）默认导出为 markdown 格式
- R4. 复杂交互组件（Tab、折叠 details、Tooltip）仍使用 HTML
- R5. 动态特效（Canvas、Chart.js）仍使用 HTML
- R6. 复杂图形（SVG 内联、Canvas 绘图）仍使用 HTML
- R7. 用户明确指定格式时，尊重用户选择
- R8. 用户说"导出"但没指定格式时，默认选 markdown（不再是 HTML）
- R9. 现有 tool 接口和代码不变，只改规则/skill 文档
- R10. 多级标题/TOC 不再触发 HTML 导出（markdown 自带标题层级）
- R11. 包含图片（截图、题图、markdown 图片语法）的内容仍使用 HTML

## Scope Boundaries

- 不改变 `export-service.ts` 或 `export-document.ts` 的代码
- 不改变 `export-document` tool 接口
- 不影响已完成的 rich HTML 渲染引擎计划（2026-04-15-002）
- 不改变 content 提取规则、导出目录、路径安全等行为

## Context & Research

### Relevant Code and Patterns

- `.opencode/rules/export-workflow.md` — 格式自动选择规则的单一权威来源，被 `prompt-assets.test.ts` 的 `"导出工作流共享规则"` 断言验证
- `.opencode/skills/export-html/SKILL.md` — "何时用 HTML" 部分，LLM 加载此 skill 时的格式选择指南
- `.opencode/skills/export-markdown/SKILL.md` — "何时不应用 Markdown" 部分，当前将几乎所有内容都重定向到 HTML
- `.opencode/tests/prompts/prompt-assets.test.ts:16` — 验证 `export-workflow.md` 包含 `"导出工作流共享规则"` 标题

### Key Observation

Mermaid 代码块在 `.md` 文件中广泛可渲染 — GitHub、VS Code、Obsidian、Typora 等主流 markdown 查看器均原生支持 ` ```mermaid ` 语法。KaTeX 公式（`$...$`）的支持稍弱（GitHub 已部分支持），但原始公式文本仍可读。

## Key Technical Decisions

- **Markdown 为默认格式**: 说"导出"没指定格式时选 markdown，HTML 只在明确需要浏览器渲染时使用
- **HTML 升级阈值**: 仅当内容包含 Canvas/Chart.js/SVG 等需要 JS 运行时的组件、或 Tab/折叠等需要 CSS+JS 交互的组件时才选 HTML
- **标题/TOC 不再是 HTML 触发器**: 多级标题本身不需要 HTML — markdown 文件自带标题层级
- **题目不再默认 HTML**: 纯文本题目（不含图片）用 markdown 足够。含图片的题目需要 HTML（图片在 markdown 中依赖相对路径，单独导出时不可靠）

## Open Questions

### Resolved During Planning

- 公式是否应触发 HTML → 否，`$...$` 在大多数 markdown 查看器中可读
- mermaid 是否应触发 HTML → 否，主流 markdown 查看器原生支持
- 默认格式 → markdown（不再是 HTML）

### Deferred to Implementation

- 无

## Implementation Units

- [x] **Unit 1: 更新 export-workflow.md 格式自动选择规则**

**Goal:** 将格式自动选择规则从"HTML 优先"改为"Markdown 优先"，明确 HTML 的触发条件。

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8, R10, R11

**Dependencies:** None

**Files:**
- Modify: `.opencode/rules/export-workflow.md`

**Approach:**

将 `## format 自动选择规则` 部分改写为：

**不要让用户自己选格式**，按以下规则自动决定：

**默认 `"markdown"` — 说"导出"没指定格式时选 markdown。**

**升级到 `"html"` 的场景**（满足任一条即选 HTML）：
- 内容包含 Canvas 动态绘图（` ```canvas ` 代码块）
- 内容包含 Chart.js 数据图表（` ```chart ` 代码块）
- 内容包含 SVG 图形（` ```svg ` 代码块）
- 内容包含交互组件（Tab 切换 `<div class="tabs">`、折叠 `<details>`）
- 内容包含图片（截图、题图、`![...]()`）
- 用户明确说"导出成 html"或"保存为 html"

**选 `"markdown"` 的场景**（默认情况）：
- 简单 mermaid 流程图 → markdown 原生支持
- 数学公式（`$...$`）→ 文本可读
- 纯文本题目（不含图片）
- 学习计划、知识点总结、文字笔记
- 用户明确说"导出成 markdown"或"保存为 md"

保留 `## 导出流程` 和 `## 目录（TOC）自动生成规则` 不变（TOC 规则仅适用于 HTML 导出，markdown 导出时自动忽略）。

**Patterns to follow:**
- 现有规则文件格式（中文标题、列表、加粗关键词）

**Test scenarios:**
- Happy path: `prompt-assets.test.ts` 的 `"导出工作流共享规则"` 断言继续通过
- Happy path: 规则文件包含"默认选 markdown"
- Happy path: 规则文件包含 Canvas/Chart.js/SVG/Tab/图片作为 HTML 触发条件
- Happy path: 规则文件包含"简单 mermaid"和"数学公式"作为 markdown 适用场景

**Verification:**
- `npx vitest run tests/prompts/prompt-assets.test.ts` 全部通过
- 规则文件中"默认选 HTML"被替换为"默认选 markdown"

- [x] **Unit 2: 更新 export-html 和 export-markdown skill 的格式选择描述**

**Goal:** 同步更新两个 skill 文件的格式选择部分，与 export-workflow.md 保持一致。

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8, R10, R11

**Dependencies:** Unit 1

**Files:**
- Modify: `.opencode/skills/export-html/SKILL.md`
- Modify: `.opencode/skills/export-markdown/SKILL.md`

**Approach:**

**export-html/SKILL.md** — 重写 `## 何时用 HTML（自动选择规则）`：
- 标题改为 `## 何时用 HTML`（去掉"自动选择规则"重复）
- 列出 HTML 触发条件：Canvas、Chart.js、SVG、Tab/折叠交互、图片
- 移除"数学公式""mermaid""多级标题"作为 HTML 触发条件
- 修改默认行为：说"导出"但没指定格式时，如果内容包含上述 HTML 触发条件才选 HTML，否则应加载 `export-markdown` skill
- 移除最后一行 `用户说"导出"但没指定格式时，**默认选 HTML**`

**export-markdown/SKILL.md** — 重写 `## 何时不应用 Markdown`：
- 标题改为 `## 适用范围`
- 明确 markdown 适用的场景：简单 mermaid、公式、纯文本题目、知识点总结、学习计划
- 明确应改用 HTML 的场景：Canvas/Chart.js/SVG/Tab/折叠/图片
- 移除"数学公式、流程图、思维导图"作为重定向到 HTML 的理由
- 更新第一行描述，从"仅适用于纯文本内容"改为适用范围的总结

**Patterns to follow:**
- 现有 skill 文件格式（frontmatter + 执行步骤 + 判断规则 + 关键注意）

**Test scenarios:**
- Happy path: export-html skill 中不再列出"数学公式"和"mermaid"作为 HTML 触发条件
- Happy path: export-markdown skill 中明确列出"简单 mermaid"和"数学公式"为 markdown 适用场景
- Happy path: export-markdown skill 中明确列出 Canvas/Chart.js/SVG/Tab/图片为 HTML 升级条件
- Happy path: 两个 skill 与 export-workflow.md 的格式选择规则一致，无矛盾

**Verification:**
- 三个文件（规则 + 两个 skill）的格式选择描述一致
- `npx vitest run` 全部通过

## System-Wide Impact

- **Interaction graph:** 规则变更影响所有使用导出功能的 agent（orchestrator + 各老师/状元）。LLM 在运行时读取这些规则/skill 文件来决定格式。不涉及代码层面变更。
- **Error propagation:** 不变
- **State lifecycle risks:** 无 — 纯文档变更
- **API surface parity:** `export-document` tool 接口不变
- **Integration coverage:** `prompt-assets.test.ts` 验证规则文件存在且包含预期标题

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| LLM 不遵守新规则 | 规则/skill 是 LLM 唯一的格式选择指南，三个文件保持一致即可。无法通过代码强制执行 |
| Markdown 查看器不支持公式渲染 | `$...$` 公式文本在所有编辑器中可读。用户需要渲染时可手动选 HTML |
| 规则文件与 skill 文件描述不一致 | Unit 2 确保三个文件同步更新 |

## Documentation / Operational Notes

- 格式选择规则分散在 3 个文件中：规则文件是权威来源，skill 文件是加载时的具体指引
- 更新后应确认三个文件的 HTML 触发条件列表完全一致

## Sources & References

- Related plan: `docs/plans/2026-04-15-002-feat-rich-markdown-html-export-plan.md`（HTML 渲染引擎本身不变）
- Related code: `.opencode/plugins/coaching-tools/services/export-service.ts`（代码不变）
- Related rule: `.opencode/rules/export-workflow.md`
- Related skills: `.opencode/skills/export-html/SKILL.md`, `.opencode/skills/export-markdown/SKILL.md`
