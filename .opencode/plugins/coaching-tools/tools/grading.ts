import { tool } from "@opencode-ai/plugin"

import { gradeAttempt } from "../services/practice-service.js"

export function createGradingTool() {
  return tool({
    description: "判题工具。对比用户答案和正确答案，返回判题结果。支持客观题(选择题)和主观题(分级评分)。",
    args: {
      correctAnswer: tool.schema.string().describe("正确答案"),
      userAnswer: tool.schema.string().describe("用户答案"),
      questionType: tool.schema.enum(["objective", "subjective"]).describe("题目类型: objective(客观题) 或 subjective(主观题)"),
      attemptId: tool.schema.string().optional().describe("attempt ID (新链路可选)"),
      timeSeconds: tool.schema.number().optional().describe("答题秒数 (新链路可选)"),
    },
    async execute(args, context) {
      try {
        if (args.questionType === "objective") {
          const correct = args.userAnswer.trim().toUpperCase() === args.correctAnswer.trim().toUpperCase()
          if (args.attemptId && args.timeSeconds !== undefined) {
            const graded = await gradeAttempt(context.worktree, {
              attemptId: args.attemptId,
              answerText: args.userAnswer,
              questionType: "objective",
              correct,
              timeSeconds: args.timeSeconds,
            })
            if (graded.status !== "evaluated") {
              return `Error: attempt ${args.attemptId} 当前无法判题`
            }
          }
          return correct ? "correct" : `wrong|${args.correctAnswer.trim().toUpperCase()}`
        }
        if (args.attemptId && args.timeSeconds !== undefined) {
          const graded = await gradeAttempt(context.worktree, {
            attemptId: args.attemptId,
            answerText: args.userAnswer,
            questionType: "subjective",
            correct: null,
            timeSeconds: args.timeSeconds,
          })
          if (graded.status !== "pending_subjective_review") {
            return `Error: attempt ${args.attemptId} 当前无法进入待评阅状态`
          }
        }
        return "subjective|需要老师评判"
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
