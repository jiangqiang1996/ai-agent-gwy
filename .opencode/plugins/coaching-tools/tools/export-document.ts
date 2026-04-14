import { tool } from "@opencode-ai/plugin"

import { exportDocument } from "../services/export-service.js"

export function createExportDocumentTool() {
  return tool({
    description: "导出文档工具。将指定内容导出为 markdown 或 html 文件，输出到项目根目录的 output/ 下。",
    args: {
      format: tool.schema.enum(["markdown", "html"]).describe("导出格式"),
      title: tool.schema.string().optional().describe("文件标题/文件名候选"),
      content: tool.schema.string().describe("要导出的内容"),
    },
    async execute(args, context) {
      try {
        const result = await exportDocument(context.worktree, args)
        return `已导出到 ${result.relativePath}`
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
