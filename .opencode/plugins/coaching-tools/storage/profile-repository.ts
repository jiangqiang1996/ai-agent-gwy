import { join } from "path"

import { USERS_DIR } from "../shared/constants.js"
import type { UserProfile } from "../shared/types.js"
import { migrateProfileRecord, type ProfileMigrationIssue } from "../migrations/profile-schema.js"
import { atomicWriteFile, fileExists, getProfilePathById, listJsonFiles, readTextFile, removeFile } from "./file-store.js"
import { enqueueWrite } from "./write-queue.js"

export type ProfileRecordStatus = "loaded" | "blocked" | "quarantined"

export interface ProfileRecordResult {
  status: ProfileRecordStatus
  filePath: string
  profile: UserProfile | null
  issues: ProfileMigrationIssue[]
}

function buildDuplicateIssue(kind: "name" | "id", value: string): ProfileMigrationIssue {
  return {
    code: `duplicate-${kind}`,
    message: `${kind} "${value}" 出现重复，必须先修复后才能写回`,
  }
}

export async function listProfileRecords(worktree: string): Promise<ProfileRecordResult[]> {
  const directory = join(worktree, USERS_DIR)
  const filePaths = listJsonFiles(directory).map(fileName => join(directory, fileName))
  const results: ProfileRecordResult[] = []

  for (const filePath of filePaths) {
    try {
      const raw = JSON.parse(readTextFile(filePath)) as unknown
      const migrated = migrateProfileRecord(raw)

      if (migrated.classification === "lazy") {
        results.push({ status: "loaded", filePath, profile: migrated.profile, issues: migrated.issues })
      } else if (migrated.classification === "blocked") {
        results.push({ status: "blocked", filePath, profile: migrated.profile, issues: migrated.issues })
      } else {
        results.push({ status: "quarantined", filePath, profile: null, issues: migrated.issues })
      }
    } catch {
      results.push({
        status: "quarantined",
        filePath,
        profile: null,
        issues: [{ code: "invalid-json", message: "用户档案 JSON 无法解析，必须隔离" }],
      })
    }
  }

  const nameCounts = new Map<string, number>()
  const idCounts = new Map<string, number>()
  for (const result of results) {
    if (result.status !== "loaded" || !result.profile) continue
    nameCounts.set(result.profile.name, (nameCounts.get(result.profile.name) ?? 0) + 1)
    idCounts.set(result.profile.id, (idCounts.get(result.profile.id) ?? 0) + 1)
  }

  return results.map(result => {
    if (result.status !== "loaded" || !result.profile) return result

    const extraIssues: ProfileMigrationIssue[] = []
    if ((nameCounts.get(result.profile.name) ?? 0) > 1) {
      extraIssues.push(buildDuplicateIssue("name", result.profile.name))
    }
    if ((idCounts.get(result.profile.id) ?? 0) > 1) {
      extraIssues.push(buildDuplicateIssue("id", result.profile.id))
    }

    if (extraIssues.length === 0) return result

    return {
      ...result,
      status: "blocked" as const,
      issues: [...result.issues, ...extraIssues],
    }
  })
}

export async function findProfilesByName(worktree: string, name: string): Promise<ProfileRecordResult[]> {
  const results = await listProfileRecords(worktree)
  return results.filter(result => result.profile?.name === name)
}

export async function saveProfileRecord(worktree: string, profile: UserProfile): Promise<void> {
  const nextProfile: UserProfile = {
    ...profile,
    schemaVersion: profile.schemaVersion ?? 1,
    profileVersion: profile.profileVersion ?? 0,
    identity: profile.identity ?? null,
  }
  const filePath = getProfilePathById(worktree, nextProfile.id)
  const legacyPath = join(worktree, USERS_DIR, `${nextProfile.name}.json`)

  await enqueueWrite(filePath, async () => {
    if (legacyPath !== filePath && fileExists(legacyPath)) {
      removeFile(legacyPath)
    }
    atomicWriteFile(filePath, JSON.stringify(nextProfile, null, 2))
  })
}

export async function deleteProfileRecord(worktree: string, profileId: string): Promise<void> {
  const filePath = getProfilePathById(worktree, profileId)
  await enqueueWrite(filePath, async () => {
    removeFile(filePath)
  })
}
