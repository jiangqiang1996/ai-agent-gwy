import { access, readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { CoachingPlugin } from "../../plugins/coaching-tools.js"
import { cleanupTempWorktree, createTempWorktree, readWorktreeFile, writeWorktreeFile } from "../setup/temp-worktree.js"

describe("coaching tools test baseline", () => {
  it("loads the plugin and exposes the current tool surface", async () => {
    const plugin = await CoachingPlugin({} as never)
    const tools = plugin.tool ?? {}

    expect(Object.keys(tools).sort()).toEqual([
      "export-document",
      "grading",
      "question-generator",
      "user-profile",
    ])
  })

  it("creates an isolated temporary worktree for file-backed tests", async () => {
    const worktree = await createTempWorktree()

    try {
      await writeWorktreeFile(worktree, "data/users/demo.txt", "hello")
      await expect(readWorktreeFile(worktree, "data/users/demo.txt")).resolves.toBe("hello")
    } finally {
      await cleanupTempWorktree(worktree)
    }
  })

  it("ships legacy fixture files for characterization coverage", async () => {
    const legacyFixture = fileURLToPath(new URL("../fixtures/users/legacy-missing-id.json", import.meta.url))
    const duplicateFixture = fileURLToPath(new URL("../fixtures/users/duplicate-name-a.json", import.meta.url))
    const malformedFixture = fileURLToPath(new URL("../fixtures/users/malformed.json", import.meta.url))

    await access(legacyFixture)
    await access(duplicateFixture)
    await access(malformedFixture)

    const malformed = await readFile(malformedFixture, "utf8")
    expect(() => JSON.parse(malformed)).toThrow()
  })
})
