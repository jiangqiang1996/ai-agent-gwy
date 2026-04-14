import { join } from "path"

import { MIGRATION_MANIFEST_PATH } from "../shared/constants.js"
import type { MigrationManifestRecord } from "../shared/types.js"
import { fileExists, readJsonFile, writeJsonFile } from "./file-store.js"
import { enqueueWrite } from "./write-queue.js"

function getManifestPath(worktree: string): string {
  return join(worktree, MIGRATION_MANIFEST_PATH)
}

export function loadMigrationManifest(worktree: string): MigrationManifestRecord | null {
  const filePath = getManifestPath(worktree)
  if (!fileExists(filePath)) return null
  try {
    return readJsonFile<MigrationManifestRecord>(filePath)
  } catch {
    return null
  }
}

export async function saveMigrationManifest(worktree: string, manifest: MigrationManifestRecord): Promise<void> {
  const filePath = getManifestPath(worktree)
  await enqueueWrite(filePath, async () => {
    writeJsonFile(filePath, manifest)
  })
}
