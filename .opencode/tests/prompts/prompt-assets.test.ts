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
    await expect(readPromptAsset("rules/practice-lifecycle.md")).resolves.toContain("attempt-backed")
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

  it("updates orchestrator to the attempt-backed practice flow", async () => {
    const content = await readPromptAsset("agents/orchestrator.md")

    expect(content).toContain("attemptId")
    expect(content).toContain("epoch")
    expect(content).toContain("不再对同一题额外调用 user-profile updateMastery")
  })

  it("keeps the political theory prompt typo fixed", async () => {
    const content = await readPromptAsset("agents/xingce-zhengzhi-teacher.md")

    expect(content).toContain("中国特色社会主义理论体系")
    expect(content).not.toContain("主度理论体系")
  })
})
