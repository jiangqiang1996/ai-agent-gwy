import { afterEach, describe, expect, it } from "vitest"

import { applyAttemptResult } from "../../plugins/coaching-tools/services/result-service.js"
import { loadAttemptRecord, saveAttemptRecord } from "../../plugins/coaching-tools/storage/attempt-repository.js"
import { saveProfileRecord } from "../../plugins/coaching-tools/storage/profile-repository.js"
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

describe("attempt apply transition guards", () => {
  it("refuses to re-enter apply when an attempt is already applying", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-1",
      name: "guarded-user",
      createdAt: "2026-01-02T03:04:05.000Z",
      points: 0,
      level: 1,
      streak: { current: 0, best: 0 },
      mastery: {},
      history: [],
      examTypes: [],
      region: null,
      studyPlan: null,
    })

    await saveAttemptRecord(worktree, {
      id: "attempt-guard",
      profileId: "profile-1",
      sessionId: "session-1",
      questionId: "question-1",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      state: "applying",
      questionPrompt: "prompt",
      questionText: null,
      correctAnswer: "A",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-02T03:04:05.000Z",
      timer: null,
      apply: {
        status: "applying",
        pointsChange: 0,
        historyId: null,
        profileVersion: null,
        delta: null,
        updatedAt: "2026-01-02T03:04:10.000Z",
      },
      evaluation: {
        questionType: "objective",
        correct: true,
        timeSeconds: 18,
        gradedAt: "2026-01-02T03:04:25.000Z",
      },
    })

    const result = await applyAttemptResult(worktree, "attempt-guard")
    const attempt = loadAttemptRecord(worktree, "attempt-guard")

    expect(result.status).toBe("invalid_state")
    expect(attempt?.apply?.status).toBe("applying")
  })
})
