import { afterEach, describe, expect, it } from "vitest"

import { recordAttemptAnswer, registerGeneratedQuestion } from "../../plugins/coaching-tools/services/practice-service.js"
import { loadAttemptRecord } from "../../plugins/coaching-tools/storage/attempt-repository.js"
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

describe("practice service", () => {
  it("registers generated questions as non-score-bearing registered attempts", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-1",
      name: "practice-user",
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

    const first = await registerGeneratedQuestion(worktree, {
      profileId: "profile-1",
      sessionId: "session-1",
      questionId: "question-1",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      teacherPrompt: "prompt",
      correctAnswer: "A",
    })
    const second = await registerGeneratedQuestion(worktree, {
      profileId: "profile-1",
      sessionId: "session-1",
      questionId: "question-2",
      subject: "判断推理",
      leafTopic: "逻辑判断",
      teacherPrompt: "prompt",
      correctAnswer: "B",
    })

    expect(first.status).toBe("registered")
    expect(first.attempt?.state).toBe("registered")
    expect(second.status).toBe("blocked")
  })

  it("accepts zero-second answers as valid answered attempts", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-1",
      name: "practice-user",
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

    const registered = await registerGeneratedQuestion(worktree, {
      profileId: "profile-1",
      sessionId: "session-1",
      questionId: "question-1",
      subject: "资料分析",
      leafTopic: "资料分析",
      teacherPrompt: "prompt",
      correctAnswer: "C",
    })

    const answered = await recordAttemptAnswer(worktree, {
      attemptId: registered.attempt!.id,
      profileId: "profile-1",
      answerText: "C",
      timeSeconds: 0,
    })

    expect(answered.status).toBe("answered")
    expect(loadAttemptRecord(worktree, registered.attempt!.id)?.evaluation?.timeSeconds).toBe(0)
  })
})
