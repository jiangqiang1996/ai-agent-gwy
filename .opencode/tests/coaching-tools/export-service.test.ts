import { readFile } from "node:fs/promises"
import { afterEach, describe, expect, it } from "vitest"

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

describe("export service", () => {
  it("writes markdown output under output/ with a safe relative path", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      format: "markdown",
      title: "知识点总结",
      content: "# 标题\n\n内容",
    })

    expect(result.relativePath.startsWith("output/")).toBe(true)
    await expect(readFile(result.absolutePath, "utf8")).resolves.toContain("# 标题")
  })

  it("wraps html output in a static document shell", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      format: "html",
      title: "复杂排版题面",
      content: "第一段\n第二段",
    })

    const html = await readFile(result.absolutePath, "utf8")
    expect(result.relativePath.endsWith(".html")).toBe(true)
    expect(html).toContain("<!doctype html>")
    expect(html).toContain("复杂排版题面")
  })

  it("falls back to a safe filename when the title is empty", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      format: "markdown",
      title: "   ",
      content: "content",
    })

    expect(result.relativePath).toMatch(/^output\/export-/)
  })

  it("does not overwrite when exporting the same title twice", async () => {
    const worktree = await withWorktree()

    const first = await exportDocument(worktree, {
      format: "markdown",
      title: "同名文档",
      content: "first",
    })
    const second = await exportDocument(worktree, {
      format: "markdown",
      title: "同名文档",
      content: "second",
    })

    expect(first.relativePath).not.toBe(second.relativePath)
  })

  it("rejects empty export content", async () => {
    const worktree = await withWorktree()

    await expect(exportDocument(worktree, {
      format: "markdown",
      title: "空内容",
      content: "   ",
    })).rejects.toThrow("导出内容不能为空")
  })

  it("rejects path traversal and reserved filenames", async () => {
    const worktree = await withWorktree()

    await expect(exportDocument(worktree, {
      format: "markdown",
      title: "../escape",
      content: "content",
    })).rejects.toThrow("路径分隔符")

    await expect(exportDocument(worktree, {
      format: "markdown",
      title: "CON",
      content: "content",
    })).rejects.toThrow("系统保留名称")
  })

  it("renders markdown headings as HTML with IDs", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      format: "html",
      title: "标题测试",
      content: "## 数量关系\n\n### 基础题型",
    })

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain('<h2 id="数量关系">')
    expect(html).toContain('<h3 id="基础题型">')
  })

  it("generates TOC from headings", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      format: "html",
      title: "TOC测试",
      content: "## 第一节\n\n### 小节A\n\n## 第二节",
    })

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain('<nav class="toc">')
    expect(html).toContain("第一节")
    expect(html).toContain("第二节")
  })

  it("renders mermaid code block as mermaid container", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      format: "html",
      title: "Mermaid测试",
      content: "```mermaid\ngraph TD\n    A-->B\n```",
    })

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain('<pre class="mermaid">')
  })

  it("renders chart code block as canvas element", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      format: "html",
      title: "Chart测试",
      content: '```chart\n{"type":"bar","data":{"labels":["A"],"datasets":[{"label":"X","data":[1]}]}}\n```',
    })

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain('<canvas id="chart-0"')
  })

  it("preserves KaTeX formula in HTML output", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      format: "html",
      title: "公式测试",
      content: "公式 $E=mc^2$ 测试",
    })

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("katex")
  })

  it("preserves HTML passthrough elements (details)", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      format: "html",
      title: "HTML透传",
      content: "<details>\n<summary>题目</summary>\n\n答案\n\n</details>",
    })

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("<details>")
    expect(html).toContain("<summary>")
  })
})
