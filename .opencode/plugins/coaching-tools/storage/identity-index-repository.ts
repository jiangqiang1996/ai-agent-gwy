import { join } from "path"

import { IDENTITY_INDEX_PATH } from "../shared/constants.js"
import type { NameClaimRecord } from "../shared/types.js"
import { fileExists, readJsonFile, writeJsonFile } from "./file-store.js"
import { enqueueWrite } from "./write-queue.js"

type IdentityIndex = Record<string, NameClaimRecord>

function normalizeName(displayName: string): string {
  return displayName.trim()
}

function getIndexPath(worktree: string): string {
  return join(worktree, IDENTITY_INDEX_PATH)
}

export function loadIdentityIndex(worktree: string): IdentityIndex {
  const filePath = getIndexPath(worktree)
  if (!fileExists(filePath)) return {}
  try {
    return readJsonFile<IdentityIndex>(filePath)
  } catch {
    return {}
  }
}

export function getNameClaim(worktree: string, displayName: string): NameClaimRecord | null {
  const index = loadIdentityIndex(worktree)
  return index[normalizeName(displayName)] ?? null
}

export async function saveNameClaim(worktree: string, claim: NameClaimRecord): Promise<void> {
  const filePath = getIndexPath(worktree)
  await enqueueWrite(filePath, async () => {
    const index = loadIdentityIndex(worktree)
    index[normalizeName(claim.displayName)] = claim
    writeJsonFile(filePath, index)
  })
}
