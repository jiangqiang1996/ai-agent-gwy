import { mkdir, stat, writeFile } from "node:fs/promises"
import { dirname, join, resolve, sep } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  buildManifest,
  expandCssTransitiveRefs,
  type ResourceManifest,
} from "../../plugins/coaching-tools/services/html-renderer/resource-manifest.js"
import {
  isBlockedHostname,
  validateRemoteUrlSafety,
  validateResources,
  type ValidationReport,
} from "../../plugins/coaching-tools/services/html-renderer/resource-validator.js"
import { getRuntimeAssetPaths } from "../../plugins/coaching-tools/services/html-renderer/runtime-assets.js"
import {
  cleanupTempWorktree,
  createTempWorktree,
  writeWorktreeFile,
} from "../setup/temp-worktree.js"

const worktrees: string[] = []

afterEach(async () => {
  while (worktrees.length > 0) {
    const wt = worktrees.pop()
    if (wt) await cleanupTempWorktree(wt)
  }
  vi.restoreAllMocks()
})

async function withWorktree(): Promise<string> {
  const wt = await createTempWorktree()
  worktrees.push(wt)
  return wt
}

describe("resource manifest and validation", () => {
  describe("manifest building", () => {
    it("collects local image references from HTML", async () => {
      const wt = await withWorktree()
      await mkdir(join(wt, "img"), { recursive: true })
      await writeFile(join(wt, "img", "photo.png"), Buffer.from("fake"))

      const html = `<img src="img/photo.png" alt="photo">`
      const manifest = buildManifest(html, { worktree: wt })

      expect(manifest.entries).toHaveLength(1)
      expect(manifest.entries[0].resourceClass).toBe("local")
      expect(manifest.entries[0].localPath).toBeTruthy()
    })

    it("collects remote URL references from HTML", () => {
      const wt = "unused"
      const html = `<script src="https://cdn.example.com/lib.js"></script>
        <link rel="stylesheet" href="https://cdn.example.com/style.css">`

      const manifest = buildManifest(html, { worktree: wt })

      expect(manifest.entries).toHaveLength(2)
      const classes = manifest.entries.map((e) => e.resourceClass)
      expect(classes.every((c) => c === "remote")).toBe(true)
    })

    it("deduplicates entries with the same resolved path", async () => {
      const wt = await withWorktree()
      await mkdir(join(wt, "assets"), { recursive: true })
      await writeFile(join(wt, "assets", "shared.png"), Buffer.from("fake"))

      const html = `<img src="assets/shared.png"><img src="assets/shared.png"><img src="./assets/shared.png">`
      const manifest = buildManifest(html, { worktree: wt })

      expect(manifest.entries).toHaveLength(1)
      expect(manifest.entries[0].referringSurfaces.length).toBeGreaterThanOrEqual(2)
    })

    it("skips data: and blob: URLs", () => {
      const html = `<img src="data:image/png;base64,abc"><img src="blob:xyz">`
      const manifest = buildManifest(html, { worktree: "/tmp" })

      expect(manifest.entries).toHaveLength(0)
    })

    it("skips mailto: and tel: URLs", () => {
      const html = `<a href="mailto:x@y.z">email</a>`
      const manifest = buildManifest(html, { worktree: "/tmp" })

      expect(manifest.entries).toHaveLength(0)
    })

    it("handles paths with spaces and mixed separators", async () => {
      const wt = await withWorktree()
      const sub = join(wt, "my images", "sub dir")
      await mkdir(sub, { recursive: true })
      await writeFile(join(sub, "photo.png"), Buffer.from("fake"))

      const html = `<img src="my images/sub dir/photo.png">`
      const manifest = buildManifest(html, { worktree: wt })

      expect(manifest.entries).toHaveLength(1)
      const report = await validateResources(manifest, {
        allowedRoots: [wt],
      })
      expect(report.valid).toBe(true)
    })

    it("includes runtime entries from options", async () => {
      const wt = await withWorktree()
      await writeFile(join(wt, "runtime.css"), "body{}")

      const html = "<p>hello</p>"
      const manifest = buildManifest(html, {
        worktree: wt,
        runtimeEntries: [
          { localPath: join(wt, "runtime.css"), label: "test-css" },
        ],
      })

      expect(manifest.entries).toHaveLength(1)
      expect(manifest.entries[0].resourceClass).toBe("runtime")
      expect(manifest.entries[0].referringSurfaces).toContain("runtime:test-css")
    })

    it("collects script and link source references", async () => {
      const wt = await withWorktree()
      await writeFile(join(wt, "app.js"), "console.log(1)")
      await writeFile(join(wt, "app.css"), "body{}")

      const html = `<script src="app.js"></script><link rel="stylesheet" href="app.css">`
      const manifest = buildManifest(html, { worktree: wt })

      expect(manifest.entries).toHaveLength(2)
      const classes = manifest.entries.map((e) => e.resourceClass)
      expect(classes.every((c) => c === "local")).toBe(true)
    })
  })

  describe("CSS transitive expansion", () => {
    it("adds font dependencies from CSS url() references", async () => {
      const wt = await withWorktree()
      await mkdir(join(wt, "styles", "fonts"), { recursive: true })
      await writeFile(
        join(wt, "styles", "main.css"),
        '@font-face { src: url(fonts/myfont.woff2) format("woff2"); }',
      )
      await writeFile(
        join(wt, "styles", "fonts", "myfont.woff2"),
        Buffer.from("woff2-data"),
      )

      const html = `<link rel="stylesheet" href="styles/main.css">`
      const manifest = buildManifest(html, { worktree: wt })
      await expandCssTransitiveRefs(manifest)

      const paths = manifest.entries.map((e) => e.localPath)
      const hasFont = paths.some((p) => p && p.includes("myfont.woff2"))
      expect(hasFont).toBe(true)
    })

    it("adds transitive deps from CSS @import chains", async () => {
      const wt = await withWorktree()
      await mkdir(join(wt, "css"), { recursive: true })
      await writeFile(
        join(wt, "css", "root.css"),
        '@import "child.css";',
      )
      await writeFile(
        join(wt, "css", "child.css"),
        "body { background: url(bg.png); }",
      )
      await writeFile(join(wt, "css", "bg.png"), Buffer.from("fake"))

      const html = `<link rel="stylesheet" href="css/root.css">`
      const manifest = buildManifest(html, { worktree: wt })
      await expandCssTransitiveRefs(manifest)

      const paths = manifest.entries.map((e) => e.localPath)
      const hasChild = paths.some((p) => p && p.includes("child.css"))
      const hasBg = paths.some((p) => p && p.includes("bg.png"))
      expect(hasChild).toBe(true)
      expect(hasBg).toBe(true)
    })

    it("inherits resource class from parent CSS entry", async () => {
      const wt = await withWorktree()
      await mkdir(join(wt, "pkg"), { recursive: true })
      await writeFile(
        join(wt, "pkg", "runtime.css"),
        "body { background: url(bg.png); }",
      )
      await writeFile(join(wt, "pkg", "bg.png"), Buffer.from("fake"))

      const html = "<p>test</p>"
      const manifest = buildManifest(html, {
        worktree: wt,
        runtimeEntries: [
          { localPath: join(wt, "pkg", "runtime.css"), label: "pkg-css" },
        ],
      })
      await expandCssTransitiveRefs(manifest)

      const fontEntry = manifest.entries.find(
        (e) => e.localPath && e.localPath.includes("bg.png"),
      )
      expect(fontEntry).toBeDefined()
      expect(fontEntry!.resourceClass).toBe("runtime")
    })

    it("does not infinitely recurse on circular CSS imports", async () => {
      const wt = await withWorktree()
      await mkdir(join(wt, "loop"), { recursive: true })
      await writeFile(join(wt, "loop", "a.css"), '@import "b.css";')
      await writeFile(join(wt, "loop", "b.css"), '@import "a.css";')

      const html = `<link rel="stylesheet" href="loop/a.css">`
      const manifest = buildManifest(html, { worktree: wt })

      await expect(expandCssTransitiveRefs(manifest)).resolves.toBeDefined()
      expect(manifest.entries.length).toBeLessThanOrEqual(4)
    })
  })

  describe("local validation", () => {
    it("passes for existing local files within allowed roots", async () => {
      const wt = await withWorktree()
      await writeFile(join(wt, "file.txt"), "content")

      const manifest = buildManifest(
        `<img src="file.txt">`,
        { worktree: wt },
      )
      const report = await validateResources(manifest, {
        allowedRoots: [wt],
      })

      expect(report.valid).toBe(true)
      expect(report.checkedCount).toBe(1)
    })

    it("passes for runtime assets without requiring path within roots", async () => {
      const wt = await withWorktree()
      const features = { hasCanvas: false, hasCharts: false, hasKatex: true, hasMarkmap: false, hasMermaid: false }
      const runtimePaths = getRuntimeAssetPaths(features)

      expect(runtimePaths.length).toBeGreaterThan(0)

      const manifest: ResourceManifest = {
        entries: runtimePaths.map((a) => ({
          key: `local:${a.localPath}`,
          resourceClass: "runtime" as const,
          localPath: a.localPath,
          referringSurfaces: [`runtime:${a.label}`],
        })),
      }

      await expandCssTransitiveRefs(manifest)
      const report = await validateResources(manifest, {
        allowedRoots: [wt],
      })

      expect(report.valid).toBe(true)
    })

    it("fails for missing local files", async () => {
      const wt = await withWorktree()

      const manifest = buildManifest(
        `<img src="nonexistent.png">`,
        { worktree: wt },
      )
      const report = await validateResources(manifest, {
        allowedRoots: [wt],
      })

      expect(report.valid).toBe(false)
      expect(report.failures).toHaveLength(1)
      expect(report.failures[0].reason).toContain("不存在")
      expect(report.failures[0].referringSurfaces.length).toBeGreaterThan(0)
    })

    it("fails for paths resolving outside allowed roots", async () => {
      const wt = await withWorktree()
      const outsideDir = join(wt, "..", "..")
      const outsidePath = resolve(join(outsideDir, "secret.txt"))

      const manifest: ResourceManifest = {
        entries: [
          {
            key: `local:${outsidePath}`,
            resourceClass: "local",
            localPath: outsidePath,
            referringSurfaces: ["<img src=\"../../secret.txt\">"],
          },
        ],
      }

      const report = await validateResources(manifest, {
        allowedRoots: [wt],
      })

      expect(report.valid).toBe(false)
      expect(report.failures).toHaveLength(1)
      expect(report.failures[0].reason).toContain("超出允许范围")
    })

    it("fails for a directory path instead of a file", async () => {
      const wt = await withWorktree()
      await mkdir(join(wt, "subdir"), { recursive: true })

      const manifest: ResourceManifest = {
        entries: [
          {
            key: `local:${join(wt, "subdir")}`,
            resourceClass: "local",
            localPath: join(wt, "subdir"),
            referringSurfaces: ["<link href=\"subdir\">"],
          },
        ],
      }

      const report = await validateResources(manifest, {
        allowedRoots: [wt],
      })

      expect(report.valid).toBe(false)
      expect(report.failures[0].reason).toContain("不是文件")
    })
  })

  describe("remote validation — blocked targets", () => {
    it("rejects localhost", () => {
      expect(isBlockedHostname("localhost")).toBe(true)
      expect(isBlockedHostname("LOCALHOST")).toBe(true)
    })

    it("rejects loopback IPs", () => {
      expect(isBlockedHostname("127.0.0.1")).toBe(true)
      expect(isBlockedHostname("127.255.255.255")).toBe(true)
    })

    it("rejects private IPs", () => {
      expect(isBlockedHostname("10.0.0.1")).toBe(true)
      expect(isBlockedHostname("172.16.0.1")).toBe(true)
      expect(isBlockedHostname("172.31.255.255")).toBe(true)
      expect(isBlockedHostname("192.168.1.1")).toBe(true)
    })

    it("rejects link-local IPs", () => {
      expect(isBlockedHostname("169.254.1.1")).toBe(true)
    })

    it("rejects 0.0.0.0", () => {
      expect(isBlockedHostname("0.0.0.0")).toBe(true)
    })

    it("rejects IPv6 loopback", () => {
      expect(isBlockedHostname("::1")).toBe(true)
    })

    it("allows public hostnames", () => {
      expect(isBlockedHostname("example.com")).toBe(false)
      expect(isBlockedHostname("cdn.jsdelivr.net")).toBe(false)
      expect(isBlockedHostname("8.8.8.8")).toBe(false)
    })

    it("validateRemoteUrlSafety rejects file: protocol", () => {
      const result = validateRemoteUrlSafety("file:///etc/passwd")
      expect(result.safe).toBe(false)
      expect(result.reason).toContain("协议")
    })

    it("validateRemoteUrlSafety rejects blocked hostnames", () => {
      const result = validateRemoteUrlSafety("http://127.0.0.1/api")
      expect(result.safe).toBe(false)
      expect(result.reason).toContain("阻止")
    })

    it("validateRemoteUrlSafety accepts valid public URLs", () => {
      const result = validateRemoteUrlSafety("https://example.com/lib.js")
      expect(result.safe).toBe(true)
    })

    it("validateRemoteUrlSafety rejects malformed URLs", () => {
      const result = validateRemoteUrlSafety("not a url")
      expect(result.safe).toBe(false)
      expect(result.reason).toContain("无效")
    })
  })

  describe("remote validation — reachability", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
          const urlStr = String(url)
          if (urlStr.includes("timeout.example.com")) {
            return new Promise((_resolve, reject) => {
              const timer = setTimeout(() => {
                reject(new DOMException("The operation was aborted.", "AbortError"))
              }, 30000)
              init?.signal?.addEventListener("abort", () => {
                clearTimeout(timer)
                reject(new DOMException("The operation was aborted.", "AbortError"))
              })
            })
          }
          if (urlStr.includes("redirect-loop.example.com")) {
            return new Response(null, {
              status: 302,
              headers: { Location: urlStr },
            })
          }
          if (urlStr.includes("status-404.example.com")) {
            return new Response("not found", { status: 404 })
          }
          if (urlStr.includes("status-500.example.com")) {
            return new Response("error", { status: 500 })
          }
          if (urlStr.includes("head-fails.example.com")) {
            if (init?.method === "HEAD") {
              return new Response(null, { status: 405 })
            }
            return new Response("ok", { status: 200 })
          }
          return new Response("ok", { status: 200 })
        }),
      )
    })

    it("passes for reachable remote URLs", async () => {
      const manifest: ResourceManifest = {
        entries: [
          {
            key: "remote:https://example.com/lib.js",
            resourceClass: "remote",
            remoteUrl: "https://example.com/lib.js",
            referringSurfaces: ["<script src=\"...\">"],
          },
        ],
      }

      const report = await validateResources(manifest, {
        allowedRoots: [],
        remoteTimeout: 2000,
      })

      expect(report.valid).toBe(true)
    })

    it("fails with timeout for unreachable remote URLs", async () => {
      const manifest: ResourceManifest = {
        entries: [
          {
            key: "remote:https://timeout.example.com/slow",
            resourceClass: "remote",
            remoteUrl: "https://timeout.example.com/slow",
            referringSurfaces: ["<script>"],
          },
        ],
      }

      const report = await validateResources(manifest, {
        allowedRoots: [],
        remoteTimeout: 50,
      })

      expect(report.valid).toBe(false)
      expect(report.failures[0].reason).toContain("超时")
    }, 10000)

    it("fails for non-OK HTTP status", async () => {
      const manifest: ResourceManifest = {
        entries: [
          {
            key: "remote:https://status-404.example.com/gone",
            resourceClass: "remote",
            remoteUrl: "https://status-404.example.com/gone",
            referringSurfaces: ["<link>"],
          },
        ],
      }

      const report = await validateResources(manifest, {
        allowedRoots: [],
        remoteTimeout: 2000,
      })

      expect(report.valid).toBe(false)
      expect(report.failures[0].reason).toContain("HTTP 404")
    })

    it("falls back from HEAD to GET on 405", async () => {
      const manifest: ResourceManifest = {
        entries: [
          {
            key: "remote:https://head-fails.example.com/res",
            resourceClass: "remote",
            remoteUrl: "https://head-fails.example.com/res",
            referringSurfaces: ["<img>"],
          },
        ],
      }

      const report = await validateResources(manifest, {
        allowedRoots: [],
        remoteTimeout: 2000,
      })

      expect(report.valid).toBe(true)
    })

    it("fails for blocked target before fetch", async () => {
      const manifest: ResourceManifest = {
        entries: [
          {
            key: "remote:http://127.0.0.1/secret",
            resourceClass: "remote",
            remoteUrl: "http://127.0.0.1/secret",
            referringSurfaces: ["<script>"],
          },
        ],
      }

      const report = await validateResources(manifest, {
        allowedRoots: [],
        remoteTimeout: 2000,
      })

      expect(report.valid).toBe(false)
      expect(report.failures[0].reason).toContain("阻止")
      expect(vi.mocked(fetch)).not.toHaveBeenCalled()
    })
  })

  describe("structured report", () => {
    it("aggregates multiple failures", async () => {
      const wt = await withWorktree()
      const manifest: ResourceManifest = {
        entries: [
          {
            key: "local:missing1",
            resourceClass: "local",
            localPath: join(wt, "missing1.txt"),
            referringSurfaces: ["<img src=\"missing1.txt\">"],
          },
          {
            key: "local:missing2",
            resourceClass: "local",
            localPath: join(wt, "missing2.txt"),
            referringSurfaces: ["<img src=\"missing2.txt\">"],
          },
        ],
      }

      const report = await validateResources(manifest, {
        allowedRoots: [wt],
      })

      expect(report.valid).toBe(false)
      expect(report.failures).toHaveLength(2)
      expect(report.checkedCount).toBe(2)

      for (const f of report.failures) {
        expect(f.resourceKey).toBeTruthy()
        expect(f.reason).toBeTruthy()
        expect(f.referringSurfaces.length).toBeGreaterThan(0)
      }
    })

    it("returns valid report with zero failures for empty manifest", async () => {
      const report = await validateResources(
        { entries: [] },
        { allowedRoots: ["/tmp"] },
      )

      expect(report.valid).toBe(true)
      expect(report.failures).toHaveLength(0)
      expect(report.checkedCount).toBe(0)
    })
  })
})
