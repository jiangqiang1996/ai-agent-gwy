# Markmap 大型知识图谱导出容器尺寸规范

> 本文件由 `/ae-save-rules` 命令生成，最后更新：2026-04-21

当导出的 HTML 内容包含大型 markmap/mindmap 代码块（节点超过 50 个）时，转换后需手动调整容器尺寸以确保完整的可视化效果：

- `.markmap-host` 的 min-height 设为 900px，并设置 `height: calc(100vh - 20px)`
- `.markmap-host > svg` 的 min-height 同步设为 900px，height 设为 100%
- `body.no-toc main` 的 max-width 设为 100%，padding 缩减为 10px
- markmap 初始化参数 `initialExpandLevel` 设为 3（默认展开 3 层），`fitRatio` 设为 0.95，`maxWidth` 设为 280
- 对于知识图谱类导出（纯 markmap 内容），`.markmap-container` 去掉 margin/border/shadow，全屏展示
- `article` 的 `overflow-wrap` 设为 `visible`，避免内容被截断
