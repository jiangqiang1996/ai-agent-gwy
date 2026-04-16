import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

import { inlineHtmlResources } from "../../plugins/coaching-tools/services/inline-html-resources-service.js"
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

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0p2iQAAAAASUVORK5CYII=",
  "base64",
)

describe("inline-html-resources service", () => {
  it("inlines local images and writes sibling -inlined.html while preserving original", async () => {
    const worktree = await withWorktree()
    const htmlDir = join(worktree, "output")
    await mkdir(htmlDir, { recursive: true })
    await mkdir(join(worktree, "pics"), { recursive: true })
    await writeFile(join(worktree, "pics", "a.png"), PNG_1PX)

    const html = `<!doctype html><html><body><img src="${join(worktree, "pics", "a.png").replace(/\\/g, "/")}"></body></html>`
    const htmlPath = join(htmlDir, "test.html")
    await writeFile(htmlPath, html, "utf8")

    const result = await inlineHtmlResources(htmlPath, {
      allowedRoots: [htmlDir, worktree],
    })

    expect(result.inlinedPath).toMatch(/-inlined\.html$/)
    expect(result.originalPath).toBe(htmlPath)

    const original = await readFile(htmlPath, "utf8")
    expect(original).toBe(html)

    const inlined = await readFile(result.inlinedPath, "utf8")
    expect(inlined).toContain("data:image/png;base64,")
    expect(inlined).not.toContain("pics/a.png")
  })

  it("inlines repeated references without re-validating", async () => {
    const worktree = await withWorktree()
    const htmlDir = join(worktree, "output")
    await mkdir(htmlDir, { recursive: true })
    await mkdir(join(worktree, "img"), { recursive: true })
    await writeFile(join(worktree, "img", "dot.png"), PNG_1PX)

    const imgPath = join(worktree, "img", "dot.png").replace(/\\/g, "/")
    const html = `<!doctype html><html><body><img src="${imgPath}"><p>again:</p><img src="${imgPath}"></body></html>`
    const htmlPath = join(htmlDir, "dup.html")
    await writeFile(htmlPath, html, "utf8")

    const result = await inlineHtmlResources(htmlPath, {
      allowedRoots: [htmlDir, worktree],
    })

    const inlined = await readFile(result.inlinedPath, "utf8")
    const matches = inlined.match(/data:image\/png;base64,/g)
    expect(matches).toHaveLength(2)
  })

  it("preserves existing data: URLs and only processes referenced resources", async () => {
    const worktree = await withWorktree()
    const htmlDir = join(worktree, "output")
    await mkdir(htmlDir, { recursive: true })
    await mkdir(join(worktree, "img"), { recursive: true })
    await writeFile(join(worktree, "img", "local.png"), PNG_1PX)

    const existingDataUrl = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
    const localPath = join(worktree, "img", "local.png").replace(/\\/g, "/")
    const html = `<!doctype html><html><body><img src="${existingDataUrl}"><img src="${localPath}"></body></html>`
    const htmlPath = join(htmlDir, "mixed.html")
    await writeFile(htmlPath, html, "utf8")

    const result = await inlineHtmlResources(htmlPath, {
      allowedRoots: [htmlDir, worktree],
    })

    const inlined = await readFile(result.inlinedPath, "utf8")
    expect(inlined).toContain("data:image/gif;base64,")
    expect(inlined).toContain("data:image/png;base64,")
  })

  it("fails and writes no inlined output when a local file is missing", async () => {
    const worktree = await withWorktree()
    const htmlDir = join(worktree, "output")
    await mkdir(htmlDir, { recursive: true })

    const html = `<!doctype html><html><body><img src="nonexistent-file.png"></body></html>`
    const htmlPath = join(htmlDir, "missing.html")
    await writeFile(htmlPath, html, "utf8")

    await expect(
      inlineHtmlResources(htmlPath, {
        allowedRoots: [htmlDir, worktree],
      }),
    ).rejects.toThrow("资源验证失败")

    const files = await readdir(htmlDir)
    const inlinedFiles = files.filter((f) => f.includes("-inlined"))
    expect(inlinedFiles.length).toBe(0)
  })

  it("fails when a remote URL is unreachable", async () => {
    const worktree = await withWorktree()
    const htmlDir = join(worktree, "output")
    await mkdir(htmlDir, { recursive: true })

    const html = `<!doctype html><html><body><img src="https://127.0.0.1:1/unreachable-test-image.png"></body></html>`
    const htmlPath = join(htmlDir, "remote-fail.html")
    await writeFile(htmlPath, html, "utf8")

    await expect(
      inlineHtmlResources(htmlPath, {
        allowedRoots: [htmlDir, worktree],
        remoteTimeout: 500,
      }),
    ).rejects.toThrow("资源验证失败")

    const files = await readdir(htmlDir)
    const inlinedFiles = files.filter((f) => f.includes("-inlined"))
    expect(inlinedFiles.length).toBe(0)
  })

  it("inlines local CSS link as embedded style tag", async () => {
    const worktree = await withWorktree()
    const htmlDir = join(worktree, "output")
    await mkdir(htmlDir, { recursive: true })
    const cssContent = "body { color: red; }"
    await writeFile(join(htmlDir, "style.css"), cssContent, "utf8")

    const html = `<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><p>hello</p></body></html>`
    const htmlPath = join(htmlDir, "css-test.html")
    await writeFile(htmlPath, html, "utf8")

    const result = await inlineHtmlResources(htmlPath, {
      allowedRoots: [htmlDir, worktree],
    })

    const inlined = await readFile(result.inlinedPath, "utf8")
    expect(inlined).toContain("<style>")
    expect(inlined).toContain("color: red")
    expect(inlined).not.toContain('href="style.css"')
  })

  it("inlines local script src as inline script content", async () => {
    const worktree = await withWorktree()
    const htmlDir = join(worktree, "output")
    await mkdir(htmlDir, { recursive: true })
    const jsContent = 'console.log("hello");'
    await writeFile(join(htmlDir, "app.js"), jsContent, "utf8")

    const html = `<!doctype html><html><body><script src="app.js"></script></body></html>`
    const htmlPath = join(htmlDir, "js-test.html")
    await writeFile(htmlPath, html, "utf8")

    const result = await inlineHtmlResources(htmlPath, {
      allowedRoots: [htmlDir, worktree],
    })

    const inlined = await readFile(result.inlinedPath, "utf8")
    expect(inlined).toContain('console.log("hello")')
    expect(inlined).not.toContain('src="app.js"')
  })

  it("works end-to-end from exported HTML to inlined single file", async () => {
    const worktree = await withWorktree()
    await mkdir(join(worktree, "pics"), { recursive: true })
    await writeFile(join(worktree, "pics", "diagram.png"), PNG_1PX)

    const exportResult = await exportDocument(worktree, {
      format: "html",
      title: "内联E2E",
      content: "## 测试\n\n![图](pics/diagram.png)",
    })

    expect(exportResult.assetDir).toBeDefined()

    const inlineResult = await inlineHtmlResources(exportResult.absolutePath, {
      allowedRoots: [dirname(exportResult.absolutePath), worktree],
    })

    const inlined = await readFile(inlineResult.inlinedPath, "utf8")
    expect(inlined).toContain("data:image/png;base64,")
    expect(inlined).not.toContain("-assets/content/diagram.png")

    const original = await readFile(exportResult.absolutePath, "utf8")
    expect(original).toContain("-assets/content/")
  })

  it("leaves no -inlined.html artifact when remote validation fails", async () => {
    const worktree = await withWorktree()
    const htmlDir = join(worktree, "output")
    await mkdir(htmlDir, { recursive: true })

    const html = `<!doctype html><html><body><img src="https://127.0.0.1:1/unreachable-cleanup-test.png"></body></html>`
    const htmlPath = join(htmlDir, "cleanup-test.html")
    await writeFile(htmlPath, html, "utf8")

    await expect(
      inlineHtmlResources(htmlPath, {
        allowedRoots: [htmlDir, worktree],
        remoteTimeout: 500,
      }),
    ).rejects.toThrow("资源验证失败")

    const files = await readdir(htmlDir)
    const inlinedFiles = files.filter((f) => f.includes("-inlined"))
    expect(inlinedFiles.length).toBe(0)

    const originalExists = files.some((f) => f === "cleanup-test.html")
    expect(originalExists).toBe(true)
  })

  it("does not re-validate repeated references to the same local file", async () => {
    const worktree = await withWorktree()
    const htmlDir = join(worktree, "output")
    await mkdir(htmlDir, { recursive: true })
    await mkdir(join(worktree, "shared"), { recursive: true })
    await writeFile(join(worktree, "shared", "dot.png"), PNG_1PX)

    const imgPath = join(worktree, "shared", "dot.png").replace(/\\/g, "/")
    const html = `<!doctype html><html><body>
      <img src="${imgPath}">
      <img src="${imgPath}">
      <img src="${imgPath}">
    </body></html>`
    const htmlPath = join(htmlDir, "tripledup.html")
    await writeFile(htmlPath, html, "utf8")

    const result = await inlineHtmlResources(htmlPath, {
      allowedRoots: [htmlDir, worktree],
    })

    const inlined = await readFile(result.inlinedPath, "utf8")
    const matches = inlined.match(/data:image\/png;base64,/g)
    expect(matches).toHaveLength(3)

    expect(inlined).toContain("data:image/png;base64,")
  })
})
