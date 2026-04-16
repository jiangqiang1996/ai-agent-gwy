---
name: export-markdown
description: '将指定内容导出为 Markdown 文件到 output/。用户说"导出成 markdown"、"保存为 markdown"、"把当前内容落成 md 文件"时触发。'
argument-hint: "[要导出的内容或标题]"
---

# 导出 Markdown

将指定内容导出为 Markdown 文件。适用于简单 mermaid 图、数学公式、纯文本题目、知识点总结等不需要浏览器渲染的内容。

## 执行步骤

1. 确认用户明确要求导出。
2. 检查内容是否适合 markdown 格式（见下方判断规则）。
3. 确定 content：
   - 如果用户指定了要导出的内容，直接使用。
   - 如果用户没有指定，将本轮对话中**最近一次老师/状元的完整回答**作为 content。
   - content 必须是纯文本或 Markdown 格式，不要包含工具调用或中间过程。
4. 确定 title：优先用用户给出的标题；没有则从内容中提取主题；都没有时留空。
5. **立即**调用 `export-document` 工具，参数：`format="markdown"`, `content=<步骤3的内容>`, `title=<步骤4的标题>`。
6. 工具返回后，把导出后的相对路径告诉用户。

## 适用范围

**Markdown 适用的场景**（默认格式）：
- 简单 mermaid 流程图（` ```mermaid ` 代码块）
- 数学公式（`$...$`、`$$...$$`）
- 纯文本题目（题干、选项、解析，不含图片）
- 学习计划、知识点总结、文字笔记
- 用户明确说"导出成 markdown"或"保存为 md"

**应改用 HTML 的场景**（加载 `export-html` skill）：
- 内容包含 Canvas 动态绘图（` ```canvas ` 代码块）
- 内容包含 Chart.js 数据图表（` ```chart ` 代码块）
- 内容包含 SVG 图形（` ```svg ` 代码块）
- 内容包含思维导图 / 知识图谱（` ```markmap ` / ` ```mindmap ` / 复杂 Mermaid 图）
- 内容包含交互组件（Tab 切换、折叠 `<details>`、Tooltip）
- 内容包含图片（题图、`![...]()`）
- 用户明确说"导出成 html"或"保存为 html"

## 关键注意

- **不要**用 `write` 工具或 `bash` 写文件，必须用 `export-document` 工具。
- **不要**在调用工具前反复确认或思考，收集到 content 后直接调用。
- 只有显式导出意图时才落文件。
- 默认导出到项目根目录 `output/`。
- 如果用户需要带图片、图表、涂鸦板等丰富交互的内容，应使用 HTML 导出（加载 `export-html` skill）。
- 如果用户想把已有的 HTML 导出文件变成单文件离线包，使用 `inline-html` skill（非默认流程）。
