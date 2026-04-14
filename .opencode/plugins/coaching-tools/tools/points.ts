import { tool } from "@opencode-ai/plugin"

import { LEVEL_THRESHOLDS, POINTS_CORRECT, POINTS_WRONG } from "../shared/constants.js"
import { calcLevel } from "../shared/formatters.js"
import { applyAttemptResult } from "../services/result-service.js"
import { loadProfileByName, saveProfile } from "../runtime/profile-helpers.js"

export function createPointsTool() {
  return tool({
    description: "积分工具。操作: award(答对加分), deduct(答错扣分), getLevel(获取等级信息)。积分变化会自动持久化到用户档案。",
    args: {
      action: tool.schema.enum(["award", "deduct", "getLevel"]).describe("操作类型"),
      username: tool.schema.string().describe("用户名"),
      reason: tool.schema.string().optional().describe("原因描述"),
      attemptId: tool.schema.string().optional().describe("attempt ID (新链路可选)"),
    },
    async execute(args, context) {
      try {
        const worktree = context.worktree
        if ((args.action === "award" || args.action === "deduct") && args.attemptId) {
          const applied = await applyAttemptResult(worktree, args.attemptId)
          if (applied.status === "already_applied") {
            return `已处理过 attempt ${args.attemptId}`
          }
          if (applied.status === "profile_missing" || applied.status === "invalid_state" || !applied.attempt?.apply) {
            return `Error: attempt ${args.attemptId} 当前无法结算积分`
          }
          const delta = applied.attempt.apply.pointsChange
          return `${delta >= 0 ? "+" : ""}${delta}积分 | attemptId=${args.attemptId} | profileVersion=${applied.attempt.apply.profileVersion ?? "unknown"}`
        }
        const profile = loadProfileByName(worktree, args.username)
        if (!profile) return `Error: 用户 ${args.username} 不存在`

        switch (args.action) {
          case "award": {
            const oldLevel = profile.level
            profile.points += POINTS_CORRECT
            profile.streak.current++
            if (profile.streak.current > profile.streak.best) {
              profile.streak.best = profile.streak.current
            }
            profile.level = calcLevel(profile.points)
            saveProfile(worktree, profile)
            const levelUp = profile.level > oldLevel ? ` 恭喜升级到 Lv.${profile.level}！` : ""
            const praises = ["漂亮！继续保持！", "太棒了！", "正确！思路很清晰！", "厉害！这题不简单！", "完美！"]
            const praise = praises[Math.floor(Math.random() * praises.length)]
            return `+${POINTS_CORRECT}积分 (${praise})${levelUp} 当前: ${profile.points}分 Lv.${profile.level}`
          }
          case "deduct": {
            const oldLevel = profile.level
            profile.points = Math.max(0, profile.points - POINTS_WRONG)
            profile.streak.current = 0
            profile.level = calcLevel(profile.points)
            saveProfile(worktree, profile)
            const levelDown = profile.level < oldLevel ? ` 等级降至 Lv.${profile.level}` : ""
            const criticisms = ["这道题还需要加强，来看看解析吧。", "别灰心，错题是最好的老师。", "记住这个知识点，下次就不会错了。"]
            const criticism = criticisms[Math.floor(Math.random() * criticisms.length)]
            return `-${POINTS_WRONG}积分 (${criticism})${levelDown} 当前: ${profile.points}分 Lv.${profile.level}`
          }
          case "getLevel": {
            const nextThreshold = LEVEL_THRESHOLDS[profile.level] || 9999
            const progress = profile.points - (LEVEL_THRESHOLDS[profile.level - 1] || 0)
            const needed = nextThreshold - (LEVEL_THRESHOLDS[profile.level - 1] || 0)
            return `Lv.${profile.level} | 积分: ${profile.points} | 下一级: ${nextThreshold}分 (进度: ${progress}/${needed}) | 连续正确: ${profile.streak.current} | 最佳连胜: ${profile.streak.best}`
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
