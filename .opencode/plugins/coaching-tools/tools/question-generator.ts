import { tool } from "@opencode-ai/plugin"

import { XINGCE_SUBJECTS } from "../shared/constants.js"
import { getLeafTopics, getValidSubjects } from "../shared/formatters.js"
import { loadProfileByName } from "../runtime/profile-helpers.js"

export function createQuestionGeneratorTool() {
  return tool({
    description: "出题工具。根据科目、考试类型和地区生成出题提示模板。支持考试类型差异化权重出题。冷启动用户自动随机选择科目。",
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
        const userExamTypes = args.examTypes || []
        const userRegion = args.region || null
        const validSubjects = getValidSubjects(userExamTypes, userRegion)

        let selectedSubject = args.subject
        let selectedLeaf = args.leafTopic

        if (!selectedSubject) {
          const profile = loadProfileByName(worktree, args.username)
          if (profile && Object.keys(profile.mastery).length > 0) {
            const examSubjects = userExamTypes.length > 0 ? validSubjects : XINGCE_SUBJECTS
            let worstAcc = 100
            const candidates: string[] = []
            for (const subject of examSubjects) {
              const mastery = profile.mastery[subject]
              if (mastery && mastery.total >= 5) {
                const accuracy = (mastery.correct / mastery.total) * 100
                if (accuracy < worstAcc) {
                  worstAcc = accuracy
                  candidates.length = 0
                  candidates.push(subject)
                } else if (accuracy === worstAcc) {
                  candidates.push(subject)
                }
              } else if (!mastery) {
                candidates.push(subject)
              }
            }
            if (candidates.length > 0) {
              selectedSubject = candidates[Math.floor(Math.random() * candidates.length)]
            } else {
              selectedSubject = examSubjects[Math.floor(Math.random() * examSubjects.length)]
            }
          } else {
            const pool = validSubjects.length > 0 ? validSubjects : XINGCE_SUBJECTS
            selectedSubject = pool[Math.floor(Math.random() * pool.length)]
          }
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

        const questionId = `q-${Date.now()}`
        const teacherPrompt = `请出一道${selectedSubject}${selectedLeaf ? " (" + selectedLeaf + ")" : ""}的练习题。

要求:
1. 必须是单项选择题 (4个选项 A/B/C/D)
2. 题目要有实际难度，不能太简单
3. 必须包含完整的题目文本、4个选项、正确答案和详细解析
4. 自检: 生成后请验证你的答案是否确实正确，选项是否有逻辑问题

输出格式:
题目: [题目文本]
A. [选项A]
B. [选项B]
C. [选项C]
D. [选项D]
正确答案: [A/B/C/D]
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
