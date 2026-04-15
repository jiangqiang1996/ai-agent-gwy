import { tool } from "@opencode-ai/plugin"

import { REGIONS } from "../shared/constants.js"
import { formatExamTypes, normalizeExamTypes } from "../shared/formatters.js"
import { checkNameAvailability, createProfile, loadProfile, overwriteProfile, saveStudyPlanForProfile, updateProfileDetails } from "../services/profile-service.js"
import { switchSessionProfile } from "../services/session-service.js"

export function createUserProfileTool() {
  return tool({
    description: "用户档案管理。操作: checkName(检查名字是否已存在), loadOrCreate(加载或创建用户), getStats(获取用户档案信息), updateProfile(更新资料), saveStudyPlan(保存学习计划), overwrite(覆盖已有档案,不可恢复)。每次调用必须传 username 参数。重要流程: 用户报名字后必须先调用 checkName 检查名字是否已被使用，如果已存在则提醒用户选择: 1.加载已有档案 2.换个名字 3.覆盖(调用 overwrite)。checkName 返回可用后才能调用 loadOrCreate。",
    args: {
      action: tool.schema.enum(["checkName", "loadOrCreate", "getStats", "updateProfile", "saveStudyPlan", "overwrite"]).describe("操作类型"),
      username: tool.schema.string().describe("用户名"),
      examTypes: tool.schema.array(tool.schema.string()).optional().describe("考试类型数组 (loadOrCreate/updateProfile 时可选)"),
      region: tool.schema.string().optional().describe("地区/省份 (loadOrCreate/updateProfile 时可选)"),
      identity: tool.schema.enum(["working", "campus", "unset"]).optional().describe("身份 (working=在职, campus=应届生, unset=清空)"),
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
              return `名字 "${args.username}" 已存在（考试类型: ${formatExamTypes(existing.examTypes)}，地区: ${existing.region || "未设置"}）。请让用户选择：\n1. 这是我的账号 → 确认后调用 loadOrCreate 加载已有档案\n2. 换一个新名字 → 用户重新报名字后再 checkName\n3. 覆盖原有账号 → 提醒用户这是不可恢复的操作，确认后调用 overwrite 覆盖`
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
                identity: args.identity === "unset" ? null : args.identity,
              })
              if (created.status !== "created" || !created.profile) {
                return `Error: 无法创建用户 ${args.username}`
              }
              const profile = created.profile
              await switchSessionProfile(worktree, {
                sessionId: context.sessionID,
                profileId: profile.id,
              })
              return `新用户 ${args.username} 创建成功。ID: ${profile.id}, 身份: ${profile.identity === "working" ? "在职" : profile.identity === "campus" ? "应届生" : "未设置"}, 考试类型: ${formatExamTypes(profile.examTypes)}, 地区: ${profile.region || "未设置"}`
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
            return `欢迎回来，${profile.name}！身份: ${profile.identity === "working" ? "在职" : profile.identity === "campus" ? "应届生" : "未设置"}, 考试类型: ${formatExamTypes(profile.examTypes)}, 地区: ${profile.region || "未设置"}`
          }
          case "getStats": {
            const loaded = await loadProfile(worktree, args.username)
            if (loaded.status === "not_found") return `Error: 用户 ${args.username} 不存在`
            if (loaded.status === "blocked") return `Error: 用户 ${args.username} 当前处于冲突/修复状态`
            if (!loaded.profile) return `Error: 用户 ${args.username} 档案数据异常`
            const profile = loaded.profile
            const lines: string[] = []
            lines.push(`=== ${profile.name} 的学习数据 ===`)
            lines.push(`身份: ${profile.identity === "working" ? "在职" : profile.identity === "campus" ? "应届生" : "未设置"}`)
            lines.push("")
            lines.push(`考试类型: ${formatExamTypes(profile.examTypes)} | 地区: ${profile.region || "未设置"}`)
            if (profile.studyPlan) {
              lines.push(`学习计划: 已保存 (${new Date(profile.studyPlan.createdAt).toLocaleDateString("zh-CN")})`)
            }
            return lines.join("\n")
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
              identity: args.identity === "unset" ? null : args.identity,
            })
            if (updated.status === "not_found") return `Error: 用户 ${args.username} 不存在`
            if (updated.status === "conflict" || updated.status === "blocked") return `Error: ${updated.reason}`
            if (!updated.changes || updated.changes.length === 0) return "未提供任何需要更新的字段"
            if (!updated.profile) return `Error: 用户 ${args.username} 档案数据异常`
            if (args.newName && args.newName.trim()) {
              await switchSessionProfile(worktree, {
                sessionId: context.sessionID,
                profileId: updated.profile.id,
              })
            }
            const profile = updated.profile
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
              identity: args.identity === "unset" ? null : args.identity,
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
            return `已覆盖用户 "${args.username}" 的旧档案。新档案已创建。`
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
