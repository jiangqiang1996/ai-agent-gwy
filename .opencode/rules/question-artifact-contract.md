# Question Artifact 契约

截图题目讲解场景下，系统在进入老师/状元解释前，必须先把用户上传的题目图片收敛为 `QuestionArtifact`。

最小字段：

- `content`: 结构化题面文本
- `layoutType`: `text` / `table-heavy` / `mixed`
- `confidence`: 高 / 中 / 低
- `completeness`: 完整 / 部分 / 不足以解释
- `unresolvedRegions`: 无法可靠识别的区域或说明

使用规则：

- 老师和状元消费的是 `QuestionArtifact`，不是未经整理的原始图片。
- 当 `confidence` 低或 `completeness` 不足时，不要继续硬讲，必须回退到“请补清晰截图或补充文字”。
- 如果用户上传的是单题截图，默认把该题作为主例题；只有在确有帮助时才额外补 1 个经典例题。
