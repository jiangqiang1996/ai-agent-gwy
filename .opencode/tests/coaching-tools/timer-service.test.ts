import { afterEach, describe, expect, it } from "vitest"

import { registerGeneratedQuestion } from "../../plugins/coaching-tools/services/practice-service.js"
import { activateAttemptTimer, abandonAttempt, getTimerStatus, stopAttemptTimer, switchSessionProfile } from "../../plugins/coaching-tools/services/timer-service.js"
import { saveSessionPointer } from "../../plugins/coaching-tools/storage/session-pointer-repository.js"
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

describe("timer service", () => {
  it("activates a registered attempt and binds timer state to attempt + profile", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-1",
      name: "timer-user",
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
      subject: "言语理解与表达",
      leafTopic: "片段阅读",
      teacherPrompt: "prompt",
      correctAnswer: "A",
    })

    const active = await activateAttemptTimer(worktree, {
      attemptId: registered.attempt!.id,
      profileId: "profile-1",
      sessionId: "session-1",
      timeoutSeconds: 180,
      now: "2026-01-02T03:04:05.000Z",
    })

    expect(active.status).toBe("active")
    expect(active.epoch).toBe(1)
    expect(active.attempt?.state).toBe("active")
  })

  it("rejects stale session epochs after user switch", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-1",
      name: "timer-user",
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
    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-2",
      name: "switched-user",
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
      subject: "判断推理",
      leafTopic: "逻辑判断",
      teacherPrompt: "prompt",
      correctAnswer: "A",
    })
    const active = await activateAttemptTimer(worktree, {
      attemptId: registered.attempt!.id,
      profileId: "profile-1",
      sessionId: "session-1",
      timeoutSeconds: 180,
      now: "2026-01-02T03:04:05.000Z",
    })

    await switchSessionProfile(worktree, {
      sessionId: "session-1",
      profileId: "profile-2",
      now: "2026-01-02T03:05:00.000Z",
    })

    const status = await getTimerStatus(worktree, {
      sessionId: "session-1",
      expectedEpoch: active.epoch!,
      now: "2026-01-02T03:05:10.000Z",
    })

    expect(status.status).toBe("stale_session")
  })

  it("marks expired active attempts as timed out during recovery", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-1",
      name: "timer-user",
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
      subject: "数量关系",
      leafTopic: "数学运算",
      teacherPrompt: "prompt",
      correctAnswer: "D",
    })

    const active = await activateAttemptTimer(worktree, {
      attemptId: registered.attempt!.id,
      profileId: "profile-1",
      sessionId: "session-1",
      timeoutSeconds: 10,
      now: "2026-01-02T03:04:05.000Z",
    })

    const status = await getTimerStatus(worktree, {
      sessionId: "session-1",
      expectedEpoch: active.epoch!,
      now: "2026-01-02T03:04:20.000Z",
    })

    expect(status.status).toBe("timed_out")
    expect(status.attempt?.state).toBe("timed_out")
  })

  it("treats abandoned attempts as inactive timer sessions", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-1",
      name: "timer-user",
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
      subject: "常识判断",
      leafTopic: "法律",
      teacherPrompt: "prompt",
      correctAnswer: "A",
    })
    const active = await activateAttemptTimer(worktree, {
      attemptId: registered.attempt!.id,
      profileId: "profile-1",
      sessionId: "session-1",
      timeoutSeconds: 180,
      now: "2026-01-02T03:04:05.000Z",
    })

    const abandoned = await abandonAttempt(worktree, {
      sessionId: "session-1",
      expectedEpoch: active.epoch!,
      now: "2026-01-02T03:05:00.000Z",
    })
    const status = await getTimerStatus(worktree, {
      sessionId: "session-1",
      expectedEpoch: active.epoch!,
      now: "2026-01-02T03:05:10.000Z",
    })
    const stopped = await stopAttemptTimer(worktree, {
      sessionId: "session-1",
      expectedEpoch: active.epoch!,
      now: "2026-01-02T03:05:20.000Z",
    })

    expect(abandoned.status).toBe("abandoned")
    expect(status.status).toBe("inactive")
    expect(stopped.status).toBe("inactive")
  })

  it("rejects session pointers that target another profile's attempt", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-1",
      name: "timer-user",
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
    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-2",
      name: "other-user",
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
      subject: "数量关系",
      leafTopic: "数学运算",
      teacherPrompt: "prompt",
      correctAnswer: "A",
    })
    const active = await activateAttemptTimer(worktree, {
      attemptId: registered.attempt!.id,
      profileId: "profile-1",
      sessionId: "session-1",
      timeoutSeconds: 180,
      now: "2026-01-02T03:04:05.000Z",
    })

    await saveSessionPointer(worktree, {
      sessionId: "session-1",
      profileId: "profile-2",
      attemptId: active.attempt!.id,
      epoch: active.epoch!,
      updatedAt: "2026-01-02T03:05:00.000Z",
    })

    const status = await getTimerStatus(worktree, {
      sessionId: "session-1",
      expectedEpoch: active.epoch!,
      now: "2026-01-02T03:05:10.000Z",
    })

    expect(status.status).toBe("stale_session")
  })

  it("serializes attempt registration so only one active question exists per profile", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      profileVersion: 0,
      id: "profile-1",
      name: "single-active-user",
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

    const [first, second] = await Promise.all([
      registerGeneratedQuestion(worktree, {
        profileId: "profile-1",
        sessionId: "session-1",
        questionId: "question-1",
        subject: "判断推理",
        leafTopic: "逻辑判断",
        teacherPrompt: "prompt-1",
        correctAnswer: "A",
      }),
      registerGeneratedQuestion(worktree, {
        profileId: "profile-1",
        sessionId: "session-1",
        questionId: "question-2",
        subject: "判断推理",
        leafTopic: "定义判断",
        teacherPrompt: "prompt-2",
        correctAnswer: "B",
      }),
    ])

    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual(["blocked", "registered"])
  })
})
