# 导出工作流共享规则

## 核心原则

- 只有在用户明确要求导出时才写文件。
- 导出目标统一为项目根目录 `output/`。
- 系统可以建议导出，但不能自动写文件。

## 直接调用 export-document 工具

用户要求导出时，**不要加载 export-html / export-markdown skill**，直接调用 `export-document` 工具。这避免额外的一轮工具调用开销。

### 参数构造

| 参数 | 值 |
|------|------|
| `format` | 用户说 html → `"html"`，否则默认 `"markdown"` |
| `content` | 要导出的文本，**始终传 Markdown 或纯文本**，工具会自动处理 HTML 渲染 |
| `title` | 可选。用户给出的标题，或从内容中提取的主题关键词 |

### content 提取规则

1. 用户明确指定了要导出的内容 → 直接用。
2. 用户没指定 → 取本轮对话中**最近一次老师/状元的回答正文**。
3. content 只保留实质内容（知识点、讲解、例题），不包含工具调用、确认过程或系统消息。
4. **不要**在调用工具前反复确认，收集到 content 后立即调用。

### 关键禁止

- **不要**用 `write`、`edit` 或 `bash` 写文件，必须用 `export-document` 工具。
- **不要**加载 export-html / export-markdown skill。
- **不要**自己把 Markdown 转成 HTML 再传 content，始终传原始 Markdown。
