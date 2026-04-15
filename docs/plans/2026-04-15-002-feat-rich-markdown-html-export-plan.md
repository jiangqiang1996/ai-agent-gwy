---
title: "feat: Rich Markdown-to-HTML Export Engine"
type: feat
status: completed
date: 2026-04-15
deepened: 2026-04-15
---

# feat: Rich Markdown-to-HTML Export Engine

## Overview

升级 `export-service.ts` 中的 HTML 渲染引擎，从基础 `marked.parse()` + 简单 CSS，升级为支持 8 项能力的精美渲染系统：markdown 渲染、KaTeX 数学公式、Mermaid 流程图、Chart.js 图表、SVG 内联图形、Canvas 动态绘图、交互组件（折叠/Tab/Tooltip）、自动目录导航。

用户已完成了基础集成：`marked@15.0.12` 已安装并引入，基础 CSS 和 `marked.parse()` 已工作，6 个现有测试全部通过。本计划在此基础上构建完整渲染引擎。

## Problem Frame

当前 HTML 导出使用 `marked.parse()` 做基础 markdown 渲染，CSS 仅为简单的表格/代码/引用样式。缺少：
- 数学公式保护（`$...$` 会被 marked 的 emphasis/strong 解析破坏）
- Mermaid/Chart.js/SVG/Canvas 代码块识别与渲染
- 自动目录生成
- 交互组件样式（折叠、Tab、Tooltip）
- 精美排版 CSS
- CDN 脚本嵌入 + 前端 JS 初始化

## Requirements Trace

- R1. Markdown 内容（标题、列表、表格、加粗、代码块、引用）必须正确渲染为 HTML ✅ 已完成
- R2. KaTeX 数学公式（`$...$` / `$$...$$`）必须被保护不被 markdown 解析干扰，由前端 KaTeX 渲染
- R3. Mermaid 图表（` ```mermaid ` 代码块）必须渲染为流程图/关系图
- R4. Chart.js 图表（` ```chart ` 代码块 + JSON 配置）必须渲染为柱状图/折线图/饼图
- R5. SVG 图形（` ```svg ` 代码块）必须直接内联到 HTML
- R6. Canvas 绘图（` ```canvas ` 代码块 + JS 代码）必须由浏览器 Canvas API 执行
- R7. 交互组件（`<details>`, `<div class="tabs">`, `<span class="tip">`）必须有 CSS 样式 + JS 交互
- R8. 标题（h2-h4）必须自动生成侧边栏 TOC，带滚动高亮
- R9. 导出的 HTML 必须独立可用（仅需网络加载 CDN 脚本）
- R10. 现有 tool 接口不变（`format`/`title`/`content`）
- R11. 现有 6 个测试必须继续通过

## Scope Boundaries

- 不添加 `useLastAssistantMessage` 优化 — 延后到未来迭代
- 不添加离线支持（内联 CDN 脚本）— 仅 CDN + 优雅降级
- 不添加 AI 自动生成绘图代码 — 只做渲染基础设施
- 不改变 `export-document` tool 接口和 markdown 导出路径
- 不添加 DOMPurify — 内容是 LLM 生成的可信 markdown

## Context & Research

### Relevant Code and Patterns

- `.opencode/plugins/coaching-tools/services/export-service.ts` — 当前 130 行，已集成 `marked`，需要扩展
- `.opencode/plugins/coaching-tools/tools/export-document.ts` — tool 层（不变）
- `.opencode/skills/export-html/SKILL.md` — 已完成：执行步骤 + 扩展语法指南 + 格式自动选择规则 ✅
- `.opencode/skills/export-markdown/SKILL.md` — 已完成：执行步骤 + HTML 重定向提示 ✅
- `.opencode/rules/export-workflow.md` — 已完成：格式自动选择 + 目录规则 + skill 加载流程 ✅
- `.opencode/package.json` — `marked@^15.0.0` 已在 dependencies
- `.opencode/tests/coaching-tools/export-service.test.ts` — 6 个现有测试
- `output/sample-export-preview.html` — 用户已验证的精美 HTML 样例（CSS/布局参考）

### Technology Context

| 组件 | 版本/详情 |
|------|----------|
| marked | `15.0.12`（已安装，纯 ESM） |
| marked-katex-extension | `5.1.8`（需安装，peer dep: `marked>=4 <19` ✅） |
| katex | `>=0.16 <0.17`（需安装，peer dep of marked-katex-extension） |
| ESM | `NodeNext` 模块解析，import 用 `.js` 后缀 |
| 构建系统 | 无构建步骤，OpenCode 直接加载 `.ts` |
| 测试 | Vitest ^3.2.4，68 个测试全部通过 |
| 包管理器 | Bun（`bun.lock` 存在） |

