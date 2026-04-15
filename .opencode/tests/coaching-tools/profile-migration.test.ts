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
    expect(result.profile).toMatchObject({ identity: null })
  })

  it("treats missing points/level/streak as readable legacy state, not broken core schema", () => {
    const result = migrateProfileRecord({
      id: "legacy-no-score",
      name: "legacy-no-score",
      createdAt: "2026-01-02T03:04:05.000Z",
      examTypes: ["guokao"],
      region: null,
      studyPlan: null,
    })

    expect(result.classification).toBe("lazy")
    expect(result.profile).toMatchObject({
      id: "legacy-no-score",
      identity: null,
    })
  })

  it("blocks semantically unsafe enum values", () => {
    const result = migrateProfileRecord({
      id: "unsafe-user",
      name: "unsafe-user",
      createdAt: "2026-01-02T03:04:05.000Z",
      points: 0,
      level: 1,
      streak: { current: 0, best: 0 },
      examTypes: ["unknown-exam"],
      region: "火星",
      studyPlan: null,
    })

    expect(result.classification).toBe("blocked")
    expect(result.issues[0]?.code).toMatch(/unknown-exam-type|invalid-region/)
  })

  it("blocks incomplete legacy score fields that can no longer be safely normalized", () => {
    const result = migrateProfileRecord({
      id: "legacy-partial-score",
      name: "legacy-partial-score",
      createdAt: "2026-01-02T03:04:05.000Z",
      points: 10,
      examTypes: ["guokao"],
      region: null,
      studyPlan: null,
    })

    expect(result.classification).toBe("blocked")
    expect(result.issues[0]?.code).toBe("invalid-legacy-score")
  })

  it("blocks invalid identity values", () => {
    const result = migrateProfileRecord({
      id: "legacy-invalid-identity",
      name: "legacy-invalid-identity",
      createdAt: "2026-01-02T03:04:05.000Z",
      examTypes: ["guokao"],
      region: null,
      studyPlan: null,
      identity: "teacher",
    })

    expect(result.classification).toBe("blocked")
    expect(result.issues[0]?.code).toBe("invalid-identity")
  })

  it("quarantines structurally invalid records", () => {
    const result = migrateProfileRecord({ name: "broken-user" })

    expect(result.classification).toBe("quarantine")
    expect(result.profile).toBeNull()
  })
})
