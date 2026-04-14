import { mkdir, stat, writeFile } from "node:fs/promises"
import { join, relative } from "node:path"

export type ExportFormat = "markdown" | "html"

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

function renderHtmlDocument(title: string, content: string): string {
  const escapedTitle = title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  const escapedContent = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 40px auto; max-width: 860px; padding: 0 24px; color: #111827; line-height: 1.7; }
    h1 { font-size: 28px; margin-bottom: 24px; }
    article { white-space: pre-wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; }
  </style>
</head>
<body>
  <h1>${escapedTitle}</h1>
  <article>${escapedContent}</article>
</body>
</html>`
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function buildUniquePath(outputDir: string, baseName: string, extension: string): Promise<string> {
  const timestamp = buildTimestamp()
  let index = 0
  while (true) {
    const suffix = index === 0 ? "" : `-${index}`
    const candidate = join(outputDir, `${baseName}-${timestamp}${suffix}.${extension}`)
    if (!(await pathExists(candidate))) return candidate
    index += 1
  }
}

export async function exportDocument(worktree: string, input: {
  format: ExportFormat
  title?: string
  content: string
}): Promise<{ relativePath: string; absolutePath: string }> {
  if (input.content.trim() === "") {
    throw new Error("导出内容不能为空")
  }

  const outputDir = join(worktree, "output")
  await mkdir(outputDir, { recursive: true })

  const safeTitle = sanitizeTitle(input.title)
  const extension = input.format === "html" ? "html" : "md"
  const absolutePath = await buildUniquePath(outputDir, safeTitle, extension)
  const content = input.format === "html"
    ? renderHtmlDocument(safeTitle, input.content)
    : input.content

  await writeFile(absolutePath, content, "utf8")

  return {
    absolutePath,
    relativePath: relative(worktree, absolutePath).replace(/\\/g, "/"),
  }
}
