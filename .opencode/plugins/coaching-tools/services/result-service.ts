import { POINTS_CORRECT, POINTS_WRONG } from "../shared/constants.js"
import { calcLevel } from "../shared/formatters.js"
import type { AttemptApplyDelta, AttemptRecord, SubjectMastery, UserProfile } from "../shared/types.js"
import { loadAttemptRecord, saveAttemptRecord } from "../storage/attempt-repository.js"
import { loadProfileById, saveProfileRecord } from "../storage/profile-repository.js"

function hasAppliedHistory(profile: UserProfile, historyId: string | null): boolean {
  if (!historyId) return false
  return profile.history.some(entry => entry.id === historyId)
}

async function finalizeRecoveredApplication(worktree: string, attempt: AttemptRecord, profile: UserProfile): Promise<{
  status: "applied" | "invalid_state"
  attempt: AttemptRecord
}> {
  if (!hasAppliedHistory(profile, attempt.apply?.historyId ?? null)) {
    return { status: "invalid_state", attempt }
  }

  attempt.apply = {
    status: "applied",
    pointsChange: attempt.apply?.pointsChange ?? 0,
    historyId: attempt.apply?.historyId ?? null,
    profileVersion: attempt.apply?.profileVersion ?? profile.profileVersion ?? null,
    delta: attempt.apply?.delta ?? null,
    updatedAt: new Date().toISOString(),
  }
  attempt.state = "applied"
  attempt.updatedAt = new Date().toISOString()
  await saveAttemptRecord(worktree, attempt)
  return { status: "applied", attempt }
}

function ensureSubjectMastery(profile: UserProfile, subject: string): SubjectMastery {
  if (!profile.mastery[subject]) {
    profile.mastery[subject] = {
      total: 0,
      correct: 0,
      avgTimeSeconds: 0,
      leafTopics: {},
    }
  }
  return profile.mastery[subject]
}

function updateAverage(previousAverage: number, total: number, nextValue: number): number {
  return Math.round((previousAverage * total + nextValue) / (total + 1))
}

function buildDelta(profile: UserProfile, attempt: AttemptRecord): AttemptApplyDelta {
  const isCorrect = attempt.evaluation?.correct === true
  const pointsDelta = isCorrect ? POINTS_CORRECT : -POINTS_WRONG
  const nextStreakCurrent = isCorrect ? profile.streak.current + 1 : 0
  const nextStreakBest = isCorrect ? Math.max(profile.streak.best, nextStreakCurrent) : profile.streak.best

  return {
    points: pointsDelta,
    streakCurrent: nextStreakCurrent,
    streakBest: nextStreakBest,
  }
}

export async function applyAttemptResult(worktree: string, attemptId: string): Promise<{
  status: "applied" | "already_applied" | "invalid_state" | "profile_missing"
  attempt?: AttemptRecord
}> {
  const attempt = loadAttemptRecord(worktree, attemptId)
  if (attempt?.apply?.status === "applied") {
    return { status: "already_applied", attempt }
  }

  if (!attempt || !["evaluated", "applying"].includes(attempt.state) || !attempt.evaluation || attempt.evaluation.correct === null || attempt.evaluation.timeSeconds === null) {
    return { status: "invalid_state", attempt: attempt ?? undefined }
  }

  const profileResult = await loadProfileById(worktree, attempt.profileId)
  if (!profileResult?.profile || profileResult.status !== "loaded") {
    return { status: "profile_missing", attempt }
  }

  const profile = profileResult.profile

  if (attempt.apply?.status === "applying") {
    const recovered = await finalizeRecoveredApplication(worktree, attempt, profile)
    return recovered.status === "applied"
      ? { status: "applied", attempt: recovered.attempt }
      : { status: "invalid_state", attempt: recovered.attempt }
  }

  const delta = buildDelta(profile, attempt)
  const nextPoints = Math.max(0, profile.points + delta.points)
  const timeSeconds = attempt.evaluation.timeSeconds
  const isCorrect = attempt.evaluation.correct
  const historyId = `attempt-${attempt.id}`
  const profileVersion = (profile.profileVersion ?? 0) + 1

  attempt.apply = {
    status: "applying",
    pointsChange: delta.points,
    historyId,
    profileVersion,
    delta,
    updatedAt: new Date().toISOString(),
  }
  attempt.state = "applying"
  attempt.updatedAt = new Date().toISOString()

  await saveAttemptRecord(worktree, attempt)

  profile.points = nextPoints
  profile.level = calcLevel(nextPoints)
  profile.profileVersion = profileVersion
  profile.streak.current = delta.streakCurrent ?? profile.streak.current
  profile.streak.best = delta.streakBest ?? profile.streak.best

  const mastery = ensureSubjectMastery(profile, attempt.subject)
  mastery.avgTimeSeconds = updateAverage(mastery.avgTimeSeconds, mastery.total, timeSeconds)
  mastery.total += 1
  if (isCorrect) mastery.correct += 1

  if (attempt.leafTopic) {
    if (!mastery.leafTopics[attempt.leafTopic]) {
      mastery.leafTopics[attempt.leafTopic] = { total: 0, correct: 0, avgTimeSeconds: 0 }
    }
    const leaf = mastery.leafTopics[attempt.leafTopic]
    leaf.avgTimeSeconds = updateAverage(leaf.avgTimeSeconds, leaf.total, timeSeconds)
    leaf.total += 1
    if (isCorrect) leaf.correct += 1
  }

  profile.history.push({
    id: historyId,
    timestamp: new Date().toISOString(),
    subject: attempt.subject,
    leafTopic: attempt.leafTopic,
    correct: isCorrect,
    timeSeconds,
    pointsChange: delta.points,
  })

  attempt.apply = {
    status: "applied",
    pointsChange: delta.points,
    historyId,
    profileVersion,
    delta,
    updatedAt: new Date().toISOString(),
  }
  attempt.state = "applied"
  attempt.updatedAt = new Date().toISOString()

  await saveProfileRecord(worktree, profile)
  await saveAttemptRecord(worktree, attempt)

  return { status: "applied", attempt }
}