### marked v15 API 要点

- `import { Marked } from "marked"` — 推荐用 scoped 实例
- 自定义 `renderer.code({ text, lang })` — 按 `lang` 分发，return `false` 走默认渲染
- `walkTokens(token)` — 收集 heading 生成 TOC
- 自定义 `renderer.heading({ tokens, depth })` — 注入 `id` 属性
- HTML 标签默认透传（`<details>` 等直接保留）
- `marked-katex-extension` 在 emphasis/strong 之前 tokenize `$...$`/`$$...$$`，然后调用 `katex.renderToString()` **在 Node 端完成服务端渲染**

## Key Technical Decisions

- **KaTeX 服务端渲染**: `marked-katex-extension` 调用 `katex.renderToString()` 在 Node 端完成渲染，输出包含完整 HTML 的 `<span class="katex">` 元素。因此只需 CDN 加载 KaTeX **CSS 样式表**，不需要 `auto-render.min.js` 也不需要客户端公式渲染。必须安装 `katex` 作为 Node 依赖（peer dep）。
- **文件拆分**: 将渲染引擎拆到 `services/html-renderer/` 目录（4 个文件），`export-service.ts` 保持为薄入口
- **CDN 加载**: KaTeX CSS 通过 CDN `<link>` 加载；Mermaid/Chart.js 通过 CDN `<script defer>` 加载，不增加 Node bundle
- **scoped Marked**: 使用 `new Marked({...})` 实例，避免全局状态污染
- **Canvas 安全**: 静态字符串过滤（拒绝 `fetch(`, `XMLHttpRequest`, `eval(`, `import(`, `Function(`, `setTimeout(`, `setInterval(`, `document.cookie`, `window.location`），内容可信但做基础防御
- **Chart.js 数据传递**: 用 `<canvas data-chart="encoded-json">` 属性传递配置，前端 JS 循环初始化
- **CJK heading slug**: 使用中文字符直接作为 ID（如 `id="数量关系"`），现代浏览器完整支持。去重时追加 `-2`, `-3` 后缀
- **Markdown-in-HTML 限制**: `<div class="tabs">` 等 HTML 透传块内部 markdown **不会被 marked 解析**。SKILL.md 已告知 LLM 在 HTML 块内使用纯文本，或用空行分隔使 marked 处理部分内容

## Open Questions

### Resolved During Planning

- KaTeX 方案 → `marked-katex-extension`（服务端渲染）
- 文件组织 → 拆分目录
- 是否包含测试样例 → 是
- KaTeX 架构（服务端 vs 客户端）→ **服务端渲染**：`marked-katex-extension` 调用 `katex.renderToString()` 在 Node 端完成。CDN 仅加载 CSS 样式表。不需要 `auto-render.min.js`
- `marked-katex-extension` 版本 → `5.1.8` 已在 npm 发布（2026-04-07），peer dep `marked>=4 <19` 兼容 `marked@15`
- CJK heading slug → 直接使用中文字符作为 `id`（现代浏览器支持），去重追加数字后缀

### Deferred to Implementation

- CSS 精确色值/间距 — 实施时视觉调优
- Canvas 安全过滤器完整度 — 扩展基础过滤列表，后续按需扩展
- Chart.js JSON 配置校验 — 实施时决定是否在 `handleChart` 中 try/catch `JSON.parse` 并展示错误提示
- SVG `<script>` 标签处理 — SVG 代码块直接透传，信任 LLM 内容不做额外过滤

## High-Level Technical Design

> *方向性指导，非实现规范。*

### 渲染管线

```
Input: markdown content
  │
  ├─ 1. marked-katex-extension 处理 $...$ / $$...$$
  │     → 调用 katex.renderToString() 在 Node 端渲染为 <span class="katex"> HTML
  │
  ├─ 2. Marked 解析，自定义 renderer:
  │     code({lang}) → mermaid: <div class="mermaid-container"><pre class="mermaid">
  │                    chart:  <canvas data-chart="encoded">
  │                    svg:    原样透传到 <div class="svg-container">
  │                    canvas: <canvas id="canvas-N"> + 安全过滤后的 IIFE script
  │     heading() → <hN id="中文-slug"> 带 id 用于 TOC 锚点
  │
  ├─ 3. walkTokens 收集 headings → TOC 数组
  │
  ├─ 4. 生成 TOC 侧边栏 HTML
  │
  └─ 5. 组装完整 HTML:
        <head>: CSS (内联) + KaTeX CSS (CDN <link>) + Mermaid/Chart.js CDN (defer)
        <body>: <nav class="toc"> + <main><article>content</article></main>
        <script>: 单个内联脚本检测 CDN 可用性后初始化
```

