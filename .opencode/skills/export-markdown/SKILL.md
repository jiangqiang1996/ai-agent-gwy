---
name: export-markdown
description: '将指定内容导出为 Markdown 文件到 output/。用户说"导出成 markdown"、"保存为 markdown"、"把当前内容落成 md 文件"时触发。'
argument-hint: "[要导出的内容或标题]"
---

# 导出 Markdown

将指定内容导出为 Markdown 文件。

## 执行步骤

1. 确认用户明确要求导出
2. 收集内容与标题（没有标题时允许留空）
3. 调用 `export-document` 工具，传 `format=markdown`
4. 把导出后的相对路径告诉用户

## 使用原则

- 只有显式导出意图时才落文件
- 默认导出到项目根目录 `output/`
- 如果用户只是想预览，不要直接写文件
