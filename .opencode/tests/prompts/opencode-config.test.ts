import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

describe("opencode config compatibility", () => {
  it("keeps shared rules loaded and documents the custom-tool compatibility exception", async () => {
    const configPath = fileURLToPath(new URL("../../../opencode.json", import.meta.url))
    const config = JSON.parse(await readFile(configPath, "utf8")) as {
      instructions?: string[]
      agent?: Record<string, { tools?: Record<string, boolean> }>
    }

    expect(config.instructions).toContain(".opencode/rules/**/*.md")
    expect(config.agent?.orchestrator?.tools?.["user-profile"]).toBe(true)
    expect(config.agent?.orchestrator?.tools?.timer).toBe(true)
    expect(config.agent?.orchestrator?.tools?.grading).toBe(true)
    expect(config.agent?.orchestrator?.tools?.["question-generator"]).toBe(true)
    expect(config.agent?.orchestrator?.tools?.points).toBe(true)
  })
})
