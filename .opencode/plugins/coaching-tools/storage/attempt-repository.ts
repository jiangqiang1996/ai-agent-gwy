import { join } from "path"

import { ATTEMPTS_DIR } from "../shared/constants.js"
import type { AttemptRecord } from "../shared/types.js"
import { atomicWriteFile, listJsonFiles, readJsonFile } from "./file-store.js"
import { enqueueWrite } from "./write-queue.js"

function getAttemptPath(worktree: string, attemptId: string): string {
  return join(worktree, ATTEMPTS_DIR, `${attemptId}.json`)
}

export async function saveAttemptRecord(worktree: string, attempt: AttemptRecord): Promise<void> {
  const filePath = getAttemptPath(worktree, attempt.id)
  await enqueueWrite(filePath, async () => {
    atomicWriteFile(filePath, JSON.stringify(attempt, null, 2))
  })
}

export function loadAttemptRecord(worktree: string, attemptId: string): AttemptRecord | null {
  const filePath = getAttemptPath(worktree, attemptId)
  try {
    return readJsonFile<AttemptRecord>(filePath)
  } catch {
    return null
  }
}

export function listAttemptsByProfileId(worktree: string, profileId: string): AttemptRecord[] {
  const directory = join(worktree, ATTEMPTS_DIR)
  return listJsonFiles(directory)
    .map(fileName => {
      try {
        return readJsonFile<AttemptRecord>(join(directory, fileName))
      } catch {
        return null
      }
    })
    .filter((attempt): attempt is AttemptRecord => attempt !== null && attempt.profileId === profileId)
}
