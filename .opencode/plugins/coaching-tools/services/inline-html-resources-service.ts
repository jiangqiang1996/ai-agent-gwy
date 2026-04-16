import { readFile, rm, stat, writeFile } from "node:fs/promises"
import { basename, dirname, join, normalize, resolve } from "node:path"
import * as cheerio from "cheerio"
import * as csstree from "css-tree"

import { buildManifest, expandCssTransitiveRefs } from "./html-renderer/resource-manifest.js"
import { validateResources } from "./html-renderer/resource-validator.js"

export interface InlineHtmlResult {
  inlinedPath: string
  originalPath: string
}

function cssEscape(str: string): string {
  return str.replace(/([\\"])/g, "\\$1")
}

function isDataUrl(src: string): boolean {
  return /^data:/i.test(src.trim())
}

async function readLocalAsBase64(filePath: string): Promise<string> {
  const buf = await readFile(filePath)
  return buf.toString("base64")
}

function guessMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    ico: "image/x-icon",
    bmp: "image/bmp",
    css: "text/css",
    js: "application/javascript",
    mjs: "application/javascript",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    eot: "application/vnd.ms-fontobject",
    json: "application/json",
    html: "text/html",
    mp4: "video/mp4",
    webm: "video/webm",
    mp3: "audio/mpeg",
    wav: "audio/wav",
  }
  return mimeMap[ext] ?? "application/octet-stream"
}

async function fetchRemoteAsDataUrl(url: string, timeout: number): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const contentType = response.headers.get("content-type") ?? "application/octet-stream"
    const buf = Buffer.from(await response.arrayBuffer())
    return `data:${contentType};base64,${buf.toString("base64")}`
  } finally {
    clearTimeout(timer)
  }
}

