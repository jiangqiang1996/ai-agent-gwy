import { basename, isAbsolute, join, normalize, relative } from "node:path"
import { fileURLToPath } from "node:url"

const IMG_TAG_PATTERN = /<img\b([^>]*?)\bsrc=(['"])(.*?)\2([^>]*)>/gi
const REMOTE_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-z]:[\\/]/i

function stripQueryAndHash(input: string): string {
  return input.replace(/[?#].*$/, "")
}

function decodePathSegment(input: string): string {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

function shouldKeepExternalSource(src: string): boolean {
  if (/^(?:https?:)?\/\//i.test(src)) return true
  if (/^(?:data|blob|mailto|tel):/i.test(src)) return true
  return false
}

export function resolveLocalAssetPath(src: string, worktree: string): string | null {
  const trimmed = src.trim()
  if (!trimmed || shouldKeepExternalSource(trimmed)) return null

  if (trimmed.startsWith("file://")) {
    try {
      return fileURLToPath(trimmed)
    } catch {
      return null
    }
  }

  if (REMOTE_SCHEME_PATTERN.test(trimmed) && !WINDOWS_ABSOLUTE_PATH_PATTERN.test(trimmed)) {
    return null
  }

  const withoutSuffix = decodePathSegment(stripQueryAndHash(trimmed))
  if (!withoutSuffix) return null

  if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(withoutSuffix) || isAbsolute(withoutSuffix)) {
    return normalize(withoutSuffix)
  }

  return normalize(join(worktree, withoutSuffix.replace(/^[/\\]+/, "")))
}

export interface LocalImageInfo {
  originalSrc: string
  resolvedPath: string
  destRelPath: string
}

export function collectLocalImages(html: string, worktree: string): LocalImageInfo[] {
  const images: LocalImageInfo[] = []
  const seen = new Set<string>()

  const matches = Array.from(html.matchAll(IMG_TAG_PATTERN))
  for (const match of matches) {
    const src = match[3]
    if (!src || shouldKeepExternalSource(src)) continue

    const resolvedPath = resolveLocalAssetPath(src, worktree)
    if (!resolvedPath) continue

    if (seen.has(resolvedPath)) continue
    seen.add(resolvedPath)

    const relFromWorktree = relative(worktree, resolvedPath).replace(/\\/g, "/")
    const destRelPath = relFromWorktree.startsWith("..")
      ? basename(resolvedPath)
      : relFromWorktree

    images.push({ originalSrc: src, resolvedPath, destRelPath })
  }

  return images
}

export function rewriteImageRefsToAssetDir(
  html: string,
  images: LocalImageInfo[],
  assetRelDir: string,
): string {
  if (images.length === 0) return html

  const rewriteMap = new Map(
    images.map((img) => [img.originalSrc, `${assetRelDir}/content/${img.destRelPath}`]),
  )

  return html.replace(IMG_TAG_PATTERN, (fullMatch, beforeSrc, quote, src, afterSrc) => {
    const newSrc = rewriteMap.get(src)
    if (newSrc) {
      return `<img${beforeSrc}src=${quote}${newSrc}${quote}${afterSrc}>`
    }
    return fullMatch
  })
}
