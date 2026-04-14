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

describe("end-to-end smoke", () => {
  it("runs the attempt-backed practice flow from profile creation to stats", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)

    const userProfileTool = plugin.tool?.["user-profile"]
    const timerTool = plugin.tool?.timer
    const gradingTool = plugin.tool?.grading
    const pointsTool = plugin.tool?.points

    const created = await userProfileTool!.execute({
      action: "loadOrCreate",
      username: "smoke-user",
      examTypes: ["guokao"],
      region: "重庆",
    }, { worktree, sessionID: "session-smoke" } as never)

    expect(created).toContain("创建成功")

    const started = await timerTool!.execute({
      action: "start",
      username: "smoke-user",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      questionId: "question-smoke",
      questionText: "题目: 某逻辑判断题\nA. 选项A\nB. 选项B\nC. 选项C\nD. 选项D\n正确答案: A\n解析: ...",
      correctAnswer: "A",
      timeout: 180,
    }, { worktree, sessionID: "session-smoke" } as never)

    const attemptId = /attemptId=([^\s|]+)/.exec(started)?.[1]
    const epoch = /epoch=([^\s|]+)/.exec(started)?.[1]

    expect(attemptId).toBeTruthy()
    expect(epoch).toBeTruthy()

    const stopped = await timerTool!.execute({
      action: "stop",
      expectedEpoch: Number(epoch),
    }, { worktree, sessionID: "session-smoke" } as never)

    const elapsed = Number(/^(\d+)/.exec(stopped)?.[1] ?? "0")
    expect(stopped).toContain(`attemptId=${attemptId}`)
    expect(elapsed).toBeGreaterThanOrEqual(0)

    const graded = await gradingTool!.execute({
      questionType: "objective",
      correctAnswer: "A",
      userAnswer: "A",
      attemptId,
      timeSeconds: elapsed,
    }, { worktree, sessionID: "session-smoke" } as never)

    const settled = await pointsTool!.execute({
      action: "award",
      username: "smoke-user",
      attemptId,
    }, { worktree, sessionID: "session-smoke" } as never)

    const stats = await userProfileTool!.execute({
      action: "getStats",
      username: "smoke-user",
    }, { worktree, sessionID: "session-smoke" } as never)

    expect(graded).toBe("correct")
    expect(settled).toContain("+10积分")
    expect(stats).toContain("判断推理")
    expect(stats).toContain("逻辑判断")
  })
})
