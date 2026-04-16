import { resolve, sep, extname, basename, relative, join } from "node:path"
import { stat, readFile } from "node:fs/promises"

import { tool } from "@opencode-ai/plugin"

import { renderToHtmlBundle } from "../services/html-pipeline.js"

const IS_WINDOWS = sep === "\\"

function normalizePath(p: string): string {
  const n = resolve(p)
  return IS_WINDOWS ? n.toLowerCase() : n
}

const TIMESTAMP_PATTERN = /-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}Z$/

function extractTitleFromStem(stem: string): string {
  return stem.replace(TIMESTAMP_PATTERN, "") || stem
}

export function createConvertMdToHtmlTool() {
  return tool({
    description:
      "Markdown 转 HTML 工具。读取已有的 .md 文件，渲染为带公式、图表、涂鸦板等交互功能的 HTML + 资源目录包。仅接受 output/ 目录下的 .md 文件。导出前验证所有引用资源的可访问性，不可达则转换失败。如需单文件离线包，请使用内联 HTML 资源工具。",
    args: {
      mdFilePath: tool
        .schema
        .string()
        .describe("要转换的 .md 文件的绝对路径或相对于工作区的路径"),
    },
    async execute(args, context) {
      const worktree = context.worktree || context.directory || process.cwd()
      const absolutePath = resolve(worktree, args.mdFilePath)

      if (extname(absolutePath).toLowerCase() !== ".md") {
        return "转换失败: 不是 Markdown 文件（扩展名必须为 .md）"
      }

      try {
        const s = await stat(absolutePath)
        if (!s.isFile()) {
          return "转换失败: 指定路径不是文件"
        }
      } catch {
        return "转换失败: 文件不存在"
      }

      const normalizedFile = normalizePath(absolutePath)
      const normalizedOutput = normalizePath(resolve(worktree, "output"))
      if (!normalizedFile.startsWith(normalizedOutput)) {
        return "转换失败: 文件路径超出 output/ 目录范围"
      }

      let content: string
      try {
        content = await readFile(absolutePath, "utf8")
      } catch {
        return "转换失败: 无法读取文件内容"
      }

      const stem = basename(absolutePath, ".md")
      const safeTitle = extractTitleFromStem(stem)
      const outputDir = resolve(worktree, "output")

      try {
        const result = await renderToHtmlBundle(worktree, outputDir, content, safeTitle)
        if (result.assetDir) {
          return `转换完成: ${result.relativePath}，资源目录 ${result.assetDir.relativePath}（需一起移动）`
        }
        return `转换完成: ${result.relativePath}`
      } catch (error) {
        return `转换失败: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
