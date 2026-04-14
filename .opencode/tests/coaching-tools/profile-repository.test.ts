import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"

import { findProfilesByName, listProfileRecords, saveProfileRecord } from "../../plugins/coaching-tools/storage/profile-repository.js"
import { cleanupTempWorktree, copyFixtureToWorktree, createTempWorktree, readWorktreeFile } from "../setup/temp-worktree.js"

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

describe("profile repository", () => {
  it("loads and lazily migrates legacy fixtures", async () => {
    const worktree = await withWorktree()
    const fixture = fileURLToPath(new URL("../fixtures/users/legacy-missing-id.json", import.meta.url))

    await copyFixtureToWorktree(fixture, worktree, "data/users/legacy-user.json")

    const records = await listProfileRecords(worktree)
    expect(records).toHaveLength(1)
    expect(records[0]?.status).toBe("loaded")
    expect(records[0]?.profile?.schemaVersion).toBe(1)
    expect(records[0]?.profile?.id).toBeTruthy()
  })

  it("blocks duplicate display names before write-back", async () => {
    const worktree = await withWorktree()
    const fixtureA = fileURLToPath(new URL("../fixtures/users/duplicate-name-a.json", import.meta.url))
    const fixtureB = fileURLToPath(new URL("../fixtures/users/duplicate-name-b.json", import.meta.url))

    await copyFixtureToWorktree(fixtureA, worktree, "data/users/duplicate-a.json")
    await copyFixtureToWorktree(fixtureB, worktree, "data/users/duplicate-b.json")

    const matches = await findProfilesByName(worktree, "duplicate-user")
    expect(matches).toHaveLength(2)
    expect(matches.every(match => match.status === "blocked")).toBe(true)
  })

  it("quarantines malformed JSON files", async () => {
    const worktree = await withWorktree()
    const fixture = fileURLToPath(new URL("../fixtures/users/malformed.json", import.meta.url))

    await copyFixtureToWorktree(fixture, worktree, "data/users/malformed.json")

    const records = await listProfileRecords(worktree)
    expect(records[0]?.status).toBe("quarantined")
    expect(records[0]?.issues[0]?.code).toBe("invalid-json")
  })

  it("writes normalized profiles by immutable id path", async () => {
    const worktree = await withWorktree()

    await saveProfileRecord(worktree, {
      schemaVersion: 1,
      id: "profile-123",
      name: "fresh-user",
      createdAt: "2026-01-02T03:04:05.000Z",
      points: 0,
      level: 1,
      streak: { current: 0, best: 0 },
      mastery: {},
      history: [],
      examTypes: [],
      region: null,
      studyPlan: null,
    })

    await expect(readWorktreeFile(worktree, "data/users/profile-123.json")).resolves.toContain("fresh-user")
  })
})