> **KaTeX 渲染路径**: 公式在 Node 端由 `marked-katex-extension` + `katex` 渲染为完整 HTML。浏览器端只需 KaTeX CSS 来正确显示。不需要 `auto-render.min.js`。

### 目录结构

```
plugins/coaching-tools/services/html-renderer/
  ├─ index.ts            — renderMarkdown() 入口，Marked 实例配置
  ├─ css-template.ts     — CSS 字符串常量
  ├─ client-scripts.ts   — 前端 JS 模板
  └─ code-blocks.ts      — mermaid/chart/svg/canvas 处理函数

plugins/coaching-tools/services/export-service.ts  — 改为调用 html-renderer/
```

## Implementation Units

- [x] **Unit 1: 安装 marked-katex-extension + katex，创建 html-renderer 目录**

**Goal:** 添加 KaTeX 依赖（extension + katex peer dep），创建拆分目录的 4 个桩文件。

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `.opencode/package.json`
- Create: `.opencode/plugins/coaching-tools/services/html-renderer/index.ts`
- Create: `.opencode/plugins/coaching-tools/services/html-renderer/css-template.ts`
- Create: `.opencode/plugins/coaching-tools/services/html-renderer/client-scripts.ts`
- Create: `.opencode/plugins/coaching-tools/services/html-renderer/code-blocks.ts`

**Approach:**
- `bun add marked-katex-extension katex` from `.opencode/`
- `marked-katex-extension@5.1.8` 的 peer dep `marked>=4 <19` 兼容 `marked@15.0.12`
- `katex@>=0.16 <0.17` 是 `marked-katex-extension` 的必需 peer dep，用于服务端 `renderToString()`
- 创建 4 个桩文件，导出类型和空函数占位
- `index.ts`: export `renderMarkdown(content: string) => MarkdownRenderResult` 类型和函数
- `css-template.ts`: export `CSS_TEMPLATE: string`
- `client-scripts.ts`: export `buildClientScripts(options) => string`
- `code-blocks.ts`: export 4 个 handler 函数

**Patterns to follow:**
- ESM import `.js` 后缀（见现有 service 文件）
- 现有 `.opencode/plugins/coaching-tools/services/` 目录约定

**Test scenarios:**
- Test expectation: none — 脚手架，无行为变更

**Verification:**
- `bun pm ls` 显示 `marked`, `marked-katex-extension`, `katex` 都已安装
- 4 个新文件存在且 TypeScript 无导入错误（`npx tsc --noEmit` 通过）

- [x] **Unit 2: 实现 CSS 模板和代码块处理器**

**Goal:** 创建精美 CSS 模板（基于用户验证的 `output/sample-export-preview.html`），实现 4 种代码块处理器（mermaid, chart, svg, canvas）。

**Requirements:** R3, R4, R5, R6, R7

**Dependencies:** Unit 1

**Files:**
- Modify: `.opencode/plugins/coaching-tools/services/html-renderer/css-template.ts`
- Modify: `.opencode/plugins/coaching-tools/services/html-renderer/code-blocks.ts`

**Approach:**

**CSS 模板** — 基于 `output/sample-export-preview.html` 中已验证的样式：
- CSS 变量：`--primary`, `--text`, `--bg`, `--border` 等
- 布局：flexbox，左侧固定 TOC 侧边栏 + 右侧主内容
- 排版：中文字体栈，标题渐变，段落间距
- 表格：圆角、斑马纹、hover 高亮
- 代码块：深色背景、等宽字体
- 引用：左边框 + 背景色
- `details`/`summary`：折叠展开样式 + 箭头旋转
- `.tabs`/`.tab-btn`/`.tab-panel`：Tab 切换样式
- `.tip`/`.tip-text`：Tooltip 悬停样式
- `.chart-container`, `.mermaid-container`, `.svg-container`, `.canvas-container`
- `.badge`/`.callout`：标签和信息框
- 响应式：< 1024px 隐藏 TOC

