# 导出工作流共享规则

## 核心原则

- 只有在用户明确要求导出时才写文件。
- 导出目标统一为项目根目录 `output/`。
- 系统可以建议导出，但不能自动写文件。

## 导出流程

用户要求导出时，按以下步骤执行：

1. **确定格式**：按下方 format 自动选择规则决定 `html` 或 `markdown`。
2. **加载对应 skill**：格式确定后，加载 `export-html` 或 `export-markdown` skill，按 skill 中的执行步骤操作。
   - 选 HTML → 加载 `export-html` skill（包含扩展语法指南）
   - 选 markdown → 加载 `export-markdown` skill
3. **调用工具**：按 skill 指引调用 `export-document` 工具。

## format 自动选择规则

**不要让用户自己选格式**，按以下规则自动决定：

**默认 `"markdown"` — 说"导出"没指定格式时选 markdown。**

**升级到 `"html"` 的场景**（满足任一条即选 HTML）：
- 内容包含 Canvas 动态绘图（` ```canvas ` 代码块）
- 内容包含 Chart.js 数据图表（` ```chart ` 代码块）
- 内容包含 SVG 图形（` ```svg ` 代码块）
- 内容包含交互组件（Tab 切换 `<div class="tabs">`、折叠 `<details>`、Tooltip `<span class="tip">`）
- 内容包含图片（截图、题图、`![...]()`）
- 用户明确说"导出成 html"或"保存为 html"

**选 `"markdown"` 的场景**（默认情况）：
- 简单 mermaid 流程图 → markdown 原生支持
- 数学公式（`$...$`）→ 文本可读
- 纯文本题目（不含图片）
- 学习计划、知识点总结、文字笔记
- 用户明确说"导出成 markdown"或"保存为 md"

## 目录（TOC）自动生成规则

- 当内容包含 **2 个及以上标题**（`##` / `###` / `####`）时，导出 HTML 自动生成侧边栏目录，无需手动添加。
- 仅 1 个标题或无标题时不生成目录。
- 目录支持滚动高亮和点击跳转，LLM 不需要在 content 中手写目录结构。

## content 提取规则

1. 用户明确指定了要导出的内容 → 直接用。
2. 用户没指定 → 取本轮对话中**最近一次老师/状元的回答正文**。
3. content 只保留实质内容（知识点、讲解、例题），不包含工具调用、确认过程或系统消息。
4. **不要**在调用工具前反复确认，收集到 content 后立即调用。

## 关键禁止

- **不要**用 `write`、`edit` 或 `bash` 写文件，必须用 `export-document` 工具。
- **不要**自己把 Markdown 转成 HTML 再传 content，始终传原始 Markdown。
