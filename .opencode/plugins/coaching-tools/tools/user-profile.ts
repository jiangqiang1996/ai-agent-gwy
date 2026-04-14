import { tool } from "@opencode-ai/plugin"

import { REGIONS } from "../shared/constants.js"
import { formatExamTypes, normalizeExamTypes } from "../shared/formatters.js"
import { checkNameAvailability, createProfile, loadProfile, overwriteProfile, saveStudyPlanForProfile, updateProfileDetails } from "../services/profile-service.js"
import { switchSessionProfile } from "../services/timer-service.js"
import { loadProfileByName } from "../runtime/profile-helpers.js"

export function createUserProfileTool() {
  return tool({
    description: "用户档案管理。操作: checkName(检查名字是否已存在), loadOrCreate(加载或创建用户), getStats(获取学习统计), updateMastery(更新答题记录), updateProfile(更新资料), saveStudyPlan(保存学习计划), overwrite(覆盖已有用户档案,不可恢复)。每次调用必须传 username 参数。重要流程: 用户报名字后必须先调用 checkName 检查名字是否已被使用，如果已存在则提醒用户选择: 1.加载已有档案 2.换个名字 3.覆盖(调用 overwrite)。checkName 返回可用后才能调用 loadOrCreate。",
    args: {
      action: tool.schema.enum(["checkName", "loadOrCreate", "getStats", "updateMastery", "updateProfile", "saveStudyPlan", "overwrite"]).describe("操作类型"),
      username: tool.schema.string().describe("用户名"),
      subject: tool.schema.string().optional().describe("科目 (updateMastery 时必填)"),
      leafTopic: tool.schema.string().optional().describe("叶子题型 (updateMastery 时可选)"),
      correct: tool.schema.boolean().optional().describe("是否正确 (updateMastery 时必填)"),
      timeSeconds: tool.schema.number().optional().describe("答题耗时秒数 (updateMastery 时必填)"),
      examTypes: tool.schema.array(tool.schema.string()).optional().describe("考试类型数组 (loadOrCreate/updateProfile 时可选)"),
      region: tool.schema.string().optional().describe("地区/省份 (loadOrCreate/updateProfile 时可选)"),
      newName: tool.schema.string().optional().describe("新名字 (updateProfile 时可选)"),
      planContent: tool.schema.string().optional().describe("学习计划内容 (saveStudyPlan 时必填)"),
    },
    async execute(args, context) {
      try {
        const worktree = context.worktree
        switch (args.action) {
          case "checkName": {
            const availability = await checkNameAvailability(worktree, args.username)
            if (availability.status === "existing" && availability.profile) {
              const existing = availability.profile
              return `名字 "${args.username}" 已存在（Lv.${existing.level}，${existing.points}积分，${existing.history.length}条答题记录）。请让用户选择：\n1. 这是我的账号 → 确认后调用 loadOrCreate 加载已有档案\n2. 换一个新名字 → 用户重新报名字后再 checkName\n3. 覆盖原有账号 → 提醒用户这是不可恢复的操作，确认后可调用 loadOrCreate 覆盖`
            }
            if (availability.status === "blocked") {
              return `名字 "${args.username}" 当前处于修复/冲突状态，暂时不能直接创建或加载。请先让用户确认是否需要修复旧档案。`
            }
            return `名字 "${args.username}" 未被使用，可以安全创建新用户。`
          }
          case "loadOrCreate": {
            const availability = await checkNameAvailability(worktree, args.username)
            if (availability.status === "available") {
              const created = await createProfile(worktree, {
                username: args.username,
                examTypes: args.examTypes,
                region: args.region,
              })
              if (created.status !== "created" || !created.profile) {
                return `Error: 无法创建用户 ${args.username}`
              }
              const profile = created.profile
              await switchSessionProfile(worktree, {
                sessionId: context.sessionID,
                profileId: profile.id,
              })
              return `新用户 ${args.username} 创建成功。ID: ${profile.id}, 积分: 0, 等级: 1, 考试类型: ${formatExamTypes(profile.examTypes)}, 地区: ${profile.region || "未设置"}`
            }
            if (availability.status === "blocked") {
              return `Error: 用户 ${args.username} 当前处于冲突/修复状态，不能直接 loadOrCreate`
            }
            const loaded = await loadProfile(worktree, args.username)
            if (loaded.status !== "loaded" || !loaded.profile) {
              return `Error: 用户 ${args.username} 不存在`
            }
            const profile = loaded.profile
            await switchSessionProfile(worktree, {
              sessionId: context.sessionID,
              profileId: profile.id,
            })
            const totalQ = profile.history.length
            const totalCorrect = profile.history.filter(entry => entry.correct).length
            const accuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0
            return `欢迎回来，${profile.name}！等级: Lv.${profile.level}, 积分: ${profile.points}, 已答题: ${totalQ}题, 正确率: ${accuracy}%, 连续正确: ${profile.streak.current}题, 考试类型: ${formatExamTypes(profile.examTypes)}, 地区: ${profile.region || "未设置"}`
          }
          case "getStats": {
            const profile = loadProfileByName(worktree, args.username)
            if (!profile) return `Error: 用户 ${args.username} 不存在`
            const lines: string[] = []
            lines.push(`=== ${profile.name} 的学习数据 ===`)
            lines.push(`积分: ${profile.points} | 等级: Lv.${profile.level} | 连续正确: ${profile.streak.current} (最佳: ${profile.streak.best})`)
            lines.push("")
            for (const [subject, data] of Object.entries(profile.mastery)) {
              const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0
              const sampleNote = data.total < 5 ? " [样本不足]" : ""
              lines.push(`【${subject}】${data.total}题, 正确率 ${accuracy}%${sampleNote}, 平均 ${data.avgTimeSeconds}s`)
              for (const [leafTopic, leafData] of Object.entries(data.leafTopics || {})) {
                const leafAccuracy = leafData.total > 0 ? Math.round((leafData.correct / leafData.total) * 100) : 0
                const leafNote = leafData.total < 5 ? " [样本不足]" : ""
                lines.push(`  - ${leafTopic}: ${leafData.total}题, ${leafAccuracy}%${leafNote}, 平均 ${leafData.avgTimeSeconds}s`)
              }
            }
            lines.push(`考试类型: ${formatExamTypes(profile.examTypes)} | 地区: ${profile.region || "未设置"}`)
            if (profile.studyPlan) {
              lines.push(`学习计划: 已保存 (${new Date(profile.studyPlan.createdAt).toLocaleDateString("zh-CN")})`)
            }
            return lines.join("\n")
          }
          case "updateMastery": {
            if (!args.subject || args.correct === undefined || args.timeSeconds === undefined) {
              return "Error: updateMastery 需要 subject, correct, timeSeconds 参数"
            }
            return "Error: updateMastery 已停用。请改走 timer -> grading -> points 的 attempt-backed 流程，避免重复写入 mastery/history"
          }
          case "saveStudyPlan": {
            if (!args.planContent) return "Error: saveStudyPlan 需要 planContent 参数"
            const saved = await saveStudyPlanForProfile(worktree, args.username, args.planContent)
            if (saved.status !== "saved") return `Error: 用户 ${args.username} 不存在`
            return `学习计划已保存 (${new Date().toLocaleDateString("zh-CN")})`
          }
          case "updateProfile": {
            if (args.region !== undefined && args.region !== "" && !REGIONS.includes(args.region)) {
              return `Error: 无效地区 "${args.region}"。可选: ${REGIONS.join("、")}`
            }
            const updated = await updateProfileDetails(worktree, {
              username: args.username,
              newName: args.newName,
              examTypes: args.examTypes !== undefined ? (Array.isArray(args.examTypes) ? normalizeExamTypes(args.examTypes) : []) : undefined,
              region: args.region,
            })
            if (updated.status === "not_found") return `Error: 用户 ${args.username} 不存在`
            if (updated.status === "conflict" || updated.status === "blocked") return `Error: ${updated.reason}`
            if (!updated.changes || updated.changes.length === 0) return "未提供任何需要更新的字段"
            if (updated.profile && args.newName && args.newName.trim()) {
              await switchSessionProfile(worktree, {
                sessionId: context.sessionID,
                profileId: updated.profile.id,
              })
            }
            const profile = updated.profile!
            const changes = updated.changes.map(change => {
              if (change.startsWith("考试类型→")) return `考试类型→${formatExamTypes(profile.examTypes)}`
              if (change === "地区→未设置") return change
              return change
            })
            return `资料已更新: ${changes.join(", ")}`
          }
          case "overwrite": {
            const overwritten = await overwriteProfile(worktree, {
              username: args.username,
              examTypes: args.examTypes,
              region: args.region,
            })
            if (overwritten.status === "not_found") {
              return `Error: 用户 "${args.username}" 不存在，无法覆盖。请直接使用 loadOrCreate 创建。`
            }
            if (overwritten.status === "blocked") {
              return `Error: 用户 "${args.username}" 当前处于冲突/修复状态，暂时不能覆盖。`
            }
            if (overwritten.profile) {
              await switchSessionProfile(worktree, {
                sessionId: context.sessionID,
                profileId: overwritten.profile.id,
              })
            }
            return `已覆盖用户 "${args.username}" 的旧档案。新档案已创建，积分重置为 0。`
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