function inlineCssRefs(cssText: string, htmlDir: string, localCache: Map<string, Promise<string>>): Promise<string> {
  const promises: Array<{ start: number; end: number; replacement: Promise<string> }> = []

  try {
    const ast = csstree.parse(cssText, { parseValue: true, parseAtrulePrelude: true })
    csstree.walk(ast, {
      visit: "Url",
      enter(node) {
        const raw = node.value
        if (!raw || isDataUrl(raw)) return
        const urlStr = raw.replace(/^['"]|['"]$/g, "")
        if (!urlStr || isDataUrl(urlStr)) return
        if (/^https?:\/\//i.test(urlStr)) {
          const start = node.loc?.start?.offset ?? -1
          const end = node.loc?.end?.offset ?? -1
          if (start < 0 || end < 0) return
          let cached = localCache.get(urlStr)
          if (!cached) {
            cached = fetchRemoteAsDataUrl(urlStr, 10000)
            localCache.set(urlStr, cached)
          }
          promises.push({
            start,
            end,
            replacement: cached.then((dataUrl) => `"${dataUrl}"`),
          })
        } else {
          const resolved = normalize(resolve(htmlDir, urlStr.replace(/^[/\\]+/, "")))
          let cached = localCache.get(resolved)
          if (!cached) {
            cached = readLocalAsBase64(resolved).then((b64) => {
              const mime = guessMimeType(resolved)
              return `data:${mime};base64,${b64}`
            })
            localCache.set(resolved, cached)
          }
          promises.push({
            start: node.loc?.start?.offset ?? -1,
            end: node.loc?.end?.offset ?? -1,
            replacement: cached.then((dataUrl) => `"${dataUrl}"`),
          })
        }
      },
    })
  } catch {
    return Promise.resolve(cssText)
  }

  if (promises.length === 0) return Promise.resolve(cssText)

  return Promise.all(promises.map((p) => p.replacement)).then((replacements) => {
    const sorted = promises
      .map((p, i) => ({ ...p, replacement: replacements[i] }))
      .sort((a, b) => b.start - a.start)
    let result = cssText
    for (const p of sorted) {
      if (p.start < 0 || p.end < 0) continue
      result = result.slice(0, p.start) + p.replacement + result.slice(p.end)
    }
    return result
  })
}

export async function inlineHtmlResources(
  htmlFilePath: string,
  options: {
    allowedRoots: string[]
    remoteTimeout?: number
  },
): Promise<InlineHtmlResult> {
  const htmlDir = dirname(htmlFilePath)

  const htmlContent = await readFile(htmlFilePath, "utf8")

  const manifest = buildManifest(htmlContent, {
    worktree: htmlDir,
  })
  await expandCssTransitiveRefs(manifest)

  const report = await validateResources(manifest, {
    allowedRoots: options.allowedRoots,
    remoteTimeout: options.remoteTimeout ?? 10000,
  })

  if (!report.valid) {
    const lines = report.failures.map(
      (f) => `  - ${f.reason}（引用自: ${f.referringSurfaces[0]}）`,
    )
    throw new Error(
      `资源验证失败，共 ${report.failures.length} 项:\n${lines.join("\n")}`,
    )
  }

  const $ = cheerio.load(htmlContent)
  const localCache = new Map<string, Promise<string>>()

  const imgSrcs = new Set<string>()
  $("img[src]").each((_i, el) => {
    const src = $(el).attr("src") ?? ""
    if (!src || isDataUrl(src)) return
    imgSrcs.add(src)
  })

  for (const src of imgSrcs) {
    let dataUrl: string
    if (/^https?:\/\//i.test(src)) {
      let cached = localCache.get(src)
      if (!cached) {
        cached = fetchRemoteAsDataUrl(src, options.remoteTimeout ?? 10000).then((url) => {
          localCache.set(src, Promise.resolve(url))
          return url
        })
        localCache.set(src, cached)
      }
      dataUrl = await cached
    } else {
      const resolved = normalize(resolve(htmlDir, src.replace(/^[/\\]+/, "")))
      let cached = localCache.get(resolved)
      if (!cached) {
        cached = readLocalAsBase64(resolved).then((b64) => {
          const mime = guessMimeType(resolved)
          return `data:${mime};base64,${b64}`
        })
        localCache.set(resolved, cached)
      }
      dataUrl = await cached
    }

    $(`img[src="${cssEscape(src)}"]`).attr("src", dataUrl)
  }

  const linkHrefs = new Set<string>()
  $('link[rel="stylesheet"][href]').each((_i, el) => {
    const href = $(el).attr("href") ?? ""
    if (!href || isDataUrl(href)) return
    linkHrefs.add(href)
  })

  for (const href of linkHrefs) {
    let cssText: string
    if (/^https?:\/\//i.test(href)) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), options.remoteTimeout ?? 10000)
      try {
        const resp = await fetch(href, { signal: controller.signal, redirect: "follow" })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        cssText = await resp.text()
      } finally {
        clearTimeout(timer)
      }
    } else {
      const resolved = normalize(resolve(htmlDir, href.replace(/^[/\\]+/, "")))
      cssText = await readFile(resolved, "utf8")
    }

    const inlinedCss = await inlineCssRefs(cssText, htmlDir, localCache)
    $('link[rel="stylesheet"][href]').each((_i, el) => {
      if ($(el).attr("href") === href) {
        const styleTag = `<style>${inlinedCss}</style>`
        $(el).replaceWith(styleTag)
      }
    })
  }

  const scriptSrcs = new Set<string>()
  $("script[src]").each((_i, el) => {
    const src = $(el).attr("src") ?? ""
    if (!src || isDataUrl(src)) return
    scriptSrcs.add(src)
  })

  for (const src of scriptSrcs) {
    let jsText: string
    if (/^https?:\/\//i.test(src)) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), options.remoteTimeout ?? 10000)
      try {
        const resp = await fetch(src, { signal: controller.signal, redirect: "follow" })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        jsText = await resp.text()
      } finally {
        clearTimeout(timer)
      }
    } else {
      const resolved = normalize(resolve(htmlDir, src.replace(/^[/\\]+/, "")))
      jsText = await readFile(resolved, "utf8")
    }

    $(`script[src="${cssEscape(src)}"]`).each((_i, el) => {
      $(el).removeAttr("src")
      $(el).text(jsText)
    })
  }

  const sourceSrcs = new Set<string>()
  $("source[src]").each((_i, el) => {
    const src = $(el).attr("src") ?? ""
    if (!src || isDataUrl(src)) return
    sourceSrcs.add(src)
  })

  for (const src of sourceSrcs) {
    let dataUrl: string
    if (/^https?:\/\//i.test(src)) {
      let cached = localCache.get(src)
      if (!cached) {
        cached = fetchRemoteAsDataUrl(src, options.remoteTimeout ?? 10000)
        localCache.set(src, cached)
      }
      dataUrl = await cached
    } else {
      const resolved = normalize(resolve(htmlDir, src.replace(/^[/\\]+/, "")))
      let cached = localCache.get(resolved)
      if (!cached) {
        cached = readLocalAsBase64(resolved).then((b64) => {
          const mime = guessMimeType(resolved)
          return `data:${mime};base64,${b64}`
        })
        localCache.set(resolved, cached)
      }
      dataUrl = await cached
    }

    $(`source[src="${cssEscape(src)}"]`).attr("src", dataUrl)
  }

  const inlinedHtml = $.html()

  const base = basename(htmlFilePath)
  const dotIdx = base.lastIndexOf(".")
  const stem = dotIdx > 0 ? base.slice(0, dotIdx) : base
  const ext = dotIdx > 0 ? base.slice(dotIdx) : ".html"
  const inlinedName = `${stem}-inlined${ext}`
  const inlinedPath = join(htmlDir, inlinedName)

  try {
    await writeFile(inlinedPath, inlinedHtml, "utf8")
  } catch (error) {
    await rm(inlinedPath, { force: true })
    throw error
  }

  const originalStat = await stat(htmlFilePath)
  if (!originalStat.isFile()) {
    await rm(inlinedPath, { force: true })
    throw new Error("原始文件不是普通文件")
  }

  return {
    inlinedPath,
    originalPath: htmlFilePath,
  }
}
