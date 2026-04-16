import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { CoachingPlugin } from "../../plugins/coaching-tools.js"
import { saveNameClaim } from "../../plugins/coaching-tools/storage/identity-index-repository.js"
import { cleanupTempWorktree, createTempWorktree } from "../setup/temp-worktree.js"

const worktrees: string[] = []

afterEach(async () => {
  while (worktrees.length > 0) {
    const worktree = worktrees.pop()
    if (worktree) await cleanupTempWorktree(worktree)
  }
})

async function withWorktree(): Promise<string> {
  const worktree = await createTempWorktree()
  worktrees.push(worktree)
  return worktree
}

describe("tool contracts", () => {
  it("supports the explicit create/load profile contract through the public tool", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    expect(userProfileTool).toBeDefined()

    const available = await userProfileTool!.execute({ action: "checkName", username: "adapter-user" }, { worktree, sessionID: "session-1" } as never)
    const created = await userProfileTool!.execute({ action: "loadOrCreate", username: "adapter-user", examTypes: ["guokao"] }, { worktree, sessionID: "session-1" } as never)
    const loaded = await userProfileTool!.execute({ action: "loadOrCreate", username: "adapter-user" }, { worktree, sessionID: "session-1" } as never)

    expect(available).toContain("未被使用")
    expect(created).toContain("创建成功")
    expect(loaded).toContain("欢迎回来")
    expect(created).not.toContain("积分")
    expect(created).not.toContain("等级")
    expect(loaded).not.toContain("积分")
    expect(loaded).not.toContain("等级")
  })

  it("returns a structured classic-example template from question-generator", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]
    const questionGeneratorTool = plugin.tool?.["question-generator"]

    await userProfileTool!.execute({ action: "loadOrCreate", username: "timer-user" }, { worktree, sessionID: "session-1" } as never)

    const generated = await questionGeneratorTool!.execute({
      username: "timer-user",
      subject: "判断推理",
      leafTopic: "逻辑判断",
    }, { worktree, sessionID: "session-1" } as never)

    const payload = JSON.parse(generated) as { subject: string; leafTopic: string; teacherPrompt: string }

    expect(payload.subject).toBe("判断推理")
    expect(payload.leafTopic).toBe("逻辑判断")
    expect(payload.teacherPrompt).toContain("代表性经典例题")
  })

  it("does not read blocked profiles through question-generator", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const questionGeneratorTool = plugin.tool?.["question-generator"]

    await saveNameClaim(worktree, {
      displayName: "blocked-user",
      state: "blocked",
      profileId: null,
      reason: "duplicate identity under repair",
      updatedAt: "2026-01-02T03:04:05.000Z",
    })

    const result = await questionGeneratorTool!.execute({
      username: "blocked-user",
    }, { worktree, sessionID: "session-blocked" } as never)

    expect(result).toContain("冲突/修复状态")
  })

  it("allows explicit question-generator context even when the saved profile is blocked", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const questionGeneratorTool = plugin.tool?.["question-generator"]

    await saveNameClaim(worktree, {
      displayName: "blocked-explicit-user",
      state: "blocked",
      profileId: null,
      reason: "duplicate identity under repair",
      updatedAt: "2026-01-02T03:04:05.000Z",
    })

    const generated = await questionGeneratorTool!.execute({
      username: "blocked-explicit-user",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      examTypes: ["guokao"],
    }, { worktree, sessionID: "session-blocked-explicit" } as never)

    const payload = JSON.parse(generated) as { subject: string; leafTopic: string; teacherPrompt: string }

    expect(payload.subject).toBe("判断推理")
    expect(payload.leafTopic).toBe("逻辑判断")
    expect(payload.teacherPrompt).toContain("经典例题")
  })

  it("falls back to the saved profile exam context when question-generator args omit it", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]
    const questionGeneratorTool = plugin.tool?.["question-generator"]
    const originalRandom = Math.random

    await userProfileTool!.execute({
      action: "loadOrCreate",
      username: "context-user",
      examTypes: ["shengkao"],
      region: "广东",
    }, { worktree, sessionID: "session-context" } as never)

    Math.random = () => 0.99
    try {
      const generated = await questionGeneratorTool!.execute({
        username: "context-user",
      }, { worktree, sessionID: "session-context" } as never)

      const payload = JSON.parse(generated) as { subject: string }
      expect(payload.subject).toBe("科学推理")
    } finally {
      Math.random = originalRandom
    }
  })

  it("does not expose 广东 special subjects without 广东 region context", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]
    const questionGeneratorTool = plugin.tool?.["question-generator"]
    const originalRandom = Math.random

    await userProfileTool!.execute({
      action: "loadOrCreate",
      username: "default-subject-user",
      examTypes: ["shengkao"],
      region: "四川",
    }, { worktree, sessionID: "session-default-subject" } as never)

    Math.random = () => 0.99
    try {
      const generated = await questionGeneratorTool!.execute({
        username: "default-subject-user",
      }, { worktree, sessionID: "session-default-subject" } as never)

      const payload = JSON.parse(generated) as { subject: string }
      expect(payload.subject).toBe("政治理论")
      expect(payload.subject).not.toBe("科学推理")
    } finally {
      Math.random = originalRandom
    }
  })

  it("supports the simplified grading contract without attempt state", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const gradingTool = plugin.tool?.grading

    const correct = await gradingTool!.execute({
      questionType: "objective",
      correctAnswer: "A",
      userAnswer: "A",
    }, { worktree, sessionID: "session-legacy" } as never)
    const subjective = await gradingTool!.execute({
      questionType: "subjective",
      correctAnswer: "参考答案",
      userAnswer: "主观作答",
    }, { worktree, sessionID: "session-legacy" } as never)

    expect(correct).toBe("correct")
    expect(subjective).toContain("subjective")
  })

  it("returns the expected wrong-answer marker for objective grading", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const gradingTool = plugin.tool?.grading

    const wrong = await gradingTool!.execute({
      questionType: "objective",
      correctAnswer: "B",
      userAnswer: "A",
    }, { worktree, sessionID: "session-wrong" } as never)

    expect(wrong).toBe("wrong|B")
  })

  it("exports documents through the public export tool", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const exportTool = plugin.tool?.["export-document"]

    const result = await exportTool!.execute({
      format: "markdown",
      title: "当前会话总结",
      content: "这是导出内容",
    }, { worktree, sessionID: "session-2" } as never)

    expect(result).toContain("已导出到 output/")
  })

  it("routes profile rename through the durable identity index", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    await userProfileTool!.execute({ action: "loadOrCreate", username: "rename-old" }, { worktree, sessionID: "session-rename" } as never)

    const updated = await userProfileTool!.execute({
      action: "updateProfile",
      username: "rename-old",
      newName: "rename-new",
    }, { worktree, sessionID: "session-rename" } as never)
    const loaded = await userProfileTool!.execute({ action: "loadOrCreate", username: "rename-new" }, { worktree, sessionID: "session-rename" } as never)

    expect(updated).toContain("资料已更新")
    expect(loaded).toContain("欢迎回来")
  })

  it("returns getStats through the safe profile-service path", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    await userProfileTool!.execute({
      action: "loadOrCreate",
      username: "stats-user",
      examTypes: ["shengkao"],
      region: "四川",
      identity: "working",
    }, { worktree, sessionID: "session-stats" } as never)

    const stats = await userProfileTool!.execute({
      action: "getStats",
      username: "stats-user",
    }, { worktree, sessionID: "session-stats" } as never)

    expect(stats).toContain("在职")
    expect(stats).toContain("省考")
    expect(stats).toContain("四川")
    expect(stats).not.toContain("积分")
    expect(stats).not.toContain("等级")
  })

  it("directs overwrite confirmations to the overwrite action", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    await userProfileTool!.execute({ action: "loadOrCreate", username: "existing-user" }, { worktree, sessionID: "session-overwrite" } as never)

    const checkName = await userProfileTool!.execute({ action: "checkName", username: "existing-user" }, { worktree, sessionID: "session-overwrite" } as never)

    expect(checkName).toContain("调用 overwrite 覆盖")
    expect(checkName).not.toContain("调用 loadOrCreate 覆盖")
  })

  it("returns error for getStats on non-existent user", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    const stats = await userProfileTool!.execute({
      action: "getStats",
      username: "nonexistent-user",
    }, { worktree, sessionID: "session-stats-err" } as never)

    expect(stats).toContain("Error")
    expect(stats).toContain("不存在")
  })

  it("returns error for getStats on blocked user", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    await saveNameClaim(worktree, {
      displayName: "blocked-stats",
      state: "blocked",
      profileId: null,
      reason: "duplicate identity under repair",
      updatedAt: "2026-01-02T03:04:05.000Z",
    })

    const stats = await userProfileTool!.execute({
      action: "getStats",
      username: "blocked-stats",
    }, { worktree, sessionID: "session-stats-blocked" } as never)

    expect(stats).toContain("Error")
    expect(stats).toContain("冲突/修复状态")
  })

  it("saves and displays a study plan through getStats", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    await userProfileTool!.execute({
      action: "loadOrCreate",
      username: "plan-user",
    }, { worktree, sessionID: "session-plan" } as never)

    const saved = await userProfileTool!.execute({
      action: "saveStudyPlan",
      username: "plan-user",
      planContent: "每天做10道言语题",
    }, { worktree, sessionID: "session-plan" } as never)

    expect(saved).toContain("学习计划已保存")

    const stats = await userProfileTool!.execute({
      action: "getStats",
      username: "plan-user",
    }, { worktree, sessionID: "session-plan" } as never)

    expect(stats).toContain("学习计划: 已保存")
  })

  it("requires planContent for saveStudyPlan", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    await userProfileTool!.execute({
      action: "loadOrCreate",
      username: "no-plan-user",
    }, { worktree, sessionID: "session-noplan" } as never)

    const result = await userProfileTool!.execute({
      action: "saveStudyPlan",
      username: "no-plan-user",
    }, { worktree, sessionID: "session-noplan" } as never)

    expect(result).toContain("Error")
    expect(result).toContain("planContent")
  })

  it("overwrites an existing profile and creates a fresh one", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    await userProfileTool!.execute({
      action: "loadOrCreate",
      username: "to-overwrite",
      examTypes: ["guokao"],
    }, { worktree, sessionID: "session-ow" } as never)

    const overwritten = await userProfileTool!.execute({
      action: "overwrite",
      username: "to-overwrite",
      examTypes: ["shengkao"],
      region: "广东",
    }, { worktree, sessionID: "session-ow" } as never)

    expect(overwritten).toContain("已覆盖")
  })

  it("returns error for overwrite on non-existent user", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    const result = await userProfileTool!.execute({
      action: "overwrite",
      username: "ghost-user",
    }, { worktree, sessionID: "session-ow-ghost" } as never)

    expect(result).toContain("Error")
    expect(result).toContain("不存在")
  })

  const PNG_1PX = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0p2iQAAAAASUVORK5CYII=",
    "base64",
  )

  it("exposes the inline-html-resources tool through the plugin", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const inlineTool = plugin.tool?.["inline-html-resources"]

    expect(inlineTool).toBeDefined()
    expect(typeof inlineTool!.execute).toBe("function")
  })

  it("inlines resources from an existing HTML file through the public tool", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const inlineTool = plugin.tool?.["inline-html-resources"]

    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })
    await mkdir(join(worktree, "assets"), { recursive: true })
    await writeFile(join(worktree, "assets", "img.png"), PNG_1PX)

    const imgPath = join(worktree, "assets", "img.png").replace(/\\/g, "/")
    const html = `<!doctype html><html><body><img src="${imgPath}"></body></html>`
    const htmlPath = join(outputDir, "inline-test.html")
    await writeFile(htmlPath, html, "utf8")

    const result = await inlineTool!.execute({
      htmlFilePath: htmlPath,
    }, { worktree, sessionID: "session-inline" } as never)

    expect(result).toContain("内联完成")
    expect(result).toContain("-inlined.html")
  })

  it("returns failure from inline-html-resources when a referenced file is missing", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const inlineTool = plugin.tool?.["inline-html-resources"]

    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const html = `<!doctype html><html><body><img src="missing.png"></body></html>`
    const htmlPath = join(outputDir, "fail-inline.html")
    await writeFile(htmlPath, html, "utf8")

    const result = await inlineTool!.execute({
      htmlFilePath: htmlPath,
    }, { worktree, sessionID: "session-inline-fail" } as never)

    expect(result).toContain("内联失败")
    expect(result).toContain("资源验证失败")
  })
})
