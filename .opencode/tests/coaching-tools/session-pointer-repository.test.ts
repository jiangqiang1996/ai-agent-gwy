import { afterEach, describe, expect, it } from "vitest"

import { loadSessionPointer, saveSessionPointer } from "../../plugins/coaching-tools/storage/session-pointer-repository.js"
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

describe("session pointer repository", () => {
  it("stores epoch-versioned session pointers", async () => {
    const worktree = await withWorktree()

    await saveSessionPointer(worktree, {
      sessionId: "session-1",
      profileId: "profile-1",
      epoch: 3,
      updatedAt: "2026-01-02T03:04:05.000Z",
    })

    expect(await loadSessionPointer(worktree, "session-1")).toMatchObject({
      profileId: "profile-1",
      epoch: 3,
    })
  })
})
