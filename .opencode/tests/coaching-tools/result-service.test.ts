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

describe("result service", () => {
  it("applies an evaluated attempt exactly once and records audit metadata", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      id: "profile-1",
      name: "scored-user",
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
      id: "attempt-1",
      profileId: "profile-1",
      sessionId: "session-1",
      questionId: "question-1",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      state: "evaluated",
      questionPrompt: "prompt",
      questionText: null,
      correctAnswer: "A",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-02T03:04:05.000Z",
      timer: null,
      apply: {
        status: "not_started",
        pointsChange: 0,
        historyId: null,
        profileVersion: null,
        delta: null,
        updatedAt: null,
      },
      evaluation: {
        questionType: "objective",
        correct: true,
        timeSeconds: 18,
        gradedAt: "2026-01-02T03:04:25.000Z",
      },
    })

    const first = await applyAttemptResult(worktree, "attempt-1")
    const second = await applyAttemptResult(worktree, "attempt-1")
    const attempt = loadAttemptRecord(worktree, "attempt-1")

    expect(first.status).toBe("applied")
    expect(second.status).toBe("already_applied")
    expect(attempt?.apply?.status).toBe("applied")
    expect(attempt?.apply?.pointsChange).toBe(10)
    expect(attempt?.apply?.profileVersion).toBe(1)
    expect(attempt?.apply?.delta).toMatchObject({ points: 10 })
  })

  it("recovers an attempt stuck in applying after the profile write already succeeded", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 1,
      id: "profile-1",
      name: "recover-user",
      createdAt: "2026-01-02T03:04:05.000Z",
      points: 10,
      level: 1,
      streak: { current: 1, best: 1 },
      mastery: {
        "判断推理": {
          total: 1,
          correct: 1,
          avgTimeSeconds: 18,
          leafTopics: {
            "逻辑判断": { total: 1, correct: 1, avgTimeSeconds: 18 },
          },
        },
      },
      history: [{
        id: "attempt-attempt-2",
        timestamp: "2026-01-02T03:04:25.000Z",
        subject: "判断推理",
        leafTopic: "逻辑判断",
        correct: true,
        timeSeconds: 18,
        pointsChange: 10,
      }],
      examTypes: [],
      region: null,
      studyPlan: null,
    })

    await saveAttemptRecord(worktree, {
      id: "attempt-2",
      profileId: "profile-1",
      sessionId: "session-1",
      questionId: "question-2",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      state: "applying",
      questionPrompt: "prompt",
      questionText: null,
      correctAnswer: "A",
      createdAt: "2026-01-02T03:04:05.000Z",
      updatedAt: "2026-01-02T03:04:25.000Z",
      timer: null,
      apply: {
        status: "applying",
        pointsChange: 10,
        historyId: "attempt-attempt-2",
        profileVersion: 1,
        delta: { points: 10, streakCurrent: 1, streakBest: 1 },
        updatedAt: "2026-01-02T03:04:25.000Z",
      },
      evaluation: {
        questionType: "objective",
        correct: true,
        timeSeconds: 18,
        gradedAt: "2026-01-02T03:04:25.000Z",
      },
    })

    const recovered = await applyAttemptResult(worktree, "attempt-2")
    const attempt = loadAttemptRecord(worktree, "attempt-2")

    expect(recovered.status).toBe("applied")
    expect(attempt?.state).toBe("applied")
    expect(attempt?.apply?.status).toBe("applied")
  })
})
