import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function readProjectFile(relativePath: string): Promise<string> {
  const filePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFile(filePath, "utf8")
}

describe("question input smoke", () => {
  it("keeps question input anchored on QuestionArtifact with confirmation gate", async () => {
    const workflow = await readProjectFile("rules/question-input-workflow.md")
    const artifact = await readProjectFile("rules/question-artifact-contract.md")
    const skill = await readProjectFile("skills/explain-question/SKILL.md")

    expect(workflow).toContain("会话文本")
    expect(workflow).toContain("外部文件")
    expect(workflow).toContain("QuestionArtifact")
    expect(workflow).toContain("确认门控")
    expect(artifact).toContain("layoutType")
    expect(artifact).toContain("completeness")
    expect(artifact).toContain("确认门控")
    expect(skill).toContain("QuestionArtifact")
  })

  it("requires QuestionArtifact as a gate in the orchestrator question route", async () => {
    const orchestrator = await readProjectFile("agents/orchestrator.md")

    expect(orchestrator).toContain("QuestionArtifact")
    expect(orchestrator).toContain("题目输入工作流")
    expect(orchestrator).toContain("确认门控")
    expect(orchestrator).toMatch(/题目.*QuestionArtifact|QuestionArtifact.*题目/)
  })
})
