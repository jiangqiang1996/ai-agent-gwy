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
  it("runs the summary/example/export flow from profile creation to stats", async () => {
    const worktree = await withWorktree()
    const plugin = await CoachingPlugin({} as never)

    const userProfileTool = plugin.tool?.["user-profile"]
    const questionGeneratorTool = plugin.tool?.["question-generator"]
    const gradingTool = plugin.tool?.grading
    const exportTool = plugin.tool?.["export-document"]

    const created = await userProfileTool!.execute({
      action: "loadOrCreate",
      username: "smoke-user",
      examTypes: ["guokao"],
      region: "重庆",
      identity: "campus",
    }, { worktree, sessionID: "session-smoke" } as never)

    expect(created).toContain("创建成功")
    expect(created).toContain("应届生")

    const generated = await questionGeneratorTool!.execute({
      username: "smoke-user",
      subject: "判断推理",
      leafTopic: "逻辑判断",
    }, { worktree, sessionID: "session-smoke" } as never)

    const example = JSON.parse(generated) as { teacherPrompt: string }
    expect(example.teacherPrompt).toContain("经典例题")

    const graded = await gradingTool!.execute({
      questionType: "objective",
      correctAnswer: "A",
      userAnswer: "A",
    }, { worktree, sessionID: "session-smoke" } as never)

    const exported = await exportTool!.execute({
      format: "markdown",
      title: "判断推理总结",
      content: "知识点总结\n\n经典例题",
    }, { worktree, sessionID: "session-smoke" } as never)

    const stats = await userProfileTool!.execute({
      action: "getStats",
      username: "smoke-user",
    }, { worktree, sessionID: "session-smoke" } as never)

    expect(graded).toBe("correct")
    expect(exported).toContain("已导出到 output/")
    expect(stats).toContain("身份: 应届生")
  })
})
