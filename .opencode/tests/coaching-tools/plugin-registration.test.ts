import { describe, expect, it } from "vitest"

import { registerCoachingTools } from "../../plugins/coaching-tools/register-tools.js"

describe("plugin registration", () => {
  it("keeps the stable public tool registry", () => {
    expect(Object.keys(registerCoachingTools()).sort()).toEqual([
      "export-document",
      "grading",
      "question-generator",
      "user-profile",
    ])
  })
})
