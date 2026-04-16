import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { exportDocument } from "../../plugins/coaching-tools/services/export-service.js"
import { renderToHtmlBundle } from "../../plugins/coaching-tools/services/html-pipeline.js"
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

describe("export service (markdown)", () => {
  it("writes markdown output under output/ with a safe relative path", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      title: "知识点总结",
      content: "# 标题\n\n内容",
    })

    expect(result.relativePath.startsWith("output/")).toBe(true)
    await expect(readFile(result.absolutePath, "utf8")).resolves.toContain("# 标题")
    expect(result.assetDir).toBeUndefined()
  })

  it("falls back to a safe filename when the title is empty", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      title: "   ",
      content: "content",
    })

    expect(result.relativePath).toMatch(/^output\/export-/)
  })

  it("does not overwrite when exporting the same title twice", async () => {
    const worktree = await withWorktree()

    const first = await exportDocument(worktree, {
      title: "同名文档",
      content: "first",
    })
    const second = await exportDocument(worktree, {
      title: "同名文档",
      content: "second",
    })

    expect(first.relativePath).not.toBe(second.relativePath)
  })

  it("rejects empty export content", async () => {
    const worktree = await withWorktree()

    await expect(exportDocument(worktree, {
      title: "空内容",
      content: "   ",
    })).rejects.toThrow("导出内容不能为空")
  })

  it("rejects path traversal and reserved filenames", async () => {
    const worktree = await withWorktree()

    await expect(exportDocument(worktree, {
      title: "../escape",
      content: "content",
    })).rejects.toThrow("路径分隔符")

    await expect(exportDocument(worktree, {
      title: "CON",
      content: "content",
    })).rejects.toThrow("系统保留名称")
  })

  it("markdown export does not trigger HTML asset validation", async () => {
    const worktree = await withWorktree()

    const result = await exportDocument(worktree, {
      title: "MD无验证",
      content: "![不存在](no-such-file.png)\n\n$E=mc^2$\n\n```mermaid\ngraph TD\n  A-->B\n```",
    })

    expect(result.relativePath.endsWith(".md")).toBe(true)
    expect(result.assetDir).toBeUndefined()
    const content = await readFile(result.absolutePath, "utf8")
    expect(content).toContain("![不存在](no-such-file.png)")
  })
})

