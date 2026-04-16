import { describe, expect, it } from "vitest"

import { registerCoachingTools } from "../../plugins/coaching-tools/register-tools.js"

describe("plugin registration", () => {
  it("keeps the stable public tool registry", () => {
    expect(Object.keys(registerCoachingTools()).sort()).toEqual([
      "convert-md-to-html",
      "export-document",
      "grading",
      "inline-html-resources",
      "question-generator",
      "user-profile",
    ])
  })
})
