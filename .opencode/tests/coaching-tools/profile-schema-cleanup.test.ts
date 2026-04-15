import { describe, expect, it } from "vitest"

import { migrateProfileRecord } from "../../plugins/coaching-tools/migrations/profile-schema.js"

describe("profile schema cleanup", () => {
  it("drops old score fields (points/level/streak) during migration", () => {
    const result = migrateProfileRecord({
      id: "legacy-score-user",
      name: "legacy-score-user",
      createdAt: "2026-01-02T03:04:05.000Z",
      points: 42,
      level: 3,
      streak: { current: 2, best: 4 },
      examTypes: [],
      region: null,
      studyPlan: null,
    })

    expect(result.classification).toBe("lazy")
    expect(result.profile).not.toHaveProperty("legacyScore")
    expect(result.profile).not.toHaveProperty("points")
    expect(result.profile).toMatchObject({
      identity: null,
      examTypes: [],
    })
  })

  it("drops mastery and history from old profiles without error", () => {
    const result = migrateProfileRecord({
      id: "mastery-user",
      name: "mastery-user",
      createdAt: "2026-01-02T03:04:05.000Z",
      mastery: {
        "言语理解与表达": { total: 10, correct: 8, avgTimeSeconds: 30, leafTopics: {} },
      },
      history: [
        { id: "h1", timestamp: "2026-01-01T00:00:00Z", subject: "言语", leafTopic: "逻辑填空", correct: true, timeSeconds: 20, pointsChange: 10 },
      ],
      examTypes: ["guokao"],
      region: null,
      studyPlan: null,
    })

    expect(result.classification).toBe("lazy")
    expect(result.profile).not.toHaveProperty("mastery")
    expect(result.profile).not.toHaveProperty("history")
    expect(result.profile).toMatchObject({
      id: "mastery-user",
      examTypes: ["guokao"],
    })
  })

  it("drops all legacy fields together (mastery + history + points + level + streak)", () => {
    const result = migrateProfileRecord({
      id: "full-legacy",
      name: "full-legacy",
      createdAt: "2026-01-02T03:04:05.000Z",
      points: 100,
      level: 5,
      streak: { current: 3, best: 7 },
      mastery: { "数量关系": { total: 5, correct: 2, avgTimeSeconds: 45, leafTopics: {} } },
      history: [{ id: "x", timestamp: "2026-01-01T00:00:00Z", subject: "数量", leafTopic: "工程", correct: false, timeSeconds: 60, pointsChange: 3 }],
      examTypes: [],
      region: null,
      studyPlan: null,
    })

    expect(result.classification).toBe("lazy")
    expect(result.profile).not.toHaveProperty("mastery")
    expect(result.profile).not.toHaveProperty("history")
    expect(result.profile).not.toHaveProperty("legacyScore")
    expect(result.profile).not.toHaveProperty("points")
  })
})
