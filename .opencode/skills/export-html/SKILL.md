---
name: export-html
description: '将指定内容导出为 HTML 文件到 output/。用户说"导出成 html"、"保存为 html"、"把当前内容落成网页文件"时触发。'
argument-hint: "[要导出的内容或标题]"
---

# 导出 HTML

将指定内容导出为 HTML 文件。

## 执行步骤

1. 确认用户明确要求导出
2. 收集内容与标题（没有标题时允许留空）
3. 调用 `export-document` 工具，传 `format=html`
4. 把导出后的相对路径告诉用户

## 使用原则

- 只有显式导出意图时才落文件
- 对排版质量要求高、需要更好展示时优先推荐 HTML
- 默认导出到项目根目录 `output/`
