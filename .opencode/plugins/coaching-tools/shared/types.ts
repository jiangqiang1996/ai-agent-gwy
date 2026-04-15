export interface StudyPlan {
  content: string
  createdAt: string
}

export type UserIdentity = "working" | "campus"

export interface UserProfile {
  schemaVersion?: number
  profileVersion?: number
  id: string
  name: string
  createdAt: string
  identity?: UserIdentity | null
  examTypes: string[]
  region: string | null
  studyPlan: StudyPlan | null
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
