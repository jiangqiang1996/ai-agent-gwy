import { describe, expect, it } from "vitest"

import { migrateProfileRecord } from "../../plugins/coaching-tools/migrations/profile-schema.js"

describe("profile schema cleanup", () => {
  it("preserves old score fields as legacy-readable data when present", () => {
    const result = migrateProfileRecord({
      id: "legacy-score-user",
      name: "legacy-score-user",
      createdAt: "2026-01-02T03:04:05.000Z",
      points: 42,
      level: 3,
      streak: { current: 2, best: 4 },
      mastery: {},
      history: [],
      examTypes: [],
      region: null,
      studyPlan: null,
    })

    expect(result.classification).toBe("lazy")
    expect(result.profile).toMatchObject({
      legacyScore: {
        points: 42,
        level: 3,
        streak: { current: 2, best: 4 },
      },
      identity: null,
    })
  })
})
