import { resolve, sep } from "node:path"
import { stat } from "node:fs/promises"

import { tool } from "@opencode-ai/plugin"

import { inlineHtmlResources } from "../services/inline-html-resources-service.js"

const IS_WINDOWS = sep === "\\"

function normalizePath(p: string): string {
  const n = resolve(p)
  return IS_WINDOWS ? n.toLowerCase() : n
}

export function createInlineHtmlResourcesTool() {
  return tool({
    description:
      "内联 HTML 资源工具。读取已有的 HTML 文件，将所有引用的本地和远程资源（图片、CSS、JS、字体等）内联为 data: URL 或内嵌内容，输出为同目录下的 *-inlined.html 文件。内联前验证所有资源的可访问性，任何资源不可达则操作失败，不产生半成品文件。仅当用户明确要求内联 HTML 资源时使用。",
    args: {
      htmlFilePath: tool
        .schema
        .string()
        .describe("要内联资源的 HTML 文件的绝对路径或相对于工作区的路径"),
    },
    async execute(args, context) {
      const worktree = context.worktree || context.directory || process.cwd()
      const absolutePath = resolve(worktree, args.htmlFilePath)

      try {
        const s = await stat(absolutePath)
        if (!s.isFile()) {
          return "内联失败: 指定路径不是文件"
        }
      } catch {
        return "内联失败: 文件不存在"
      }

      const htmlDir = resolve(absolutePath, "..")
      const normalizedHtmlDir = normalizePath(htmlDir)
      const normalizedWorktree = normalizePath(worktree)

      if (!normalizedHtmlDir.startsWith(normalizedWorktree)) {
        return "内联失败: HTML 文件路径超出工作区范围"
      }

      try {
        const result = await inlineHtmlResources(absolutePath, {
          allowedRoots: [htmlDir, worktree],
        })
        const relInlined = result.inlinedPath.replace(/\\/g, "/").split("/").pop()
        return `内联完成: ${relInlined}（原文件未修改）`
      } catch (error) {
        return `内联失败: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
