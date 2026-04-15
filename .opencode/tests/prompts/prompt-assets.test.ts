import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function readPromptAsset(relativePath: string): Promise<string> {
  const filePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFile(filePath, "utf8")
}

describe("prompt assets", () => {
  it("ships the shared rules required by the new prompt architecture", async () => {
    await expect(readPromptAsset("rules/exam-context.md")).resolves.toContain("考试上下文共享规则")
    await expect(readPromptAsset("rules/champion-routing.md")).resolves.toContain("状元路由共享规则")
    await expect(readPromptAsset("rules/summary-first-workflow.md")).resolves.toContain("总结优先工作流")
    await expect(readPromptAsset("rules/export-workflow.md")).resolves.toContain("导出工作流共享规则")
    await expect(readPromptAsset("rules/output-format.md")).resolves.toContain("输出格式共享规则")
    await expect(readPromptAsset("rules/prompt-authoring.md")).resolves.toContain("提示词编写规则")
  })

  it("removes duplicated exam-context blocks from specialist teacher prompts", async () => {
    const teacherFiles = [
      "agents/xingce-zong-teacher.md",
      "agents/xingce-yanyu-teacher.md",
      "agents/xingce-shuliang-teacher.md",
      "agents/xingce-panduan-teacher.md",
      "agents/xingce-ziliao-teacher.md",
      "agents/xingce-changshi-teacher.md",
      "agents/xingce-zhengzhi-teacher.md",
    ]

    for (const teacherFile of teacherFiles) {
      const content = await readPromptAsset(teacherFile)
      expect(content).not.toContain("## 考试类型与地区感知")
    }
  })

  it("updates orchestrator to consume summary-first and champion-routing rules", async () => {
    const content = await readPromptAsset("agents/orchestrator.md")

    expect(content).toContain("共享规则选中的状元代理")
    expect(content).toContain(".opencode/rules/champion-routing.md")
    expect(content).toContain(".opencode/rules/summary-first-workflow.md")
    expect(content).toContain("截图题目讲解遵循")
    expect(content).toContain("身份=[用户identity]")
    expect(content).toContain("QuestionArtifact")
  })

  it("ensures specialist teacher prompts follow summary-first framing without 出题原则 sections", async () => {
    const teacherFiles = [
      { file: "agents/xingce-yanyu-teacher.md", name: "言语" },
      { file: "agents/xingce-shuliang-teacher.md", name: "数量" },
      { file: "agents/xingce-panduan-teacher.md", name: "判断" },
      { file: "agents/xingce-ziliao-teacher.md", name: "资料" },
      { file: "agents/xingce-changshi-teacher.md", name: "常识" },
      { file: "agents/xingce-zhengzhi-teacher.md", name: "政治" },
      { file: "agents/xingce-zong-teacher.md", name: "行测总" },
    ]

    for (const { file, name } of teacherFiles) {
      const content = await readPromptAsset(file)
      expect(content).not.toContain("## 出题原则")
      expect(content).toContain("总结优先")
      expect(content).toContain("截图响应")
    }
  })

  it("keeps the political theory prompt typo fixed", async () => {
    const content = await readPromptAsset("agents/xingce-zhengzhi-teacher.md")

    expect(content).toContain("中国特色社会主义理论体系")
    expect(content).not.toContain("主度理论体系")
  })
})
