import { describe, expect, it } from "vitest"

import { isQuestionArtifact } from "../../plugins/coaching-tools/shared/question-artifact.js"

describe("question artifact runtime contract", () => {
  it("accepts well-formed artifacts", () => {
    expect(isQuestionArtifact({
      content: "题目文本",
      layoutType: "mixed",
      confidence: "medium",
      completeness: "partial",
      unresolvedRegions: ["表格右侧一列缺失"],
    })).toBe(true)
  })

  it("rejects malformed artifacts", () => {
    expect(isQuestionArtifact({
      content: "题目文本",
      layoutType: "unknown",
      confidence: "medium",
      completeness: "partial",
      unresolvedRegions: [],
    })).toBe(false)
  })
})
