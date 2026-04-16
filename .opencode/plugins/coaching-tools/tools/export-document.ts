import { tool } from "@opencode-ai/plugin"

import { exportDocument } from "../services/export-service.js"

export function createExportDocumentTool() {
  return tool({
    description: "导出文档工具。将指定内容导出为 markdown 或 html 文件，输出到项目根目录的 output/ 下。content 始终传 Markdown 或纯文本，不要自己转 HTML，工具内部会自动渲染；HTML 导出默认生成 HTML 文件 + 同级资源目录的引用模式包，导出前验证所有引用资源的可访问性，不可达则导出失败。如需单文件离线包，请使用内联 HTML 资源工具。",
    args: {
      format: tool.schema.enum(["markdown", "html"]).describe("导出格式"),
      title: tool.schema.string().optional().describe("文件标题/文件名候选"),
      content: tool.schema.string().describe("要导出的内容，始终传 Markdown 或纯文本，不要传 HTML"),
    },
    async execute(args, context) {
      const worktree = context.worktree || context.directory || process.cwd()
      try {
        const result = await exportDocument(worktree, args)
        if (result.assetDir) {
          return `已导出到 ${result.relativePath}，资源目录 ${result.assetDir.relativePath}（需一起移动）`
        }
        return `已导出到 ${result.relativePath}`
      } catch (error) {
        return `导出失败: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
