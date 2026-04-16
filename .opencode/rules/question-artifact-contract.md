# Question Artifact 契约

题目讲解场景下，系统在进入老师/状元解释前，必须先把用户提供的题目内容收敛为 `QuestionArtifact`。本契约适用于所有输入渠道（图片、文字粘贴、拍照等）。

最小字段：

- `content`: 结构化题面文本
- `layoutType`: `text` / `table-heavy` / `mixed`
- `confidence`: 高 / 中 / 低
- `completeness`: 完整 / 部分 / 不足以解释
- `unresolvedRegions`: 无法可靠识别的区域或说明

确认门控（Confirmation Gate）：

当 `confidence` 不为"高" 或 `completeness` 不为"完整"时，系统**必须**在路由到老师/状元之前执行以下步骤：

1. 将识别到的题目内容原文展示给用户。
2. 向用户提问："我识别到的题目内容如下，请确认是否有误或信息不完整：\n\n[QuestionArtifact.content 全文]\n\n请确认、补充或纠正。"
3. 等待用户回复后再继续后续流程。

- 用户确认无误 → 以当前 `QuestionArtifact` 进入老师路由。
- 用户补充或纠正 → 更新 `QuestionArtifact` 后重新评估。
- 用户表示无法补充 → 视剩余信息决定是否继续，或在明确无法讲解时告知用户。

该门控适用于**所有输入渠道**，不限于图片场景。

使用规则：

- 老师和状元消费的是 `QuestionArtifact`，不是未经整理的原始内容。
- 当 `confidence` 低或 `completeness` 不足时，必须先走确认门控；门控后用户仍无法补全时，才回退到"请补清晰图片或补充文字"。
- 如果用户提供的是单题内容，默认把该题作为主例题；只有在确有帮助时才额外补 1 个经典例题。
