export interface MasteryLeafTopic {
  total: number
  correct: number
  avgTimeSeconds: number
}

export interface SubjectMastery {
  total: number
  correct: number
  avgTimeSeconds: number
  leafTopics: Record<string, MasteryLeafTopic>
}

export interface HistoryEntry {
  id: string
  timestamp: string
  subject: string
  leafTopic: string
  correct: boolean
  timeSeconds: number
  pointsChange: number
}

export interface StudyPlan {
  content: string
  createdAt: string
}

export interface UserProfile {
  schemaVersion?: number
  profileVersion?: number
  id: string
  name: string
  createdAt: string
  points: number
  level: number
  streak: { current: number; best: number }
  mastery: Record<string, SubjectMastery>
  history: HistoryEntry[]
  examTypes: string[]
  region: string | null
  studyPlan: StudyPlan | null
}

export interface TimerState {
  startTime: number
  questionId: string
  timeout: number
}

export type AttemptState =
  | "registered"
  | "active"
  | "answered"
  | "evaluated"
  | "applying"
  | "applied"
  | "timed_out"
  | "abandoned"
  | "pending_subjective_review"

export interface AttemptApplyDelta {
  points: number
  streakCurrent: number | null
  streakBest: number | null
}

export interface AttemptApplyState {
  status: "not_started" | "applying" | "applied"
  pointsChange: number
  historyId: string | null
  profileVersion: number | null
  delta: AttemptApplyDelta | null
  updatedAt: string | null
}

export interface AttemptTimerMetadata {
  startedAt: string | null
  timeoutSeconds: number | null
  expiresAt: string | null
}

export interface AttemptRecord {
  id: string
  profileId: string
  sessionId: string | null
  questionId: string
  subject: string
  leafTopic: string
  state: AttemptState
  questionPrompt: string | null
  questionText: string | null
  correctAnswer: string | null
  answerText?: string | null
  createdAt: string
  updatedAt: string
  timer: AttemptTimerMetadata | null
  apply: AttemptApplyState | null
  evaluation?: {
    questionType: "objective" | "subjective"
    correct: boolean | null
    timeSeconds: number | null
    gradedAt: string | null
  } | null
}

export type NameClaimState = "claimed" | "blocked" | "released"

export interface NameClaimRecord {
  displayName: string
  state: NameClaimState
  profileId: string | null
  reason: string | null
  updatedAt: string
}

export interface SessionPointerRecord {
  sessionId: string
  profileId: string
  attemptId: string | null
  epoch: number
  updatedAt: string
}

export interface MigrationManifestRecord {
  epoch: number
  createdAt: string
  backupId: string | null
  migratedProfiles: string[]
  quarantinedIdentities: string[]
  notes: string[]
}

export const EXAM_TYPES = ["guokao", "shengkao", "shiyedanwei"] as const
export type ExamType = typeof EXAM_TYPES[number]