**代码块处理器**：
- `handleMermaid(text)` → `<div class="mermaid-container"><pre class="mermaid">${text}</pre></div>`
- `handleChart(text, index)` → `{ html: <canvas id="chart-N">, config: text }` — 如果 `JSON.parse(text)` 失败，返回 `{ html: <pre class="chart-error">无效的 Chart.js JSON 配置</pre>, config: null }`
- `handleSvg(text)` → `<div class="svg-container">${text}</div>`
- `handleCanvas(text, index)` → `{ html: <canvas id="canvas-N">, script: 安全过滤后的 IIFE }`
- Canvas 安全过滤：静态字符串检查拒绝 `fetch(`, `XMLHttpRequest`, `eval(`, `import(`, `Function(`, `setTimeout(`, `setInterval(`, `document.cookie`, `window.location`

**Patterns to follow:**
- `output/sample-export-preview.html` 中的 CSS（用户已验证）

**Test scenarios:**
- Happy path: `handleMermaid("graph TD\n A-->B")` 返回含 `<pre class="mermaid">` 的 HTML
- Happy path: `handleChart('{"type":"bar","data":{}}', 0)` 返回含 `<canvas id="chart-0">` 的 HTML
- Happy path: `handleSvg("<svg>...</svg>")` 返回含 `<svg>` 的 HTML
- Happy path: `handleCanvas("ctx.fillRect(0,0,100,100)", 0)` 返回含 canvas 和 IIFE script
- Edge case: Canvas handler 拒绝含 `fetch(` 或 `eval(` 或 `Function(` 或 `setTimeout(` 的代码
- Edge case: 空代码块文本产生有效但空的容器
- Error path: `handleChart("not json{{{", 0)` 返回含 `<pre class="chart-error">` 的错误提示而非 canvas

**Verification:**
- CSS 模板是完整非空字符串，覆盖所有选择器
- 4 个 handler 对典型输入返回有效 HTML

- [x] **Unit 3: 实现 markdown 渲染器（marked 配置 + TOC + heading ID）**

**Goal:** 构建核心 `renderMarkdown()` 函数，配置 `marked` + `marked-katex-extension`，自定义 renderer 分发代码块，heading 注入 ID，walkTokens 收集 TOC。

**Requirements:** R1, R2, R3, R4, R5, R6, R8

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `.opencode/plugins/coaching-tools/services/html-renderer/index.ts`

**Approach:**
- Import `Marked` from `marked`, `markedKatex` from `marked-katex-extension`
- 创建 `createRenderer()` 工厂，返回 `{ render(markdown): MarkdownRenderResult }`
- Marked 配置：`gfm: true, breaks: false`
- 使用 `marked-katex-extension`：在 Node 端将 `$...$`/`$$...$$` 渲染为 `<span class="katex">` HTML（由 `katex.renderToString()` 完成）
- 自定义 `code({ text, lang })` 按 lang 分发到 Unit 2 的 handlers
- 自定义 `heading({ tokens, depth })` 注入 `id` 属性 — CJK 字符直接使用作为 ID（如 `id="数量关系"`），去重追加 `-2` 后缀
- `walkTokens` 收集 heading 条目到 TOC 数组
- `MarkdownRenderResult` 类型：`{ html, toc, chartConfigs, canvasScripts }`

**Patterns to follow:**
- `marked` v15 API: `new Marked({...})`, `code({ text, lang })` 签名
- `walkTokens(token)` 收集 heading
- ESM import `.js` 后缀

**Test scenarios:**
- Happy path: `render("# Title\n\n**bold**")` → `<h1 id="title">Title</h1><p><strong>bold</strong></p>`
- Happy path: `render("## A\n### B")` → TOC 有 2 个条目，depth 正确
- Happy path: `render("$E=mc^2$")` → 公式内容未被 emphasis 解析破坏
- Happy path: `render("```mermaid\ngraph TD\n A-->B\n```")` → 含 `<pre class="mermaid">`
- Happy path: `render("<details><summary>Q</summary>\n\n**A**\n\n</details>")` → 保留 `<details>`
- Edge case: 重复标题文本生成去重 slug（`section`, `section-2`）
- Edge case: 无语言标签的代码块走默认 `<pre><code>` 渲染

**Verification:**
- `renderMarkdown()` 返回结构化结果（html, toc, chartConfigs, canvasScripts）
- TOC 条目有正确的 depth、text、唯一 slug ID
- KaTeX 公式在输出 HTML 中完好

- [x] **Unit 4: 实现前端 JS 和 HTML 文档组装**

**Goal:** 构建客户端 JS 模板（KaTeX/Mermaid/Chart.js/Canvas 初始化 + Tab/TOC 交互）和 `buildHtmlDocument()` 完整 HTML 组装函数。

