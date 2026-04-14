import { afterEach, describe, expect, it } from "vitest"

import { checkNameAvailability, createProfile, loadProfile, overwriteProfile, updateProfileDetails } from "../../plugins/coaching-tools/services/profile-service.js"
import { saveNameClaim } from "../../plugins/coaching-tools/storage/identity-index-repository.js"
import { saveProfileRecord } from "../../plugins/coaching-tools/storage/profile-repository.js"
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

describe("profile service", () => {
  it("requires explicit create and explicit load semantics", async () => {
    const worktree = await withWorktree()

    expect(await checkNameAvailability(worktree, "new-user")).toMatchObject({ status: "available" })
    expect(await loadProfile(worktree, "new-user")).toMatchObject({ status: "not_found" })

    const created = await createProfile(worktree, {
      username: "new-user",
      examTypes: ["guokao"],
      region: "重庆",
    })

    expect(created.status).toBe("created")
    expect(created.profile).toMatchObject({ identity: null })
    expect(created.profile).not.toHaveProperty("points")
    expect(created.profile).not.toHaveProperty("level")
    expect(created.profile).not.toHaveProperty("streak")
    expect(await checkNameAvailability(worktree, "new-user")).toMatchObject({ status: "existing" })
    expect(await loadProfile(worktree, "new-user")).toMatchObject({ status: "loaded" })
  })

  it("persists and updates the optional working/campus identity field", async () => {
    const worktree = await withWorktree()

    const created = await createProfile(worktree, {
      username: "identity-user",
      examTypes: ["shengkao"],
      region: "重庆",
      identity: "working",
    })

    expect(created.profile).toMatchObject({ identity: "working" })

    const updated = await updateProfileDetails(worktree, {
      username: "identity-user",
      identity: "campus",
    })

    expect(updated.status).toBe("updated")
    expect(updated.profile).toMatchObject({ identity: "campus" })

    const cleared = await updateProfileDetails(worktree, {
      username: "identity-user",
      identity: null,
    })

    expect(cleared.status).toBe("updated")
    expect(cleared.profile).toMatchObject({ identity: null })
  })

  it("blocks profile creation when the display name is reserved as blocked", async () => {
    const worktree = await withWorktree()

    await saveNameClaim(worktree, {
      displayName: "duplicate-user",
      state: "blocked",
      profileId: null,
      reason: "duplicate identity under repair",
      updatedAt: "2026-01-02T03:04:05.000Z",
    })

    expect(await createProfile(worktree, { username: "duplicate-user" })).toMatchObject({ status: "blocked" })
  })

  it("overwrites an existing profile instead of silently reusing it", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      id: "profile-1",
      name: "existing-user",
      createdAt: "2026-01-02T03:04:05.000Z",
      legacyScore: {
        points: 99,
        level: 3,
        streak: { current: 4, best: 8 },
      },
      mastery: {},
      history: [],
      examTypes: ["guokao"],
      region: "重庆",
      studyPlan: null,
    })

    const overwritten = await overwriteProfile(worktree, {
      username: "existing-user",
      examTypes: ["shengkao"],
      region: "四川",
    })

    expect(overwritten.status).toBe("overwritten")
    expect(overwritten.profile?.id).not.toBe("profile-1")
    expect(overwritten.profile).not.toHaveProperty("points")
    expect(overwritten.profile?.examTypes).toEqual(["shengkao"])
  })
})
