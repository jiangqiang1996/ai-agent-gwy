import { tool } from "@opencode-ai/plugin"

import { XINGCE_SUBJECTS } from "../shared/constants.js"
import { getLeafTopics, getValidSubjects } from "../shared/formatters.js"
import { loadProfile } from "../services/profile-service.js"

export function createQuestionGeneratorTool() {
  return tool({
    description: "经典例题/代表性示例生成工具。根据科目、考试类型和地区生成老师的示例讲解提示模板。",
    args: {
      subject: tool.schema.string().optional().describe("科目名称 (可选, 不填则根据用户画像/考试类型选择)"),
      username: tool.schema.string().describe("用户名 (用于查询学习画像)"),
      leafTopic: tool.schema.string().optional().describe("叶子题型 (可选)"),
      examTypes: tool.schema.array(tool.schema.string()).optional().describe("考试类型数组 (可选, 用于差异化出题)"),
      region: tool.schema.string().optional().describe("地区/省份 (可选, 用于地区特殊科目)"),
    },
    async execute(args, context) {
      try {
        const worktree = context.worktree
        const profileState = await loadProfile(worktree, args.username)
        if (profileState.status === "blocked") {
          return `Error: 用户 ${args.username} 当前处于冲突/修复状态，无法基于档案生成示例。请先修复档案或显式指定科目/考试类型。`
        }
        const profile = profileState.status === "loaded" ? profileState.profile : undefined
        const userExamTypes = args.examTypes ?? profile?.examTypes ?? []
        const userRegion = args.region ?? profile?.region ?? null
        const validSubjects = getValidSubjects(userExamTypes, userRegion)

        let selectedSubject = args.subject
        let selectedLeaf = args.leafTopic

        if (!selectedSubject) {
          const pool = validSubjects.length > 0 ? validSubjects : XINGCE_SUBJECTS
          selectedSubject = pool[Math.floor(Math.random() * pool.length)]
        }

        if (!validSubjects.includes(selectedSubject) && !XINGCE_SUBJECTS.includes(selectedSubject)) {
          return `Error: 未知科目 "${selectedSubject}"。可选: ${validSubjects.join(", ")}`
        }

        if (!selectedLeaf) {
          const leaves = getLeafTopics(selectedSubject, userRegion)
          if (leaves.length > 0) {
            selectedLeaf = leaves[Math.floor(Math.random() * leaves.length)]
          }
        }

        const questionId = `example-${Date.now()}`
        const teacherPrompt = `请围绕${selectedSubject}${selectedLeaf ? " (" + selectedLeaf + ")" : ""}给出 1 个代表性经典例题，并完成详细讲解。

要求:
1. 先用 1-2 句话概括这道例题对应的核心知识点
2. 再给出 1 道有代表性的例题，题型可以是选择题或更适合讲解的形式
3. 必须包含题目文本、答案要点和详细解析
4. 解释中要突出思路、易错点和为什么这个例题有代表性

输出格式:
知识点总结: [1-2句]
例题: [题目文本]
答案要点: [关键答案]
解析: [详细解析]`

        return JSON.stringify({
          questionId,
          subject: selectedSubject,
          leafTopic: selectedLeaf || "",
          teacherPrompt,
        })
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
