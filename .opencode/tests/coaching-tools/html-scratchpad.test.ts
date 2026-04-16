import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { readFile } from "node:fs/promises"
import { afterEach, describe, expect, it } from "vitest"

import { renderToHtmlBundle } from "../../plugins/coaching-tools/services/html-pipeline.js"
import { exportDocument } from "../../plugins/coaching-tools/services/export-service.js"
import { cleanupTempWorktree, createTempWorktree } from "../setup/temp-worktree.js"

const worktrees: string[] = []

afterEach(async () => {
  while (worktrees.length > 0) {
    const worktree = worktrees.pop()
    if (worktree) await cleanupTempWorktree(worktree)
  }
})

async function withWorktree(): Promise<string> {
  const worktree = await createTempWorktree()
  worktrees.push(worktree)
  return worktree
}

async function renderToHtml(worktree: string, content: string, title: string) {
  const outputDir = join(worktree, "output")
  await mkdir(outputDir, { recursive: true })
  return renderToHtmlBundle(worktree, outputDir, content, title)
}

describe("scratchpad", () => {
  it("includes scratchpad CSS and JS when data-exam-question markers present", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, "<section data-exam-question>\n**题目：** 测试\n\nA. 选项一\nB. 选项二\n</section>", "涂鸦测试")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("scratchpad-overlay")
    expect(html).toContain("scratchpad-controls")
    expect(html).toContain("scratchpad-btn")
    expect(html).toContain("[data-exam-question]")
    expect(html).toContain("pointerdown")
    expect(html).toContain("setPointerCapture")
    expect(html).toContain("devicePixelRatio")
  })

  it("supports multiple independent question regions", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, [
      "<section data-exam-question>",
      "题目一",
      "</section>",
      "",
      "<section data-exam-question>",
      "题目二",
      "</section>",
    ].join("\n"), "多题涂鸦")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("scratchpad-overlay")
    expect(html).toContain("querySelectorAll")
    const markerCount = (html.match(/<section[^>]*data-exam-question/g) || []).length
    expect(markerCount).toBe(2)
  })

  it("does not include scratchpad when no markers present", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, "普通内容，没有题目区域标记", "无涂鸦")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).not.toContain("scratchpad-overlay")
    expect(html).not.toContain("scratchpad-controls")
    expect(html).not.toContain("scratchpad-btn")
    expect(html).not.toContain("[data-exam-question]")
  })

  it("resolves nested markers to one overlay per top-level region", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, [
      "<section data-exam-question>",
      "外层题目",
      "<div data-exam-question>内层内容</div>",
      "</section>",
    ].join("\n"), "嵌套标记")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("scratchpad-overlay")
    expect(html).toContain("parentElement")
    expect(html).toContain("hasAttribute")
    const outerCount = (html.match(/<section[^>]*data-exam-question/g) || []).length
    expect(outerCount).toBe(1)
    const innerCount = (html.match(/<div[^>]*data-exam-question/g) || []).length
    expect(innerCount).toBe(1)
  })

  it("wraps each region init in try-catch for error isolation", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, "<section data-exam-question>\n题目\n</section>", "错误隔离")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("scratchpad-overlay")
    const spIdx = html.indexOf("scratchpad-overlay")
    const spSection = html.slice(spIdx, spIdx + 3000)
    expect(spSection).toMatch(/try\s*\{/)
    expect(spSection).toMatch(/catch\s*\(/)
  })

  it("does not use browser storage APIs in scratchpad script", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, "<section data-exam-question>\n题目\n</section>", "无持久化")

    const html = await readFile(result.absolutePath, "utf8")
    const scriptMatches = html.match(/<script>[\s\S]*?<\/script>/g)
    expect(scriptMatches).toBeTruthy()
    const scratchpadScript = scriptMatches!.find((s) => s.includes("scratchpad-overlay"))
    expect(scratchpadScript).toBeTruthy()
    expect(scratchpadScript!).not.toContain("localStorage")
    expect(scratchpadScript!).not.toContain("sessionStorage")
    expect(scratchpadScript!).not.toContain("IndexedDB")
    expect(scratchpadScript!).not.toContain("document.cookie")
  })

  it("coexists with mermaid, charts, and markmap in marked regions", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, [
      "<section data-exam-question>",
      "",
      "```mermaid",
      "graph TD",
      "  A-->B",
      "```",
      "",
      '```chart\n{"type":"bar","data":{"labels":["A"],"datasets":[{"label":"X","data":[1]}]}}\n```',
      "",
      "</section>",
    ].join("\n"), "混合功能")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("scratchpad-overlay")
    expect(html).toContain("mermaid")
    expect(html).toContain("data-chart")
  })

  it("works with div data-exam-question markers", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, "<div data-exam-question>\n**题目**\n</div>", "DIV标记")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("scratchpad-overlay")
    expect(html).toContain("scratchpad-controls")
  })

  it("does not include scratchpad CSS in style tag when no markers present", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, "## 标题\n\n普通段落", "纯文本无涂鸦")

    const html = await readFile(result.absolutePath, "utf8")
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/)
    expect(styleMatch).toBeTruthy()
    expect(styleMatch![1]).not.toContain("scratchpad-overlay")
    expect(styleMatch![1]).not.toContain("[data-exam-question]")
  })

  it("includes scratchpad CSS in style tag when markers present", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, "<section data-exam-question>\n题目\n</section>", "CSS验证")

    const html = await readFile(result.absolutePath, "utf8")
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/)
    expect(styleMatch).toBeTruthy()
    expect(styleMatch![1]).toContain("[data-exam-question]")
    expect(styleMatch![1]).toContain("scratchpad-overlay")
    expect(styleMatch![1]).toContain("scratchpad-controls")
    expect(styleMatch![1]).toContain("scratchpad-btn")
  })

  it("overlay canvas has pointer-events none when inactive", async () => {
    const worktree = await withWorktree()

    const result = await renderToHtml(worktree, "<section data-exam-question>\n题目\n</section>", "交互隔离")

    const html = await readFile(result.absolutePath, "utf8")
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/)
    expect(styleMatch).toBeTruthy()
    expect(styleMatch![1]).toContain("pointer-events: none")
    expect(styleMatch![1]).toContain("scratchpad-overlay.active")
    expect(styleMatch![1]).toContain("pointer-events: auto")
  })

  it("does not affect markdown export with markers", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      title: "MD涂鸦",
      content: "<section data-exam-question>\n题目\n</section>",
    })

    const content = await readFile(result.absolutePath, "utf8")
    expect(result.relativePath.endsWith(".md")).toBe(true)
    expect(content).toContain("data-exam-question")
    expect(content).not.toContain("scratchpad")
    expect(result.assetDir).toBeUndefined()
  })
})