**Requirements:** R2, R3, R4, R6, R7, R8, R9

**Dependencies:** Unit 2, Unit 3

**Files:**
- Modify: `.opencode/plugins/coaching-tools/services/html-renderer/client-scripts.ts`
- Modify: `.opencode/plugins/coaching-tools/services/html-renderer/index.ts`

**Approach:**

**client-scripts.ts** — `buildClientScripts({ chartConfigs, canvasScripts })`:
- KaTeX: `renderMathInElement(document.body, { delimiters: [...] })` via CDN auto-render
- Mermaid: `mermaid.initialize({ startOnLoad: true })` via CDN
- Chart.js: 循环 chartConfigs，`new Chart(canvas, config)` — `DOMContentLoaded`
- Canvas: 循环 canvasScripts，IIFE 执行 — `DOMContentLoaded`
- Tab 切换: `switchTab(event, panelId)` 函数
- TOC 滚动高亮: `IntersectionObserver` on headings, 更新 `.active`
- 全部在一个 `<script>` 块中

**index.ts — `buildHtmlDocument()`**:
- `<head>`: charset, viewport, title, 内联 CSS, CDN links (KaTeX CSS+JS+auto-render, Mermaid JS, Chart.js JS — 全部 `defer` + `onload`)
- `<body>`: `<nav class="toc">` 侧边栏 + `<main><article>` 内容 + `<script>` 块
- CDN 用 `cdn.jsdelivr.net/npm/` 固定版本

**Patterns to follow:**
- `output/sample-export-preview.html` 中的 CDN 加载和 JS 初始化模式
- `<script defer ... onload="...">` 保证初始化顺序

**Test scenarios:**
- Happy path: 组装 HTML 包含 `<!doctype html>`, 内联 CSS, CDN script 标签, 内容
- Happy path: CDN 标签包含 KaTeX, Mermaid, Chart.js 正确 URL
- Happy path: chartConfigs 注入到前端 `<script>` 作为 JSON
- Happy path: canvasScripts 在前端 `<script>` 中被 IIFE 包裹
- Edge case: 无 chartConfigs → 不输出 Chart.js 渲染代码
- Edge case: 无 canvasScripts → 不输出 Canvas 执行代码
- Edge case: 无 headings → 空 TOC nav（或省略）

**Verification:**
- `buildHtmlDocument()` 产生完整的、格式正确的 HTML 字符串

- [x] **Unit 5: 集成到 export-service，更新测试，创建 markdown 样例**

**Goal:** 将 `export-service.ts` 的 `renderHtmlDocument` 替换为调用 `html-renderer/` 管线。更新现有测试。添加新测试用例。创建包含全部 8 种语法的 markdown 样例 fixture。

**Requirements:** R10, R11

**Dependencies:** Unit 3, Unit 4

**Files:**
- Modify: `.opencode/plugins/coaching-tools/services/export-service.ts`
- Modify: `.opencode/tests/coaching-tools/export-service.test.ts`
- Create: `.opencode/tests/fixtures/export/sample-content.md`

**Approach:**

**export-service.ts 改动：**
- 移除旧的 `renderHtmlDocument`, `escapeHtml` 函数
- Import `renderMarkdown`, `buildHtmlDocument` from `./html-renderer/index.js`
- `format === "html"` 时：调用 `renderMarkdown(input.content)` → `buildHtmlDocument(...)` → 写文件
- Markdown 导出路径不变

**测试更新：**
- 更新 "wraps html output" 测试 — 添加对 `<article>` 和 CSS 的断言
- 保留全部现有 6 个测试（路径安全、碰撞、空内容等）
- 新增测试：
  - "renders markdown headings as HTML with IDs"
  - "generates TOC from headings"
  - "renders mermaid code block as mermaid container"
  - "renders chart code block as canvas element"
  - "preserves KaTeX formula delimiters in HTML output"
  - "preserves HTML passthrough elements (details)"

**Markdown fixture** (`sample-content.md`):
- 包含全部 8 种能力示例：headings, bold/lists/tables, `$...$`/`$$...$$`, ` ```mermaid `, ` ```chart `, ` ```svg `, ` ```canvas `, `<details>`, `<div class="tabs">`, `<span class="tip">`

**Patterns to follow:**
- 现有测试模式：temp worktree, `readFile` 断言, `toContain`/`toMatch`
- 现有 fixture 模式在 `.opencode/tests/fixtures/`

