import { tool } from "@opencode-ai/plugin"

import { loadProfile } from "../services/profile-service.js"
import { registerGeneratedQuestion } from "../services/practice-service.js"
import { abandonAttempt, activateAttemptTimer, getTimerStatus, stopAttemptTimer } from "../services/timer-service.js"

export function createTimerTool() {
  return tool({
    description: "计时器工具。操作: start(开始计时), stop(停止并返回耗时), status(查看当前状态), abandon(放弃当前计时)。",
    args: {
      action: tool.schema.enum(["start", "stop", "status", "abandon"]).describe("操作类型"),
      questionId: tool.schema.string().optional().describe("题目ID (start 时可选)"),
      timeout: tool.schema.number().optional().describe("超时秒数 (默认180)"),
      username: tool.schema.string().optional().describe("用户名 (新计时链路可选)"),
      subject: tool.schema.string().optional().describe("科目 (新计时链路可选)"),
      leafTopic: tool.schema.string().optional().describe("叶子题型 (新计时链路可选)"),
      questionText: tool.schema.string().optional().describe("题目文本/老师输出 (新计时链路可选)"),
      correctAnswer: tool.schema.string().optional().describe("正确答案 (新计时链路可选)"),
      expectedEpoch: tool.schema.number().optional().describe("期望会话 epoch (新计时链路可选)"),
    },
    async execute(args, context) {
      try {
        const worktree = context.worktree
        const sessionId = context.sessionID
        switch (args.action) {
          case "start": {
            const timeout = args.timeout || 180
            if (!args.username || !args.subject || !args.correctAnswer) {
              return "Error: timer start 必须传 username、subject、correctAnswer 以走 durable attempt 流程"
            }

            const loaded = await loadProfile(worktree, args.username)
            if (loaded.status !== "loaded" || !loaded.profile) {
              return `Error: 用户 ${args.username} 不存在，无法开始新计时流程`
            }

            const registered = await registerGeneratedQuestion(worktree, {
              profileId: loaded.profile.id,
              sessionId,
              questionId: args.questionId || `q-${Date.now()}`,
              subject: args.subject,
              leafTopic: args.leafTopic || "",
              teacherPrompt: args.questionText || "",
              correctAnswer: args.correctAnswer,
            })

            if (registered.status === "blocked") {
              return "Error: 当前用户已有进行中的题目，请先完成或放弃后再开始新题"
            }
            if (registered.status !== "registered" || !registered.attempt) {
              return "Error: 无法注册当前题目"
            }

            const active = await activateAttemptTimer(worktree, {
              attemptId: registered.attempt.id,
              profileId: loaded.profile.id,
              sessionId,
              timeoutSeconds: timeout,
            })

            if (active.status !== "active" || !active.attempt) {
              return "Error: 无法激活当前题目的计时状态"
            }

            return `计时开始 (超时 ${timeout}s) | attemptId=${active.attempt.id} | epoch=${active.epoch}`
          }
          case "stop": {
            const stopped = await stopAttemptTimer(worktree, {
              sessionId,
              expectedEpoch: args.expectedEpoch,
            })
            if (stopped.status === "stale_session") {
              return "Error: 当前会话已切换用户或题目，请重新开始"
            }
            if (stopped.status === "inactive") {
              return "Error: 当前题目已结束，不能再次停止计时"
            }
            if (stopped.status === "timed_out") {
              return `已超时 | attemptId=${stopped.attempt?.id || "unknown"} | epoch=${stopped.epoch ?? "unknown"}`
            }
            if (stopped.status === "stopped" && stopped.attempt && stopped.elapsedSeconds !== undefined) {
              const mins = Math.floor(stopped.elapsedSeconds / 60)
              const secs = stopped.elapsedSeconds % 60
              return `${stopped.elapsedSeconds} (${mins}分${secs}秒) | attemptId=${stopped.attempt.id} | epoch=${stopped.epoch ?? "unknown"}`
            }
            return "Error: 没有正在进行的计时"
          }
          case "status": {
            const status = await getTimerStatus(worktree, {
              sessionId,
              expectedEpoch: args.expectedEpoch,
            })
            if (status.status === "stale_session") {
              return "Error: 当前会话已切换用户或题目，请重新开始"
            }
            if (status.status === "inactive") {
              return "当前题目已结束"
            }
            if (status.status === "timed_out") {
              return `已超时 | attemptId=${status.attempt?.id || "unknown"} | epoch=${status.epoch ?? "unknown"}`
            }
            if (status.status === "active" && status.attempt?.timer?.startedAt && status.attempt?.timer?.timeoutSeconds) {
              const elapsed = Math.round((Date.now() - Date.parse(status.attempt.timer.startedAt)) / 1000)
              const remaining = status.attempt.timer.timeoutSeconds - elapsed
              return `正在计时: 已过 ${elapsed}s, 剩余 ${Math.max(remaining, 0)}s | attemptId=${status.attempt.id} | epoch=${status.epoch ?? "unknown"}`
            }
            return "没有正在进行的计时"
          }
          case "abandon": {
            const abandoned = await abandonAttempt(worktree, {
              sessionId,
              expectedEpoch: args.expectedEpoch,
            })
            if (abandoned.status === "stale_session") {
              return "Error: 当前会话已切换用户或题目，请重新开始"
            }
            if (abandoned.status === "inactive") {
              return "Error: 当前题目已结束，不能重复放弃"
            }
            if (abandoned.status === "timed_out") {
              return `已超时 | attemptId=${abandoned.attempt?.id || "unknown"} | epoch=${abandoned.epoch ?? "unknown"}`
            }
            if (abandoned.status === "abandoned") {
              return `已放弃当前计时，标记为未答 | attemptId=${abandoned.attempt?.id || "unknown"} | epoch=${abandoned.epoch ?? "unknown"}`
            }
            return "Error: 没有正在进行的计时"
          }
          default:
            return `Error: 未知操作 ${args.action}`
        }
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
