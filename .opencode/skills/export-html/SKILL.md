---
name: export-html
description: '将指定内容导出为 HTML 文件到 output/。用户说"导出成 html"、"保存为 html"、"把当前内容落成网页文件"时触发。'
argument-hint: "[要导出的内容或标题]"
---

# 导出 HTML

将指定内容导出为精美 HTML 文件。支持数学公式、流程图、数据图表、SVG 图形、Canvas 动态绘图、折叠展开、Tab 切换和自动目录。

## 执行步骤

1. 确认用户明确要求导出。
2. 确定 content：
   - 如果用户指定了要导出的内容，直接使用。
   - 如果用户没有指定，将本轮对话中**最近一次老师/状元的完整回答**作为 content。
   - content 必须是纯文本或 Markdown 格式，不要包含工具调用或中间过程。
3. 确定 title：优先用用户给出的标题；没有则从内容中提取主题；都没有时留空。
4. **立即**调用 `export-document` 工具，参数：`format="html"`, `content=<步骤2的内容>`, `title=<步骤3的标题>`。
5. 工具返回后，把导出后的相对路径告诉用户。

## 何时用 HTML

以下场景**必须选 HTML**（不要问用户选格式）：
- 内容包含 Canvas 动态绘图（` ```canvas ` 代码块）
- 内容包含 Chart.js 数据图表（` ```chart ` 代码块）
- 内容包含 SVG 图形（` ```svg ` 代码块）
- 内容包含交互组件（Tab 切换 `<div class="tabs">`、折叠 `<details>`、Tooltip `<span class="tip">`）
- 内容包含图片（截图、题图、`![...]()`）
- 用户明确说"导出成 html"或"保存为 html"

其他内容（包括简单 mermaid 流程图、数学公式、纯文本题目）默认导出 markdown，应加载 `export-markdown` skill。

## Markdown 扩展语法

在 content 中可以使用以下扩展语法，工具会自动渲染：

### 数学公式（KaTeX）
```
行内公式：$E=mc^2$
块级公式：
$$\sum_{i=1}^{n} a_i = S$$
```

### 流程图（Mermaid）
用 ` ```mermaid ` 代码块，写 Mermaid 语法：
```
graph TD
    A[开始] --> B{判断}
    B -->|是| C[结果1]
    B -->|否| D[结果2]
```

### 数据图表（Chart.js）
用 ` ```chart ` 代码块，写 JSON 配置：
```json
{"type":"bar","data":{"labels":["2019","2020","2021"],"datasets":[{"label":"GDP","data":[7.1,6.8,7.5]}]}}
```
支持的 type：`bar`（柱状图）、`line`（折线图）、`pie`（饼图）、`doughnut`（环形图）。

### SVG 图形
用 ` ```svg ` 代码块，直接写 SVG 标签：
```svg
<svg width="200" height="100">
  <circle cx="50" cy="50" r="40" fill="#2563eb"/>
</svg>
```

### Canvas 动态绘图
用 ` ```canvas ` 代码块，写 JavaScript Canvas API 代码。代码中可直接使用 `canvas`（canvas 元素）和 `ctx`（2D 上下文）变量：
```canvas
ctx.beginPath();
ctx.moveTo(50, 200);
ctx.bezierCurveTo(100, 50, 200, 50, 250, 200);
ctx.strokeStyle = "#2563eb";
ctx.lineWidth = 2;
ctx.stroke();
```
**禁止使用** `fetch`、`XMLHttpRequest`、`eval`、`import`。

### 交互组件

折叠展开（题目→点击显示解析）：
```html
<details>
<summary>📋 题目：某商品先涨价 20%...</summary>

**正确答案：B**

解析内容...

</details>
```

Tab 切换（多种解法）：
```html
<div class="tabs">
  <div class="tab-buttons">
    <button class="tab-btn active" onclick="switchTab(event,'tab-1')">方法一</button>
    <button class="tab-btn" onclick="switchTab(event,'tab-2')">方法二</button>
  </div>
  <div class="tab-panel active" id="tab-1">方法一内容</div>
  <div class="tab-panel" id="tab-2">方法二内容</div>
</div>
```

悬停提示：
```html
<span class="tip">路程<span class="tip-text">路程 = 速度 × 时间</span></span>
```

### 目录导航
- 当内容包含 **2 个及以上** `##` / `###` / `####` 标题时，自动生成侧边栏目录。
- 目录支持滚动高亮和点击跳转。
- **不要**在 content 中手写目录，工具会自动处理。

## 关键注意

- **不要**用 `write` 工具或 `bash` 写文件，必须用 `export-document` 工具。
- **不要**在调用工具前反复确认或思考，收集到 content 后直接调用。
- 只有显式导出意图时才落文件。
- 默认导出到项目根目录 `output/`。
- content 始终传 Markdown，**不要**自己把 Markdown 转成 HTML 再传。