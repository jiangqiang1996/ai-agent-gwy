import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function readPromptAsset(relativePath: string): Promise<string> {
  const filePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFile(filePath, "utf8")
}

describe("champion routing rules", () => {
  it("defines identity-aware and region-aware routing in one shared rule file", async () => {
    const content = await readPromptAsset("rules/champion-routing.md")

    expect(content).toContain("identity` 为 `working`")
    expect(content).toContain("identity` 为 `campus`")
    expect(content).toContain("shengkao` 且存在 `region`")
    expect(content).toContain("shiyedanwei")
  })

  it("ships the four static champion skeleton prompts", async () => {
    await expect(readPromptAsset("agents/guokao-working-champion.md")).resolves.toContain("在职国考状元")
    await expect(readPromptAsset("agents/guokao-campus-champion.md")).resolves.toContain("应届国考状元")
    await expect(readPromptAsset("agents/shengkao-working-champion.md")).resolves.toContain("在职省考状元")
    await expect(readPromptAsset("agents/shengkao-campus-champion.md")).resolves.toContain("应届省考状元")
  })
})
