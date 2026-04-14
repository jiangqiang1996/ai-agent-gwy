import { afterEach, describe, expect, it } from "vitest"

import { loadMigrationManifest, saveMigrationManifest } from "../../plugins/coaching-tools/storage/migration-manifest-repository.js"
import { cleanupTempWorktree, createTempWorktree } from "../setup/temp-worktree.js"

const worktrees: string[] = []

afterEach(async () => {
  while (worktrees.length > 0) {
    const worktree = worktrees.pop()
    if (worktree) await cleanupTempWorktree(worktree)
  }
})

async function withWorktree(): Promise<string> {
  const worktree = await createTempWorktree()
  worktrees.push(worktree)
  return worktree
}

describe("migration manifest repository", () => {
  it("round-trips manifest epoch metadata", async () => {
    const worktree = await withWorktree()

    await saveMigrationManifest(worktree, {
      epoch: 2,
      createdAt: "2026-01-02T03:04:05.000Z",
      backupId: "backup-1",
      migratedProfiles: ["profile-1"],
      quarantinedIdentities: ["duplicate-user"],
      notes: ["initial cutover"],
    })

    expect(loadMigrationManifest(worktree)).toEqual({
      epoch: 2,
      createdAt: "2026-01-02T03:04:05.000Z",
      backupId: "backup-1",
      migratedProfiles: ["profile-1"],
      quarantinedIdentities: ["duplicate-user"],
      notes: ["initial cutover"],
    })
  })
})
