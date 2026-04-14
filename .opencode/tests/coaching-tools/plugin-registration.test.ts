import { describe, expect, it } from "vitest"

import { registerCoachingTools } from "../../plugins/coaching-tools/register-tools.js"

describe("plugin registration", () => {
  it("keeps the stable public tool registry", () => {
    expect(Object.keys(registerCoachingTools()).sort()).toEqual([
      "grading",
      "points",
      "question-generator",
      "timer",
      "user-profile",
    ])
  })
})
