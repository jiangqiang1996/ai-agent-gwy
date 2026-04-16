import { mkdir, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"

import { renderMarkdown, buildHtmlDocument } from "./html-renderer/index.js"
import { getRuntimeAssetPaths, getNodeModulesDir } from "./html-renderer/runtime-assets.js"
import { collectLocalImages, rewriteImageRefsToAssetDir } from "./html-renderer/assets.js"
import { buildManifest, expandCssTransitiveRefs } from "./html-renderer/resource-manifest.js"
import { validateResources } from "./html-renderer/resource-validator.js"
import { publishBundle } from "./html-renderer/resource-bundler.js"

import { buildTimestamp, pathExists } from "./export-service.js"

export interface HtmlBundleResult {
  relativePath: string
  absolutePath: string
  assetDir?: {
    relativePath: string
    absolutePath: string
  }
}

const MAX_COLLISION_RETRIES = 100

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

export async function renderToHtmlBundle(
  worktree: string,
  outputDir: string,
  markdownContent: string,
  safeTitle: string,
): Promise<HtmlBundleResult> {
  if (markdownContent.trim() === "") {
    throw new Error("导出内容不能为空")
  }

  const renderResult = await renderMarkdown(markdownContent, { worktree })
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

  const result: HtmlBundleResult = {
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
