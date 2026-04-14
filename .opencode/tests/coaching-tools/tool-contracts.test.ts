import { afterEach, describe, expect, it } from "vitest"

import { CoachingPlugin } from "../../plugins/coaching-tools.js"
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
  })

  it("supports the structured timer start path and returns attempt metadata", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]
    const timerTool = plugin.tool?.timer

    await userProfileTool!.execute({ action: "loadOrCreate", username: "timer-user" }, { worktree, sessionID: "session-1" } as never)

    const started = await timerTool!.execute({
      action: "start",
      username: "timer-user",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      questionId: "question-1",
      questionText: "题目: ... 正确答案: A",
      correctAnswer: "A",
      timeout: 180,
    }, { worktree, sessionID: "session-1" } as never)

    expect(started).toContain("attemptId=")
    expect(started).toContain("epoch=")
  })

  it("rejects the legacy in-memory timer fallback contract", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const timerTool = plugin.tool?.timer

    const started = await timerTool!.execute({
      action: "start",
      questionId: "legacy-question",
      timeout: 60,
    }, { worktree, sessionID: "session-legacy" } as never)

    expect(started).toContain("durable attempt 流程")
  })

  it("supports the new attempt-backed grading and points settlement path", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]
    const timerTool = plugin.tool?.timer
    const gradingTool = plugin.tool?.grading
    const pointsTool = plugin.tool?.points

    await userProfileTool!.execute({ action: "loadOrCreate", username: "settlement-user" }, { worktree, sessionID: "session-2" } as never)

    const started = await timerTool!.execute({
      action: "start",
      username: "settlement-user",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      questionId: "question-2",
      questionText: "题目: ... 正确答案: A",
      correctAnswer: "A",
      timeout: 180,
    }, { worktree, sessionID: "session-2" } as never)

    const attemptId = /attemptId=([^\s|]+)/.exec(started)?.[1]
    expect(attemptId).toBeTruthy()

    const graded = await gradingTool!.execute({
      questionType: "objective",
      correctAnswer: "A",
      userAnswer: "A",
      attemptId,
      timeSeconds: 12,
    }, { worktree, sessionID: "session-2" } as never)

    const settled = await pointsTool!.execute({
      action: "award",
      username: "settlement-user",
      attemptId,
    }, { worktree, sessionID: "session-2" } as never)

    expect(graded).toBe("correct")
    expect(settled).toContain("+10积分")
    expect(settled).toContain(`attemptId=${attemptId}`)
  })

  it("invalidates the previous user's timer session when a new profile is loaded", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]
    const timerTool = plugin.tool?.timer

    await userProfileTool!.execute({ action: "loadOrCreate", username: "first-user" }, { worktree, sessionID: "session-switch" } as never)
    const started = await timerTool!.execute({
      action: "start",
      username: "first-user",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      questionId: "question-switch",
      questionText: "题目: ... 正确答案: A",
      correctAnswer: "A",
      timeout: 180,
    }, { worktree, sessionID: "session-switch" } as never)

    const oldEpoch = Number(/epoch=([^\s|]+)/.exec(started)?.[1] ?? "0")
    expect(oldEpoch).toBeGreaterThan(0)

    await userProfileTool!.execute({ action: "loadOrCreate", username: "second-user" }, { worktree, sessionID: "session-switch" } as never)

    const status = await timerTool!.execute({
      action: "status",
      expectedEpoch: oldEpoch,
    }, { worktree, sessionID: "session-switch" } as never)

    expect(status).toContain("当前会话已切换用户或题目")
  })

  it("returns an error when grading an attempt that can no longer transition", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]
    const timerTool = plugin.tool?.timer
    const gradingTool = plugin.tool?.grading

    await userProfileTool!.execute({ action: "loadOrCreate", username: "grading-user" }, { worktree, sessionID: "session-grade" } as never)
    const started = await timerTool!.execute({
      action: "start",
      username: "grading-user",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      questionId: "question-grade",
      questionText: "题目: ... 正确答案: A",
      correctAnswer: "A",
      timeout: 180,
    }, { worktree, sessionID: "session-grade" } as never)

    const attemptId = /attemptId=([^\s|]+)/.exec(started)?.[1]
    expect(attemptId).toBeTruthy()

    await timerTool!.execute({ action: "abandon" }, { worktree, sessionID: "session-grade" } as never)

    const graded = await gradingTool!.execute({
      questionType: "objective",
      correctAnswer: "A",
      userAnswer: "A",
      attemptId,
      timeSeconds: 3,
    }, { worktree, sessionID: "session-grade" } as never)

    expect(graded).toContain("当前无法判题")
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

  it("rejects deprecated direct mastery writes from the public tool", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)
    const userProfileTool = plugin.tool?.["user-profile"]

    await userProfileTool!.execute({ action: "loadOrCreate", username: "mastery-user" }, { worktree, sessionID: "session-mastery" } as never)

    const result = await userProfileTool!.execute({
      action: "updateMastery",
      username: "mastery-user",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      correct: true,
      timeSeconds: 12,
    }, { worktree, sessionID: "session-mastery" } as never)

    expect(result).toContain("updateMastery 已停用")
  })
})
