import { afterEach, describe, expect, it } from "vitest"

import { getNameClaim, saveNameClaim } from "../../plugins/coaching-tools/storage/identity-index-repository.js"
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

describe("identity index repository", () => {
  it("persists blocked name claims", async () => {
    const worktree = await withWorktree()

    await saveNameClaim(worktree, {
      displayName: "duplicate-user",
      state: "blocked",
      profileId: null,
      reason: "duplicate display name",
      updatedAt: "2026-01-02T03:04:05.000Z",
    })

    expect(getNameClaim(worktree, "duplicate-user")).toMatchObject({
      state: "blocked",
      reason: "duplicate display name",
    })
  })
})
