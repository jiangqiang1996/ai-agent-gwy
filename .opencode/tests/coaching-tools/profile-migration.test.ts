import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { migrateProfileRecord } from "../../plugins/coaching-tools/migrations/profile-schema.js"

describe("profile schema migration", () => {
  it("lazily migrates shape-only legacy profiles", async () => {
    const fixturePath = fileURLToPath(new URL("../fixtures/users/legacy-missing-id.json", import.meta.url))
    const raw = JSON.parse(await readFile(fixturePath, "utf8"))

    const result = migrateProfileRecord(raw)

    expect(result.classification).toBe("lazy")
    expect(result.profile).toMatchObject({
      name: "legacy-user",
      examTypes: [],
      region: null,
      studyPlan: null,
      schemaVersion: 1,
    })
    expect(result.profile?.id).toBeTruthy()
  })

  it("blocks semantically unsafe enum values", () => {
    const result = migrateProfileRecord({
      id: "unsafe-user",
      name: "unsafe-user",
      createdAt: "2026-01-02T03:04:05.000Z",
      points: 0,
      level: 1,
      streak: { current: 0, best: 0 },
      mastery: {},
      history: [],
      examTypes: ["unknown-exam"],
      region: "火星",
      studyPlan: null,
    })

    expect(result.classification).toBe("blocked")
    expect(result.issues[0]?.code).toMatch(/unknown-exam-type|invalid-region/)
  })

  it("quarantines structurally invalid records", () => {
    const result = migrateProfileRecord({ name: "broken-user" })

    expect(result.classification).toBe("quarantine")
    expect(result.profile).toBeNull()
  })
})
