import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

describe("opencode config compatibility", () => {
  it("keeps shared rules loaded and registers the new agents", async () => {
    const configPath = fileURLToPath(new URL("../../../opencode.json", import.meta.url))
    const config = JSON.parse(await readFile(configPath, "utf8")) as {
      instructions?: string[]
      agent?: Record<string, { tools?: Record<string, boolean> }>
    }

    expect(config.instructions).toContain(".opencode/rules/**/*.md")
    expect(config.agent?.orchestrator?.tools?.["user-profile"]).toBe(true)
    expect(config.agent?.orchestrator?.tools?.["export-document"]).toBe(true)
    expect(config.agent?.orchestrator?.tools?.grading).toBe(true)
    expect(config.agent?.orchestrator?.tools?.["question-generator"]).toBe(true)
    expect(config.agent?.orchestrator?.tools?.timer).toBeUndefined()
    expect(config.agent?.orchestrator?.tools?.points).toBeUndefined()
    expect(config.agent?.orchestrator?.tools?.["attempt-repository"]).toBeUndefined()
    expect(config.agent?.["guokao-working-champion"]).toBeDefined()
    expect(config.agent?.["guokao-campus-champion"]).toBeDefined()
    expect(config.agent?.["shengkao-working-champion"]).toBeDefined()
    expect(config.agent?.["shengkao-campus-champion"]).toBeDefined()
    expect(config.agent?.["xingce-kexue-teacher"]).toBeDefined()
    expect(config.agent?.["shenlun-zong-teacher"]).toBeDefined()
    expect(config.agent?.["guokao-champion"]).toBeUndefined()
    expect(config.agent?.["chongqing-champion"]).toBeUndefined()
  })
})
