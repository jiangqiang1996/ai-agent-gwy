import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function readPromptAsset(relativePath: string): Promise<string> {
  const filePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFile(filePath, "utf8")
}

describe("question input workflow", () => {
  it("defines a shared question artifact contract with confirmation gate", async () => {
    const content = await readPromptAsset("rules/question-artifact-contract.md")

    expect(content).toContain("QuestionArtifact")
    expect(content).toContain("layoutType")
    expect(content).toContain("confidence")
    expect(content).toContain("completeness")
    expect(content).toContain("确认门控")
  })

  it("covers conversation text, external files, and image input channels", async () => {
    const content = await readPromptAsset("rules/question-input-workflow.md")

    expect(content).toContain("会话文本")
    expect(content).toContain("外部文件")
    expect(content).toContain("图片")
    expect(content).toContain("QuestionArtifact")
    expect(content).toContain("确认门控")
  })

  it("supports multi-question splitting for external files", async () => {
    const content = await readPromptAsset("rules/question-input-workflow.md")

    expect(content).toContain("多题拆分")
    expect(content).toContain("编号模式")
  })

  it("falls back when no input is available", async () => {
    const content = await readPromptAsset("rules/question-input-workflow.md")

    expect(content).toContain("没有任何可用输入")
  })

  it("ships a dedicated question explanation skill", async () => {
    const content = await readPromptAsset("skills/explain-question/SKILL.md")

    expect(content).toContain("讲解用户提供的题目")
    expect(content).toContain("QuestionArtifact")
    expect(content).toContain("确认门控")
    expect(content).toContain("外部文件")
  })
})
