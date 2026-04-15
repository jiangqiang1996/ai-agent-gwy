import { tool } from "@opencode-ai/plugin"

import { exportDocument } from "../services/export-service.js"

export function createExportDocumentTool() {
  return tool({
    description: "导出文档工具。将指定内容导出为 markdown 或 html 文件，输出到项目根目录的 output/ 下。content 始终传 Markdown 或纯文本，不要自己转 HTML，工具内部会自动渲染。",
    args: {
      format: tool.schema.enum(["markdown", "html"]).describe("导出格式"),
      title: tool.schema.string().optional().describe("文件标题/文件名候选"),
      content: tool.schema.string().describe("要导出的内容，始终传 Markdown 或纯文本，不要传 HTML"),
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
