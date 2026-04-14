# 练题闭环共享规则

新的练题闭环默认采用 attempt-backed 流程：

1. 编排器先调用 `question-generator` 选择科目、题型和题目模板。
2. 老师代理在出题场景下必须输出可结构化读取的完整题目：题目、A/B/C/D、正确答案、解析。
3. 编排器展示题目后，调用 `timer start`，并传入 `username`、`subject`、`leafTopic`、`questionText`、`correctAnswer`、`questionId`。该步骤会注册 attempt 并返回 `attemptId` 和 `epoch`。
4. 用户提交答案后，编排器调用 `timer stop`（带 `expectedEpoch`）获取耗时与当前 attempt。
5. 编排器调用 `grading`（传 `attemptId` 和 `timeSeconds`）完成判题。
6. 编排器调用 `points`（传 `attemptId`）完成积分、连胜、历史和 mastery 的统一结算。
7. 对已经走 attempt-backed 结算的练题，不再额外调用 `user-profile updateMastery`，避免重复写入。

如果计时流程返回 stale session、blocked identity 或 timed out，编排器要显式重启或结束该题流程，不要猜测旧状态。
