import type { AttemptRecord } from "../shared/types.js"
import { loadAttemptRecord, saveAttemptRecord } from "../storage/attempt-repository.js"
import { loadSessionPointer, saveSessionPointer } from "../storage/session-pointer-repository.js"

type TimerLookupStatus = "active" | "timed_out" | "stale_session" | "not_found" | "inactive"

function toIso(now: string | undefined): string {
  return now ?? new Date().toISOString()
}

function computeExpiry(startedAt: string, timeoutSeconds: number): string {
  return new Date(Date.parse(startedAt) + timeoutSeconds * 1000).toISOString()
}

function isTimedOut(attempt: AttemptRecord, now: string): boolean {
  return Boolean(attempt.timer?.expiresAt && Date.parse(now) >= Date.parse(attempt.timer.expiresAt))
}

function isTerminalTimerState(state: AttemptRecord["state"]): boolean {
  return ["abandoned", "applied", "pending_subjective_review"].includes(state)
}

function loadAttemptForPointer(worktree: string, sessionId: string, expectedEpoch?: number): {
  status: TimerLookupStatus
  attempt?: AttemptRecord
  epoch?: number
} {
  const pointer = loadSessionPointer(worktree, sessionId)
  if (!pointer) return { status: "not_found" }
  if (expectedEpoch !== undefined && pointer.epoch !== expectedEpoch) {
    return { status: "stale_session", epoch: pointer.epoch }
  }
  if (!pointer.attemptId) return { status: "not_found", epoch: pointer.epoch }

  const attempt = loadAttemptRecord(worktree, pointer.attemptId)
  if (!attempt || !attempt.timer) return { status: "not_found", epoch: pointer.epoch }
  if (attempt.profileId !== pointer.profileId) {
    return { status: "stale_session", epoch: pointer.epoch }
  }
  if (isTerminalTimerState(attempt.state)) {
    return { status: "inactive", attempt, epoch: pointer.epoch }
  }

  return { status: attempt.state === "timed_out" ? "timed_out" : "active", attempt, epoch: pointer.epoch }
}

export async function activateAttemptTimer(worktree: string, input: {
  attemptId: string
  profileId: string
  sessionId: string
  timeoutSeconds: number
  now?: string
}): Promise<{
  status: "active" | "invalid_state" | "profile_mismatch"
  attempt?: AttemptRecord
  epoch?: number
}> {
  const attempt = loadAttemptRecord(worktree, input.attemptId)
  if (!attempt || attempt.state !== "registered") return { status: "invalid_state", attempt: attempt ?? undefined }
  if (attempt.profileId !== input.profileId) return { status: "profile_mismatch", attempt }

  const now = toIso(input.now)
  const previousPointer = loadSessionPointer(worktree, input.sessionId)
  const epoch = (previousPointer?.epoch ?? 0) + 1

  attempt.state = "active"
  attempt.updatedAt = now
  attempt.timer = {
    startedAt: now,
    timeoutSeconds: input.timeoutSeconds,
    expiresAt: computeExpiry(now, input.timeoutSeconds),
  }

  await saveAttemptRecord(worktree, attempt)
  await saveSessionPointer(worktree, {
    sessionId: input.sessionId,
    profileId: input.profileId,
    attemptId: attempt.id,
    epoch,
    updatedAt: now,
  })

  return { status: "active", attempt, epoch }
}

export async function switchSessionProfile(worktree: string, input: {
  sessionId: string
  profileId: string
  now?: string
}): Promise<{ status: "switched"; epoch: number }> {
  const now = toIso(input.now)
  const previousPointer = loadSessionPointer(worktree, input.sessionId)
  const epoch = (previousPointer?.epoch ?? 0) + 1

  await saveSessionPointer(worktree, {
    sessionId: input.sessionId,
    profileId: input.profileId,
    attemptId: null,
    epoch,
    updatedAt: now,
  })

  return { status: "switched", epoch }
}

export async function getTimerStatus(worktree: string, input: {
  sessionId: string
  expectedEpoch?: number
  now?: string
}): Promise<{
  status: TimerLookupStatus
  attempt?: AttemptRecord
  epoch?: number
}> {
  const now = toIso(input.now)
  const lookup = loadAttemptForPointer(worktree, input.sessionId, input.expectedEpoch)
  if (lookup.status !== "active" && lookup.status !== "timed_out") return lookup
  const attempt = lookup.attempt!

  if (attempt.state === "active" && isTimedOut(attempt, now)) {
    attempt.state = "timed_out"
    attempt.updatedAt = now
    await saveAttemptRecord(worktree, attempt)
    return { status: "timed_out", attempt, epoch: lookup.epoch }
  }

  return { status: attempt.state === "timed_out" ? "timed_out" : lookup.status, attempt, epoch: lookup.epoch }
}

export async function stopAttemptTimer(worktree: string, input: {
  sessionId: string
  expectedEpoch?: number
  now?: string
}): Promise<{
  status: "stopped" | "timed_out" | "stale_session" | "not_found" | "inactive"
  attempt?: AttemptRecord
  elapsedSeconds?: number
  epoch?: number
}> {
  const now = toIso(input.now)
  const lookup = loadAttemptForPointer(worktree, input.sessionId, input.expectedEpoch)
  if (lookup.status === "timed_out") {
    return { status: "timed_out", attempt: lookup.attempt, epoch: lookup.epoch }
  }
  if (lookup.status === "stale_session" || lookup.status === "not_found" || lookup.status === "inactive") {
    return { status: lookup.status, attempt: lookup.attempt, epoch: lookup.epoch }
  }
  const attempt = lookup.attempt!
  if (!attempt.timer?.startedAt || !attempt.timer.timeoutSeconds) return { status: "not_found", epoch: lookup.epoch }

  if (attempt.state === "active" && isTimedOut(attempt, now)) {
    attempt.state = "timed_out"
    attempt.updatedAt = now
    await saveAttemptRecord(worktree, attempt)
    return { status: "timed_out", attempt, epoch: lookup.epoch }
  }

  const elapsedSeconds = Math.max(0, Math.round((Date.parse(now) - Date.parse(attempt.timer.startedAt)) / 1000))
  return { status: "stopped", attempt, elapsedSeconds, epoch: lookup.epoch }
}

export async function abandonAttempt(worktree: string, input: {
  sessionId: string
  expectedEpoch?: number
  now?: string
}): Promise<{
  status: "abandoned" | "timed_out" | "stale_session" | "not_found" | "inactive"
  attempt?: AttemptRecord
  epoch?: number
}> {
  const now = toIso(input.now)
  const lookup = loadAttemptForPointer(worktree, input.sessionId, input.expectedEpoch)
  if (lookup.status === "timed_out") {
    return { status: "timed_out", attempt: lookup.attempt, epoch: lookup.epoch }
  }
  if (lookup.status === "stale_session" || lookup.status === "not_found" || lookup.status === "inactive") {
    return { status: lookup.status, attempt: lookup.attempt, epoch: lookup.epoch }
  }
  const attempt = lookup.attempt!

  attempt.state = "abandoned"
  attempt.updatedAt = now
  await saveAttemptRecord(worktree, attempt)

  return { status: "abandoned", attempt, epoch: lookup.epoch }
}
