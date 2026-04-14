import { afterEach, describe, expect, it } from "vitest"

import { listAttemptsByProfileId, loadAttemptRecord, saveAttemptRecord } from "../../plugins/coaching-tools/storage/attempt-repository.js"
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

describe("attempt repository", () => {
  it("persists attempts and reloads them by id", async () => {
    const worktree = await withWorktree()

    await saveAttemptRecord(worktree, {
      id: "attempt-1",
      profileId: "profile-1",
      sessionId: "session-1",
      questionId: "question-1",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      state: "registered",
      questionPrompt: "prompt",
      questionText: null,
      correctAnswer: "A",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-02T03:04:05.000Z",
      timer: null,
      apply: null,
    })

    expect(loadAttemptRecord(worktree, "attempt-1")?.profileId).toBe("profile-1")
  })

  it("lists attempts by immutable profile id", async () => {
    const worktree = await withWorktree()

    await saveAttemptRecord(worktree, {
      id: "attempt-a",
      profileId: "profile-a",
      sessionId: null,
      questionId: "question-a",
      subject: "资料分析",
      leafTopic: "资料分析",
      state: "active",
      questionPrompt: "prompt-a",
      questionText: null,
      correctAnswer: "B",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-02T03:04:05.000Z",
      timer: null,
      apply: null,
    })
    await saveAttemptRecord(worktree, {
      id: "attempt-b",
      profileId: "profile-b",
      sessionId: null,
      questionId: "question-b",
      subject: "言语理解与表达",
      leafTopic: "片段阅读",
      state: "answered",
      questionPrompt: "prompt-b",
      questionText: null,
      correctAnswer: "C",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-02T03:04:05.000Z",
      timer: null,
      apply: null,
    })

    const attempts = listAttemptsByProfileId(worktree, "profile-a")
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.id).toBe("attempt-a")
  })
})
