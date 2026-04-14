import { join } from "path"
import { randomUUID } from "crypto"

import { USERS_DIR } from "../shared/constants.js"
import type { UserProfile } from "../shared/types.js"
import { atomicWriteFile, fileExists, getProfilePathById, listJsonFiles, readTextFile, removeFile } from "../storage/file-store.js"

export function createUserProfile(name: string): UserProfile {
  return {
    id: randomUUID(),
    name,
    createdAt: new Date().toISOString(),
    points: 0,
    level: 1,
    streak: { current: 0, best: 0 },
    mastery: {},
    history: [],
    examTypes: [],
    region: null,
    studyPlan: null,
  }
}

export function findProfileByName(worktree: string, name: string): UserProfile | null {
  const dir = join(worktree, USERS_DIR)
  if (!fileExists(dir)) return null
  try {
    const files = listJsonFiles(dir)
    for (const fileName of files) {
      try {
        const profile = JSON.parse(readTextFile(join(dir, fileName))) as UserProfile
        if (profile.name === name) return profile
      } catch {
        continue
      }
    }
  } catch {
    return null
  }
  return null
}

export function migrateProfile(profile: UserProfile): UserProfile {
  if (!profile.id) profile.id = randomUUID()
  if (!profile.examTypes) profile.examTypes = []
  if (profile.region === undefined) profile.region = null
  if (!profile.studyPlan) profile.studyPlan = null
  return profile
}

export function loadProfileByName(worktree: string, name: string): UserProfile | null {
  const found = findProfileByName(worktree, name)
  if (!found) return null
  return migrateProfile(found)
}

export function saveProfile(worktree: string, profile: UserProfile): void {
  const nextPath = getProfilePathById(worktree, profile.id)
  const legacyPath = join(worktree, USERS_DIR, `${profile.name}.json`)
  if (legacyPath !== nextPath) removeFile(legacyPath)
  atomicWriteFile(nextPath, JSON.stringify(profile, null, 2))
}
