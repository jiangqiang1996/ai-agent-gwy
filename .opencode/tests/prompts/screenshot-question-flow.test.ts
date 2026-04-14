import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function readPromptAsset(relativePath: string): Promise<string> {
  const filePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFile(filePath, "utf8")
}

describe("screenshot question workflow", () => {
  it("defines a shared question artifact contract", async () => {
    const content = await readPromptAsset("rules/question-artifact-contract.md")

    expect(content).toContain("QuestionArtifact")
    expect(content).toContain("layoutType")
    expect(content).toContain("confidence")
    expect(content).toContain("completeness")
  })

  it("treats screenshot solving as user-provided image input, not system screenshotting", async () => {
    const content = await readPromptAsset("rules/screenshot-question-workflow.md")

    expect(content).toContain("用户自己上传的题目图片")
    expect(content).toContain("若当前消息没有可用图片")
    expect(content).toContain("补图或补文字")
  })

  it("ships a dedicated screenshot explanation skill", async () => {
    const content = await readPromptAsset("skills/explain-screenshot-question/SKILL.md")

    expect(content).toContain("讲解用户上传的题目图片")
    expect(content).toContain("QuestionArtifact")
    expect(content).toContain("不完整或置信度低")
  })
})