**Test scenarios:**
- Happy path: 全部 6 个现有测试继续通过
- Happy path: "renders headings" 验证 `<h2 id="...">` 在输出中
- Happy path: "generates TOC" 验证 `<nav class="toc">` 带链接
- Happy path: "mermaid block" 验证 `<pre class="mermaid">`
- Happy path: "chart block" 验证 `<canvas id="chart-0">`
- Happy path: "KaTeX preserved" 验证 `$...$` 存活
- Happy path: "HTML passthrough" 验证 `<details>` 保留
- Integration: 用 `sample-content.md` fixture 导出完整 HTML

**Verification:**
- `npx vitest run` 全部通过
- 导出的 HTML 在浏览器中正确显示

- [x] **Unit 6: 更新 export-html 和 export-markdown skill + export-workflow 规则** ✅ 已完成

**Goal:** 重写 skill 和规则文件，使 LLM 能正确加载 skill、自动选择格式、使用扩展语法。

**已完成的工作：**

1. **`export-html/SKILL.md`** — 已重写：
   - 新增 `## 何时用 HTML（自动选择规则）`：题目/公式/图形/图表/交互/多标题 → 必选 HTML
   - 新增 `## Markdown 扩展语法`：完整文档化 8 种语法（KaTeX、Mermaid、Chart.js、SVG、Canvas、details、tabs、tip），每种附示例
   - 新增 `## 目录导航`：自动 TOC 生成规则
   - 更新 `## 关键注意`：强调始终传 Markdown、不要自己转 HTML

2. **`export-markdown/SKILL.md`** — 已重写：
   - 新增 `## 何时不应用 Markdown`：列出应改用 HTML 的场景
   - 移除不再适用的目录生成提示（markdown 不支持动态 TOC）

3. **`export-workflow.md`** — 已重写：
   - 将"不要加载 skill"改为"加载对应 skill"
   - 新增 `## 导出流程`：确定格式 → 加载 skill → 调用工具
   - 新增 format 自动选择规则（题目/公式/图形 → HTML，纯文本 → markdown）
   - 新增目录自动生成规则（2+ 标题 → 自动 TOC）
   - content 提取规则不变

## System-Wide Impact

- **Interaction graph:** `export-document` tool 被 LLM 调用，接口不变，无需修改任何 agent
- **Error propagation:** `marked` 解析失败时 tool 返回 `"导出失败: ..."` 字符串（现有模式）
- **State lifecycle risks:** 无持久状态变更 — 纯渲染变换。`output/` 目录行为不变
- **API surface parity:** `export-document` tool 接口不变。Markdown 导出路径不变
- **Integration coverage:** 端到端测试用完整 markdown fixture 验证全部 8 种能力
- **Unchanged invariants:** tool args, 文件名生成, 路径安全检查, markdown 导出, 其他 tools

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `marked-katex-extension` 与 `marked@15` 不兼容 | 扩展 v5.1.8 列 `marked>=12` 为 peer dep。若不兼容，回退到自定义 `emStrongMask` hook |
| CDN 脚本离线加载失败 | 图表/流程图优雅降级 — HTML 内容仍正常渲染，动态元素显示空容器 |
| Canvas 代码块执行任意 JS | 静态字符串过滤 + 内容可信（LLM 生成） |
| 破坏现有测试 | 现有测试只检查 `<!doctype html>`、标题、路径安全 — 不检查具体 CSS 或渲染细节 |
| CSS 模板过大 | ~3KB minified，对独立 HTML 文件可接受 |

## Documentation / Operational Notes

- `export-html` skill 已更新：包含完整的 8 种扩展语法指南和格式自动选择规则 ✅
- `export-markdown` skill 已更新：包含 HTML 重定向提示 ✅
- `export-workflow.md` 共享规则已更新：格式自动选择 + 目录规则 + skill 加载流程 ✅
- 导出的 HTML 需要网络加载 CDN 脚本
- `output/sample-export-preview.html` 保留为视觉参考

## Sources & References

- **Sample HTML**: `output/sample-export-preview.html`（用户验证的 CSS/布局参考）
- Related code: `.opencode/plugins/coaching-tools/services/export-service.ts`, `.opencode/plugins/coaching-tools/tools/export-document.ts`
- Related skill: `.opencode/skills/export-html/SKILL.md`
- Related rule: `.opencode/rules/export-workflow.md`
- External: [marked v15 API](https://marked.js.org), [marked-katex-extension](https://www.npmjs.com/package/marked-katex-extension)
