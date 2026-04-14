import { randomUUID } from "crypto"

import type { AttemptRecord } from "../shared/types.js"
import { listAttemptsByProfileId, loadAttemptRecord, saveAttemptRecord } from "../storage/attempt-repository.js"
import { loadProfileById } from "../storage/profile-repository.js"
import { enqueueWrite } from "../storage/write-queue.js"

function isScoreBearingState(state: AttemptRecord["state"]): boolean {
  return ["registered", "active", "answered", "evaluated", "applying", "pending_subjective_review"].includes(state)
}

export async function registerGeneratedQuestion(worktree: string, input: {
  profileId: string
  sessionId: string
  questionId: string
  subject: string
  leafTopic: string
  teacherPrompt: string
  correctAnswer: string
}): Promise<{
  status: "registered" | "blocked" | "profile_missing"
  attempt?: AttemptRecord
}> {
  const profile = await loadProfileById(worktree, input.profileId)
  if (!profile?.profile || profile.status !== "loaded") {
    return { status: "profile_missing" }
  }

  return enqueueWrite(`attempt-registration:${input.profileId}`, async () => {
    const activeAttempts = listAttemptsByProfileId(worktree, input.profileId).filter(attempt => isScoreBearingState(attempt.state))
    if (activeAttempts.length > 0) {
      return { status: "blocked" as const, attempt: activeAttempts[0] }
    }

    const now = new Date().toISOString()
    const attempt: AttemptRecord = {
      id: randomUUID(),
      profileId: input.profileId,
      sessionId: input.sessionId,
      questionId: input.questionId,
      subject: input.subject,
      leafTopic: input.leafTopic,
      state: "registered",
      questionPrompt: input.teacherPrompt,
      questionText: null,
      correctAnswer: input.correctAnswer,
      answerText: null,
      createdAt: now,
      updatedAt: now,
      timer: null,
      apply: {
        status: "not_started",
        pointsChange: 0,
        historyId: null,
        profileVersion: null,
        delta: null,
        updatedAt: null,
      },
      evaluation: null,
    }

    await saveAttemptRecord(worktree, attempt)
    return { status: "registered" as const, attempt }
  })
}

export async function recordAttemptAnswer(worktree: string, input: {
  attemptId: string
  profileId: string
  answerText: string
  timeSeconds: number
}): Promise<{
  status: "answered" | "invalid_state" | "profile_mismatch"
  attempt?: AttemptRecord
}> {
  const attempt = loadAttemptRecord(worktree, input.attemptId)
  if (!attempt) return { status: "invalid_state" }
  if (attempt.profileId !== input.profileId) return { status: "profile_mismatch", attempt }
  if (!["registered", "active"].includes(attempt.state)) return { status: "invalid_state", attempt }

  attempt.answerText = input.answerText
  attempt.state = "answered"
  attempt.updatedAt = new Date().toISOString()
  attempt.evaluation = {
    questionType: "objective",
    correct: null,
    timeSeconds: input.timeSeconds,
    gradedAt: null,
  }

  await saveAttemptRecord(worktree, attempt)
  return { status: "answered", attempt }
}

export async function gradeAttempt(worktree: string, input: {
  attemptId: string
  answerText: string
  questionType: "objective" | "subjective"
  correct: boolean | null
  timeSeconds: number
}): Promise<{
  status: "evaluated" | "pending_subjective_review" | "invalid_state"
  attempt?: AttemptRecord
}> {
  const attempt = loadAttemptRecord(worktree, input.attemptId)
  if (!attempt || !["registered", "active", "answered"].includes(attempt.state)) {
    return { status: "invalid_state", attempt: attempt ?? undefined }
  }

  attempt.answerText = input.answerText
  attempt.updatedAt = new Date().toISOString()
  attempt.evaluation = {
    questionType: input.questionType,
    correct: input.correct,
    timeSeconds: input.timeSeconds,
    gradedAt: new Date().toISOString(),
  }

  if (input.questionType === "subjective") {
    attempt.state = "pending_subjective_review"
    await saveAttemptRecord(worktree, attempt)
    return { status: "pending_subjective_review", attempt }
  }

  attempt.state = "evaluated"
  await saveAttemptRecord(worktree, attempt)
  return { status: "evaluated", attempt }
}