describe("html pipeline (renderToHtmlBundle)", () => {
  it("wraps html output in a static document shell", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "第一段\n第二段", "复杂排版题面")

    const html = await readFile(result.absolutePath, "utf8")
    expect(result.relativePath.endsWith(".html")).toBe(true)
    expect(html).toContain("<!doctype html>")
    expect(html).toContain("复杂排版题面")
  })

  it("renders markdown headings as HTML with IDs", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "## 数量关系\n\n### 基础题型", "标题测试")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain('<h2 id="数量关系">')
    expect(html).toContain('<h3 id="基础题型">')
  })

  it("generates TOC from headings", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "## 第一节\n\n### 小节A\n\n## 第二节", "TOC测试")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain('<nav class="toc">')
    expect(html).toContain("第一节")
    expect(html).toContain("第二节")
  })

  it("renders mermaid code block as mermaid container", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "```mermaid\ngraph TD\n    A-->B\n```", "Mermaid测试")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain('<pre class="mermaid">')
  })

  it("renders chart code block as canvas element", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, '```chart\n{"type":"bar","data":{"labels":["A"],"datasets":[{"label":"X","data":[1]}]}}\n```', "Chart测试")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain('<canvas id="chart-0"')
  })

  it("references local images from asset directory instead of inlining", async () => {
    const worktree = await withWorktree()
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0p2iQAAAAASUVORK5CYII=",
      "base64",
    )

    await mkdir(join(worktree, "fixtures"), { recursive: true })
    await writeFile(join(worktree, "fixtures", "question.png"), pngBytes)
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "![题图](fixtures/question.png)", "题图测试")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).not.toContain("data:image/png;base64,")
    expect(html).not.toContain('src="fixtures/question.png"')
    expect(html).toMatch(/src="\.\/[^"]*-assets\/content\//)

    expect(result.assetDir).toBeDefined()
    const contentDir = join(result.assetDir!.absolutePath, "content")
    const dirStat = await stat(contentDir)
    expect(dirStat.isDirectory()).toBe(true)

    const entries = await readdir(contentDir, { recursive: true })
    const found = entries.some((e) => e.toString().endsWith("question.png"))
    expect(found).toBe(true)
  })

  it("renders markmap blocks for knowledge maps", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "```markmap\n# 判断推理\n## 图形推理\n## 逻辑判断\n```", "图谱测试")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain('class="markmap-container"')
    expect(html).toContain('data-markmap="')
    expect(html).toContain("window.markmap")
  })

  it("preserves KaTeX formula in HTML output", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "公式 $E=mc^2$ 测试", "公式测试")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("katex")
  })

  it("preserves HTML passthrough elements (details)", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "<details>\n<summary>题目</summary>\n\n答案\n\n</details>", "HTML透传")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("<details>")
    expect(html).toContain("<summary>")
  })

  it("keeps canvas payload encoded out of inline script context", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "```canvas\nctx.fillRect(10,10,50,50); //</script><script>alert(1)</script>\n```", "Canvas安全")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("data-canvas-script=")
    expect(html).not.toContain("</script><script>alert(1)</script>")
  })

  it("references runtime assets from sibling asset directory instead of inlining", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, [
      "## 图表与图谱",
      "",
      "公式 $E=mc^2$",
      "",
      "```mermaid",
      "graph TD",
      "  A --> B",
      "```",
      "",
      "```chart",
      '{"type":"bar","data":{"labels":["A"],"datasets":[{"label":"X","data":[1]}]}}',
      "```",
      "",
      "```markmap",
      "# 行测",
      "## 判断推理",
      "```",
    ].join("\n"), "离线资源")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).not.toContain('src="https://')
    expect(html).not.toContain('href="https://')
    expect(html).not.toContain("data:font/woff2;base64,")
    expect(html).toContain('<script src="./')
    expect(html).toContain('<link rel="stylesheet" href="./')

    expect(result.assetDir).toBeDefined()
    const runtimeDir = join(result.assetDir!.absolutePath, "runtime")
    const runtimeStat = await stat(runtimeDir)
    expect(runtimeStat.isDirectory()).toBe(true)

    const runtimeEntries = await readdir(runtimeDir, { recursive: true })
    expect(runtimeEntries.length).toBeGreaterThan(0)
  })

  it("refuses to write HTML when a referenced local image is missing", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    await expect(
      renderToHtmlBundle(worktree, outputDir, "![缺失图片](nonexistent-image.png)", "缺失资源"),
    ).rejects.toThrow("资源验证失败")

    let hasHtmlFiles = false
    try {
      const dir = await stat(outputDir)
      if (dir.isDirectory()) {
        const files = await readdir(outputDir)
        hasHtmlFiles = files.some((f) => f.endsWith(".html"))
      }
    } catch {
    }
    expect(hasHtmlFiles).toBe(false)
  })

  it("writes HTML plus sibling asset directory as a bundle", async () => {
    const worktree = await withWorktree()
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0p2iQAAAAASUVORK5CYII=",
      "base64",
    )
    await mkdir(join(worktree, "img"), { recursive: true })
    await writeFile(join(worktree, "img", "diagram.png"), pngBytes)
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "## 带 Mermaid 和图片\n\n```mermaid\ngraph TD\n  A-->B\n```\n\n![图](img/diagram.png)", "Bundle测试")

    expect(result.assetDir).toBeDefined()
    const htmlStat = await stat(result.absolutePath)
    expect(htmlStat.isFile()).toBe(true)

    const assetStat = await stat(result.assetDir!.absolutePath)
    expect(assetStat.isDirectory()).toBe(true)

    const htmlRel = result.relativePath
    const assetRel = result.assetDir!.relativePath
    expect(htmlRel.endsWith(".html")).toBe(true)
    expect(assetRel.endsWith("-assets")).toBe(true)
    expect(assetRel).toMatch(new RegExp(`^${htmlRel.replace(".html", "-assets")}$`))

    const runtimeDir = join(result.assetDir!.absolutePath, "runtime")
    const runtimeStat = await stat(runtimeDir)
    expect(runtimeStat.isDirectory()).toBe(true)

    const contentDir = join(result.assetDir!.absolutePath, "content")
    const contentStat = await stat(contentDir)
    expect(contentStat.isDirectory()).toBe(true)
  })

  it("skips asset directory when no runtime features or local images are needed", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "这是一段纯文本内容，没有图表、公式或图片。", "纯文本")

    expect(result.assetDir).toBeUndefined()
    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("<!doctype html>")
    expect(html).not.toContain('<script src="./')
    expect(html).not.toContain('<link rel="stylesheet" href="./')
  })

  it("does not emit inline data URLs by default", async () => {
    const worktree = await withWorktree()
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0p2iQAAAAASUVORK5CYII=",
      "base64",
    )
    await mkdir(join(worktree, "pics"), { recursive: true })
    await writeFile(join(worktree, "pics", "a.png"), pngBytes)
    await writeFile(join(worktree, "pics", "b.png"), pngBytes)
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "![a](pics/a.png)\n\n![b](pics/b.png)", "无内联")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).not.toMatch(/src="data:/)
    expect(html).not.toMatch(/href="data:/)
  })

  it("cleans up staged files on bundle failure", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    await expect(
      renderToHtmlBundle(worktree, outputDir, "![不存在](no-such-file.png)", "失败清理"),
    ).rejects.toThrow("资源验证失败")

    const files = await readdir(outputDir)
    const htmlFiles = files.filter((f) => f.endsWith(".html"))
    const assetDirs = files.filter((f) => f.endsWith("-assets"))
    expect(htmlFiles.length).toBe(0)
    expect(assetDirs.length).toBe(0)
  })

  it("repeated exports maintain consistent html plus asset dir contract", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const first = await renderToHtmlBundle(worktree, outputDir, "```mermaid\ngraph TD\n  A-->B\n```", "重复导出")
    const second = await renderToHtmlBundle(worktree, outputDir, "```mermaid\ngraph TD\n  C-->D\n```", "重复导出")

    for (const result of [first, second]) {
      expect(result.assetDir).toBeDefined()
      expect(result.relativePath.endsWith(".html")).toBe(true)
      expect(result.assetDir!.relativePath.endsWith("-assets")).toBe(true)
      const html = await readFile(result.absolutePath, "utf8")
      expect(html).toContain('<script src="./')
    }

    expect(first.relativePath).not.toBe(second.relativePath)
  })

  it("includes scratchpad hooks when data-exam-question markers exist", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "<section data-exam-question>\n**题目：** 测试\n\nA. 选项一\nB. 选项二\n</section>", "涂鸦集成")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("scratchpad-overlay")
    expect(html).toContain("[data-exam-question]")
    expect(html).toContain("pointerdown")
  })

  it("omits scratchpad hooks when no markers exist", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "## 标题\n\n普通段落内容", "无涂鸦集成")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).not.toContain("scratchpad")
  })

  it("omits scratchpad CSS and JS for documents without data-exam-question markers", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "## 数量关系\n\n### 基础题型\n\n公式 $E=mc^2$\n\n```mermaid\ngraph TD\n  A-->B\n```", "无涂鸦资源")

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).not.toContain("scratchpad-overlay")
    expect(html).not.toContain("scratchpad-controls")
    expect(html).not.toContain("pointerdown")
    expect(html).not.toContain("spSetup")

    expect(result.assetDir).toBeDefined()
    const runtimeDir = join(result.assetDir!.absolutePath, "runtime")
    const runtimeEntries = await readdir(runtimeDir, { recursive: true })
    const scratchpadFiles = runtimeEntries.filter((e) =>
      e.toString().includes("scratchpad"),
    )
    expect(scratchpadFiles.length).toBe(0)
  })

  it("deduplicates repeated local image references into a single asset copy", async () => {
    const worktree = await withWorktree()
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0p2iQAAAAASUVORK5CYII=",
      "base64",
    )
    await mkdir(join(worktree, "shared"), { recursive: true })
    await writeFile(join(worktree, "shared", "icon.png"), pngBytes)
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, [
      "![图标](shared/icon.png)",
      "",
      "段落中间再次引用:",
      "",
      "![同一个图标](shared/icon.png)",
    ].join("\n"), "去重测试")

    expect(result.assetDir).toBeDefined()
    const contentDir = join(result.assetDir!.absolutePath, "content")
    const entries = await readdir(contentDir, { recursive: true })
    const iconFiles = entries.filter((e) => e.toString().includes("icon.png"))
    expect(iconFiles.length).toBe(1)

    const html = await readFile(result.absolutePath, "utf8")
    const imgMatches = html.match(/<img\b[^>]*\bsrc=/g)
    expect(imgMatches).toHaveLength(2)

    const srcMatches = html.match(/src="\.\/[^"]*-assets\/content\/shared\/icon\.png"/g)
    expect(srcMatches).toHaveLength(2)
  })

  it("end-to-end smoke: export, verify output tree and relative resource paths", async () => {
    const worktree = await withWorktree()
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0p2iQAAAAASUVORK5CYII=",
      "base64",
    )
    await mkdir(join(worktree, "assets"), { recursive: true })
    await writeFile(join(worktree, "assets", "photo.png"), pngBytes)
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, [
      "## 综合测试",
      "",
      "公式 $x^2 + y^2 = r^2$",
      "",
      "```mermaid",
      "graph TD",
      "  X-->Y",
      "```",
      "",
      "![照片](assets/photo.png)",
    ].join("\n"), "E2E冒烟")

    expect(result.relativePath.startsWith("output/")).toBe(true)
    expect(result.relativePath.endsWith(".html")).toBe(true)

    expect(result.assetDir).toBeDefined()
    expect(result.assetDir!.relativePath.startsWith("output/")).toBe(true)
    expect(result.assetDir!.relativePath.endsWith("-assets")).toBe(true)

    const htmlRelStem = result.relativePath.replace(".html", "")
    const assetRelStem = result.assetDir!.relativePath
    expect(assetRelStem).toBe(`${htmlRelStem}-assets`)

    const htmlStat = await stat(result.absolutePath)
    expect(htmlStat.isFile()).toBe(true)
    const assetStat = await stat(result.assetDir!.absolutePath)
    expect(assetStat.isDirectory()).toBe(true)

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).toContain("<!doctype html>")
    expect(html).toContain('<script src="./')
    expect(html).toContain('<link rel="stylesheet" href="./')
    expect(html).not.toContain("data:image/png;base64,")

    const runtimeDir = join(result.assetDir!.absolutePath, "runtime")
    const runtimeStat = await stat(runtimeDir)
    expect(runtimeStat.isDirectory()).toBe(true)
    const runtimeEntries = await readdir(runtimeDir, { recursive: true })
    expect(runtimeEntries.length).toBeGreaterThan(0)

    const contentDir = join(result.assetDir!.absolutePath, "content")
    const contentEntries = await readdir(contentDir, { recursive: true })
    expect(contentEntries.some((e) => e.toString().includes("photo.png"))).toBe(true)
  })

  it("plain text export produces no asset directory and no runtime references", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, "普通段落文字，无图表无公式无图片。", "纯文字")

    expect(result.assetDir).toBeUndefined()

    const html = await readFile(result.absolutePath, "utf8")
    expect(html).not.toContain('<script src="./')
    expect(html).not.toContain('<link rel="stylesheet" href="./')
    expect(html).not.toContain("data:")
    expect(html).not.toContain("scratchpad")

    const outputEntries = await readdir(outputDir)
    const assetDirs = outputEntries.filter((e) => e.includes("-assets"))
    expect(assetDirs.length).toBe(0)
  })

  it("HTML runtime references resolve to actual files on disk", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    const result = await renderToHtmlBundle(worktree, outputDir, [
      "## 综合",
      "",
      "公式 $E=mc^2$",
      "",
      "```mermaid",
      "graph TD",
      "  A-->B",
      "```",
      "",
      "```chart",
      '{"type":"bar","data":{"labels":["A"],"datasets":[{"label":"X","data":[1]}]}}',
      "```",
      "",
      "```markmap",
      "# 行测",
      "## 言语",
      "```",
    ].join("\n"), "运行时路径一致性")

    expect(result.assetDir).toBeDefined()
    const html = await readFile(result.absolutePath, "utf8")

    const refPattern = /(?:src|href)="(\.\/[^"]*-assets\/runtime\/[^"]+)"/g
    const refs: string[] = []
    let match: RegExpExecArray | null
    while ((match = refPattern.exec(html)) !== null) {
      refs.push(match[1])
    }
    expect(refs.length).toBeGreaterThan(0)

    const runtimeDir = join(result.assetDir!.absolutePath, "runtime")

    for (const ref of refs) {
      const relAfterRuntime = ref.replace(/^\.\/[^/]+-assets\/runtime\//, "")
      const absPath = join(runtimeDir, relAfterRuntime)
      const fileStat = await stat(absPath)
      expect(fileStat.isFile()).toBe(true)
    }
  })

  it("rejects empty content", async () => {
    const worktree = await withWorktree()
    const outputDir = join(worktree, "output")
    await mkdir(outputDir, { recursive: true })

    await expect(
      renderToHtmlBundle(worktree, outputDir, "   ", "空内容"),
    ).rejects.toThrow("导出内容不能为空")
  })
})
