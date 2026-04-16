import { mkdir, stat, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"

import { renderMarkdown, buildHtmlDocument } from "./html-renderer/index.js"
import { getRuntimeAssetPaths, getNodeModulesDir } from "./html-renderer/runtime-assets.js"
import { collectLocalImages, rewriteImageRefsToAssetDir } from "./html-renderer/assets.js"
import { buildManifest, expandCssTransitiveRefs } from "./html-renderer/resource-manifest.js"
import { validateResources } from "./html-renderer/resource-validator.js"
import { publishBundle } from "./html-renderer/resource-bundler.js"

export type ExportFormat = "markdown" | "html"

export interface ExportResult {
  relativePath: string
  absolutePath: string
  assetDir?: {
    relativePath: string
    absolutePath: string
  }
}

const WINDOWS_RESERVED_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
])

function buildTimestamp(): string {
  return new Date().toISOString().replace(/[:T]/g, "-").replace(/\.\d{3}Z$/, "Z")
}

function sanitizeTitle(title: string | undefined): string {
  if (!title) return "export"
  const trimmed = title.trim()
  if (trimmed === "") return "export"
  if (trimmed.includes("..") || /[\\/]/.test(trimmed)) {
    throw new Error("文件标题不能包含路径分隔符或 ..")
  }

  const sanitized = trimmed
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/^[-. ]+/g, "")

  if (sanitized === "") return "export"
  if (WINDOWS_RESERVED_NAMES.has(sanitized.toUpperCase())) {
    throw new Error("文件标题不能使用系统保留名称")
  }
  return sanitized
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const MAX_COLLISION_RETRIES = 100

async function buildUniquePath(outputDir: string, baseName: string, extension: string): Promise<string> {
  const timestamp = buildTimestamp()
  for (let index = 0; index < MAX_COLLISION_RETRIES; index++) {
    const suffix = index === 0 ? "" : `-${index}`
    const candidate = join(outputDir, `${baseName}-${timestamp}${suffix}.${extension}`)
    if (!(await pathExists(candidate))) return candidate
  }
  throw new Error("无法生成唯一的导出文件路径，请重试")
}

async function buildUniqueStem(outputDir: string, baseName: string): Promise<string> {
  const timestamp = buildTimestamp()
  for (let index = 0; index < MAX_COLLISION_RETRIES; index++) {
    const suffix = index === 0 ? "" : `-${index}`
    const stem = `${baseName}-${timestamp}${suffix}`
    const htmlPath = join(outputDir, `${stem}.html`)
    const assetDir = join(outputDir, `${stem}-assets`)
    if (!(await pathExists(htmlPath)) && !(await pathExists(assetDir))) return stem
  }
  throw new Error("无法生成唯一的导出文件路径，请重试")
}

export async function exportDocument(worktree: string, input: {
  format: ExportFormat
  title?: string
  content: string
}): Promise<ExportResult> {
  if (input.content.trim() === "") {
    throw new Error("导出内容不能为空")
  }

  const outputDir = join(worktree, "output")
  await mkdir(outputDir, { recursive: true })

  const safeTitle = sanitizeTitle(input.title)

  if (input.format === "markdown") {
    const absolutePath = await buildUniquePath(outputDir, safeTitle, "md")
    await writeFile(absolutePath, input.content, "utf8")
    return {
      absolutePath,
      relativePath: relative(worktree, absolutePath).replace(/\\/g, "/"),
    }
  }

  const renderResult = await renderMarkdown(input.content, { worktree })
  const localImages = collectLocalImages(renderResult.html, worktree)
  const runtimeAssetInfos = getRuntimeAssetPaths(renderResult.features)

  const manifest = buildManifest(renderResult.html, {
    worktree,
    runtimeEntries: runtimeAssetInfos.map((a) => ({
      localPath: a.localPath,
      label: a.label,
    })),
  })
  await expandCssTransitiveRefs(manifest)
  const report = await validateResources(manifest, { allowedRoots: [worktree] })

  if (!report.valid) {
    const lines = report.failures.map(
      (f) => `  - ${f.reason}（引用自: ${f.referringSurfaces[0]}）`,
    )
    throw new Error(
      `资源验证失败，共 ${report.failures.length} 项:\n${lines.join("\n")}`,
    )
  }

  const stem = await buildUniqueStem(outputDir, safeTitle)
  const htmlPath = join(outputDir, `${stem}.html`)
  const assetDirPath = join(outputDir, `${stem}-assets`)
  const assetRelDir = `./${stem}-assets`

  const rewrittenBody = rewriteImageRefsToAssetDir(renderResult.html, localImages, assetRelDir)
  const rewrittenResult = { ...renderResult, html: rewrittenBody }
  const htmlContent = buildHtmlDocument(safeTitle, rewrittenResult, assetRelDir)

  const nodeModulesDir = getNodeModulesDir()
  const runtimeCopies = manifest.entries
    .filter((e) => e.resourceClass === "runtime" && e.localPath)
    .map((e) => ({
      srcAbsPath: e.localPath!,
      destRelPath: relative(nodeModulesDir, e.localPath!).replace(/\\/g, "/"),
    }))

  const localCopies = localImages.map((img) => ({
    srcAbsPath: img.resolvedPath,
    destRelPath: img.destRelPath,
  }))

  const hasAssets = runtimeCopies.length > 0 || localCopies.length > 0

  if (hasAssets) {
    await publishBundle({
      htmlContent,
      htmlPath,
      assetDir: assetDirPath,
      runtimeAssets: runtimeCopies,
      localImages: localCopies,
    })
  } else {
    await writeFile(htmlPath, htmlContent, "utf8")
  }

  const result: ExportResult = {
    absolutePath: htmlPath,
    relativePath: relative(worktree, htmlPath).replace(/\\/g, "/"),
  }

  if (hasAssets) {
    result.assetDir = {
      absolutePath: assetDirPath,
      relativePath: relative(worktree, assetDirPath).replace(/\\/g, "/"),
    }
  }

  return result
}
