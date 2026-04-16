import { dirname, normalize, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { readFile } from "node:fs/promises"

export type ResourceClass = "runtime" | "local" | "remote"

export interface ResourceEntry {
  key: string
  resourceClass: ResourceClass
  localPath?: string
  remoteUrl?: string
  referringSurfaces: string[]
}

export interface ResourceManifest {
  entries: ResourceEntry[]
}

const IS_WINDOWS = sep === "\\"

const IMG_SRC_RE = /<img\b[^>]*?\bsrc=(['"])(.*?)\1/gi
const SCRIPT_SRC_RE = /<script\b[^>]*?\bsrc=(['"])(.*?)\1/gi
const LINK_HREF_RE = /<link\b[^>]*?\bhref=(['"])(.*?)\1/gi
const SOURCE_SRC_RE = /<source\b[^>]*?\bsrc=(['"])(.*?)\1/gi
const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi
const INLINE_SCRIPT_BLOCK_RE = /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi
const CSS_URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/g
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*(['"]?)(.*?)\1\s*\)|(['"])(.*?)\3)\s*;/g

const DATA_URL_RE = /^data:/i
const BLOB_URL_RE = /^blob:/i
const REMOTE_SCHEME_RE = /^https?:\/\//i
const WINDOWS_ABS_RE = /^[a-z]:[\\/]/i

function isSkippable(src: string): boolean {
  const t = src.trim()
  if (!t) return true
  if (DATA_URL_RE.test(t)) return true
  if (BLOB_URL_RE.test(t)) return true
  if (/^(?:mailto|tel):/i.test(t)) return true
  return false
}

function isRemote(src: string): boolean {
  return REMOTE_SCHEME_RE.test(src.trim())
}

function makeKey(
  resourceClass: ResourceClass,
  localPath?: string,
  remoteUrl?: string,
): string {
  if (resourceClass === "remote" && remoteUrl) {
    try {
      const u = new URL(remoteUrl)
      return `remote:${u.origin}${u.pathname}`.toLowerCase()
    } catch {
      return `remote:${remoteUrl}`.toLowerCase()
    }
  }
  if (localPath) {
    const n = resolve(localPath)
    return `local:${IS_WINDOWS ? n.toLowerCase() : n}`
  }
  return ""
}

function resolveLocalRef(src: string, baseDir: string): string | null {
  const trimmed = src.trim()
  if (!trimmed || isSkippable(trimmed) || isRemote(trimmed)) return null

  if (trimmed.startsWith("file://")) {
    try {
      return fileURLToPath(trimmed)
    } catch {
      return null
    }
  }

  const noSuffix = trimmed.replace(/[?#].*$/, "")
  let decoded: string
  try {
    decoded = decodeURIComponent(noSuffix)
  } catch {
    decoded = noSuffix
  }
  if (!decoded) return null

  if (WINDOWS_ABS_RE.test(decoded) || decoded.startsWith("/")) {
    return normalize(decoded)
  }

  return normalize(resolve(baseDir, decoded.replace(/^[/\\]+/, "")))
}

function collectHtmlRefs(html: string): Array<{ src: string; surface: string }> {
  const refs: Array<{ src: string; surface: string }> = []

  const htmlWithoutScripts = html.replace(INLINE_SCRIPT_BLOCK_RE, "")

  const patterns = [IMG_SRC_RE, SCRIPT_SRC_RE, LINK_HREF_RE, SOURCE_SRC_RE]
  for (const pat of patterns) {
    pat.lastIndex = 0
    for (const m of htmlWithoutScripts.matchAll(pat)) {
      const src = m[2]
      if (src && !isSkippable(src)) {
        refs.push({ src, surface: m[0].slice(0, 120) })
      }
    }
  }

  STYLE_BLOCK_RE.lastIndex = 0
  for (const block of html.matchAll(STYLE_BLOCK_RE)) {
    CSS_URL_RE.lastIndex = 0
    for (const um of block[1].matchAll(CSS_URL_RE)) {
      const url = um[2]?.trim()
      if (url && !isSkippable(url) && !isRemote(url)) {
        refs.push({ src: url, surface: `<style> → url(${url.slice(0, 60)})` })
      }
    }
  }

  return refs
}

export function buildManifest(
  html: string,
  options: {
    worktree: string
    runtimeEntries?: Array<{ localPath: string; label: string }>
  },
): ResourceManifest {
  const keyMap = new Map<string, ResourceEntry>()
  const entries: ResourceEntry[] = []

  function add(
    cls: ResourceClass,
    localPath: string | undefined,
    remoteUrl: string | undefined,
    surface: string | undefined,
  ): void {
    const key = makeKey(cls, localPath, remoteUrl)
    if (!key) return
    const existing = keyMap.get(key)
    if (existing) {
      if (surface && !existing.referringSurfaces.includes(surface)) {
        existing.referringSurfaces.push(surface)
      }
    } else {
      const entry: ResourceEntry = {
        key,
        resourceClass: cls,
        localPath,
        remoteUrl,
        referringSurfaces: surface ? [surface] : [],
      }
      keyMap.set(key, entry)
      entries.push(entry)
    }
  }

  for (const r of options.runtimeEntries ?? []) {
    add("runtime", r.localPath, undefined, `runtime:${r.label}`)
  }

  for (const ref of collectHtmlRefs(html)) {
    if (isRemote(ref.src)) {
      add("remote", undefined, ref.src, ref.surface)
    } else {
      const localPath = resolveLocalRef(ref.src, options.worktree)
      if (localPath) {
        add("local", localPath, undefined, ref.surface)
      }
    }
  }

  return { entries }
}

export async function expandCssTransitiveRefs(
  manifest: ResourceManifest,
): Promise<ResourceManifest> {
  const cssEntries = manifest.entries.filter(
    (e) => e.localPath && /\.css$/i.test(e.localPath),
  )
  if (cssEntries.length === 0) return manifest

  const keyMap = new Map<string, ResourceEntry>()
  for (const e of manifest.entries) keyMap.set(e.key, e)

  const visited = new Set<string>()

  function addEntry(
    cls: ResourceClass,
    localPath: string | undefined,
    remoteUrl: string | undefined,
    surface: string | undefined,
  ): void {
    const key = makeKey(cls, localPath, remoteUrl)
    if (!key) return
    const existing = keyMap.get(key)
    if (existing) {
      if (surface && !existing.referringSurfaces.includes(surface)) {
        existing.referringSurfaces.push(surface)
      }
    } else {
      const entry: ResourceEntry = {
        key,
        resourceClass: cls,
        localPath,
        remoteUrl,
        referringSurfaces: surface ? [surface] : [],
      }
      keyMap.set(key, entry)
      manifest.entries.push(entry)
    }
  }

  async function expandFrom(
    cssPath: string,
    parentClass: ResourceClass,
  ): Promise<void> {
    const norm = normalize(resolve(cssPath))
    const vk = IS_WINDOWS ? norm.toLowerCase() : norm
    if (visited.has(vk)) return
    visited.add(vk)

    let css: string
    try {
      css = await readFile(norm, "utf8")
    } catch {
      return
    }

    const cssDir = dirname(norm)

    CSS_IMPORT_RE.lastIndex = 0
    for (const m of css.matchAll(CSS_IMPORT_RE)) {
      const url = (m[2] || m[4])?.trim()
      if (!url || isSkippable(url)) continue
      if (isRemote(url)) {
        addEntry("remote", undefined, url, `${norm} @import`)
      } else {
        const resolved = resolveLocalRef(url, cssDir)
        if (resolved) {
          addEntry(parentClass, resolved, undefined, `${norm} @import`)
          if (/\.css$/i.test(resolved)) {
            await expandFrom(resolved, parentClass)
          }
        }
      }
    }

    CSS_URL_RE.lastIndex = 0
    for (const m of css.matchAll(CSS_URL_RE)) {
      const url = m[2]?.trim()
      if (!url || isSkippable(url) || isRemote(url)) continue
      const resolved = resolveLocalRef(url, cssDir)
      if (resolved) {
        addEntry(parentClass, resolved, undefined, `${norm} url()`)
      }
    }
  }

  await Promise.all(
    cssEntries.map((e) =>
      expandFrom(e.localPath!, e.resourceClass),
    ),
  )

  return manifest
}
