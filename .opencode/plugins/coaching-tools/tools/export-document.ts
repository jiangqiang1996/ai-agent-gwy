import { tool } from "@opencode-ai/plugin"

import { exportDocument } from "../services/export-service.js"

export function createExportDocumentTool() {
  return tool({
    description: "导出 Markdown 文件工具。将指定内容导出为 .md 文件，输出到项目根目录的 output/ 下。content 传 Markdown 或纯文本。如需带公式渲染、图表、涂鸦板等交互功能的 HTML 版本，导出 .md 后再使用 convert-md-to-html 工具转换。",
    args: {
      title: tool.schema.string().optional().describe("文件标题/文件名候选"),
      content: tool.schema.string().describe("要导出的内容，Markdown 或纯文本"),
    },
    async execute(args, context) {
      const worktree = context.worktree || context.directory || process.cwd()
      try {
        const result = await exportDocument(worktree, args)
        return `已导出到 ${result.relativePath}`
      } catch (error) {
        return `导出失败: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
