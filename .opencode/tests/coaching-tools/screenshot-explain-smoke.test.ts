import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function readProjectFile(relativePath: string): Promise<string> {
  const filePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFile(filePath, "utf8")
}

describe("screenshot explain smoke", () => {
  it("keeps screenshot solving anchored on user-provided question images and QuestionArtifact", async () => {
    const workflow = await readProjectFile("rules/screenshot-question-workflow.md")
    const artifact = await readProjectFile("rules/question-artifact-contract.md")
    const skill = await readProjectFile("skills/explain-screenshot-question/SKILL.md")

    expect(workflow).toContain("用户自己上传的题目图片")
    expect(workflow).toContain("QuestionArtifact")
    expect(artifact).toContain("layoutType")
    expect(artifact).toContain("completeness")
    expect(skill).toContain("只有用户明确要求导出时才写文件")
  })

  it("requires QuestionArtifact as a gate in the orchestrator screenshot route", async () => {
    const orchestrator = await readProjectFile("agents/orchestrator.md")

    expect(orchestrator).toContain("QuestionArtifact")
    expect(orchestrator).toContain("截图工作流")
    expect(orchestrator).toMatch(/截图.*QuestionArtifact.*老师|QuestionArtifact.*截图/)
  })
})
