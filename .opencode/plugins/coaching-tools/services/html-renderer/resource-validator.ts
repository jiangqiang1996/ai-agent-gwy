import { normalize, resolve, sep } from "node:path"
import { stat } from "node:fs/promises"

import type { ResourceEntry, ResourceManifest } from "./resource-manifest.js"

export interface ValidationFailure {
  resourceKey: string
  reason: string
  referringSurfaces: string[]
}

export interface ValidationReport {
  valid: boolean
  failures: ValidationFailure[]
  checkedCount: number
}

export interface ValidationOptions {
  allowedRoots: string[]
  remoteTimeout?: number
}

const IS_WINDOWS = sep === "\\"

function isPathWithinRoot(filePath: string, root: string): boolean {
  const np = normalize(resolve(filePath))
  const nr = normalize(resolve(root))
  if (IS_WINDOWS) {
    const npLow = np.toLowerCase()
    const nrLow = nr.toLowerCase()
    if (npLow === nrLow) return true
    return npLow.startsWith(nrLow + "\\")
  }
  if (np === nr) return true
  return np.startsWith(nr + "/")
}

export function isBlockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "")

  if (h === "localhost") return true
  if (h.endsWith(".localhost")) return true
  if (h === "0.0.0.0" || h === "[::]" || h === "::") return true
  if (h === "::1") return true

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (ipv4) {
    const a = Number(ipv4[1])
    const b = Number(ipv4[2])
    if (a === 0 || a === 127) return true
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
  }

  if (h.startsWith("fe80:") || h.startsWith("[fe80:")) return true
  if (/^f[cd]/.test(h) || h.startsWith("[fc") || h.startsWith("[fd")) return true

  return false
}

export function validateRemoteUrlSafety(
  url: string,
): { safe: boolean; reason: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { safe: false, reason: `无效的 URL: ${url}` }
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: `不允许的协议: ${parsed.protocol}` }
  }

  if (!parsed.hostname) {
    return { safe: false, reason: "URL 缺少主机名" }
  }

  if (isBlockedHostname(parsed.hostname)) {
    return { safe: false, reason: `被阻止的目标地址: ${parsed.hostname}` }
  }

  return { safe: true, reason: "" }
}

async function validateLocal(
  entry: ResourceEntry,
  allowedRoots: string[],
): Promise<ValidationFailure | null> {
  if (!entry.localPath) {
    return {
      resourceKey: entry.key,
      reason: "本地资源缺少路径",
      referringSurfaces: [...entry.referringSurfaces],
    }
  }

  if (entry.resourceClass !== "runtime") {
    const within = allowedRoots.some((r) =>
      isPathWithinRoot(entry.localPath!, r),
    )
    if (!within) {
      return {
        resourceKey: entry.key,
        reason: `本地路径超出允许范围: ${entry.localPath}`,
        referringSurfaces: [...entry.referringSurfaces],
      }
    }
  }

  try {
    const s = await stat(entry.localPath)
    if (!s.isFile()) {
      return {
        resourceKey: entry.key,
        reason: `路径不是文件: ${entry.localPath}`,
        referringSurfaces: [...entry.referringSurfaces],
      }
    }
  } catch {
    return {
      resourceKey: entry.key,
      reason: `本地文件不存在或不可读: ${entry.localPath}`,
      referringSurfaces: [...entry.referringSurfaces],
    }
  }

  return null
}

async function tryFetchUrl(
  url: string,
  method: string,
  timeout: number,
): Promise<{ ok: boolean; reason: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: "follow",
    })
    if (response.ok) return { ok: true, reason: "" }
    return { ok: false, reason: `HTTP ${response.status}` }
  } catch (error: unknown) {
    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      return { ok: false, reason: "请求超时" }
    }
    if (
      error instanceof TypeError &&
      /redirect/i.test(error.message)
    ) {
      return { ok: false, reason: "重定向次数过多或循环" }
    }
    const msg =
      error instanceof Error ? error.message : "网络请求失败"
    return { ok: false, reason: msg }
  } finally {
    clearTimeout(timer)
  }
}

async function checkReachability(
  url: string,
  timeout: number,
): Promise<{ ok: boolean; reason: string }> {
  const head = await tryFetchUrl(url, "HEAD", timeout)
  if (head.ok) return head
  const get = await tryFetchUrl(url, "GET", timeout)
  return get
}

async function validateRemote(
  entry: ResourceEntry,
  timeout: number,
): Promise<ValidationFailure | null> {
  if (!entry.remoteUrl) {
    return {
      resourceKey: entry.key,
      reason: "远程资源缺少 URL",
      referringSurfaces: [...entry.referringSurfaces],
    }
  }

  const safety = validateRemoteUrlSafety(entry.remoteUrl)
  if (!safety.safe) {
    return {
      resourceKey: entry.key,
      reason: safety.reason,
      referringSurfaces: [...entry.referringSurfaces],
    }
  }

  const reach = await checkReachability(entry.remoteUrl, timeout)
  if (!reach.ok) {
    return {
      resourceKey: entry.key,
      reason: `远程资源不可达: ${reach.reason}`,
      referringSurfaces: [...entry.referringSurfaces],
    }
  }

  return null
}

export async function validateResources(
  manifest: ResourceManifest,
  options: ValidationOptions,
): Promise<ValidationReport> {
  const { allowedRoots, remoteTimeout = 5000 } = options
  const failures: ValidationFailure[] = []

  const localEntries = manifest.entries.filter(
    (e) => e.resourceClass === "local" || e.resourceClass === "runtime",
  )
  const remoteEntries = manifest.entries.filter(
    (e) => e.resourceClass === "remote",
  )

  const [localResults, remoteResults] = await Promise.all([
    Promise.all(
      localEntries.map((e) => validateLocal(e, allowedRoots)),
    ),
    Promise.all(
      remoteEntries.map((e) => validateRemote(e, remoteTimeout)),
    ),
  ])

  for (const f of localResults) {
    if (f) failures.push(f)
  }
  for (const f of remoteResults) {
    if (f) failures.push(f)
  }

  return {
    valid: failures.length === 0,
    failures,
    checkedCount: manifest.entries.length,
  }
}
