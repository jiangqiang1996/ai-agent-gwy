import { tool } from "@opencode-ai/plugin"

export function createGradingTool() {
  return tool({
    description: "判题工具。对比用户答案和正确答案，返回判题结果。支持客观题(选择题)和主观题(分级评分)。",
    args: {
      correctAnswer: tool.schema.string().describe("正确答案"),
      userAnswer: tool.schema.string().describe("用户答案"),
      questionType: tool.schema.enum(["objective", "subjective"]).describe("题目类型: objective(客观题) 或 subjective(主观题)"),
    },
    async execute(args) {
      try {
        if (args.questionType === "objective") {
          const correct = args.userAnswer.trim().toUpperCase() === args.correctAnswer.trim().toUpperCase()
          return correct ? "correct" : `wrong|${args.correctAnswer.trim().toUpperCase()}`
        }
        return "subjective|需要老师评判"
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
