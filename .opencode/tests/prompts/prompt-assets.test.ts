import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

async function readPromptAsset(relativePath: string): Promise<string> {
  const filePath = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url))
  return readFile(filePath, "utf8")
}

describe("prompt assets", () => {
  it("ships the shared rules required by the new prompt architecture", async () => {
    await expect(readPromptAsset("rules/exam-context.md")).resolves.toContain("考试上下文共享规则")
    await expect(readPromptAsset("rules/champion-routing.md")).resolves.toContain("状元路由共享规则")
    await expect(readPromptAsset("rules/summary-first-workflow.md")).resolves.toContain("总结优先工作流")
    await expect(readPromptAsset("rules/export-workflow.md")).resolves.toContain("导出工作流共享规则")
    await expect(readPromptAsset("rules/output-format.md")).resolves.toContain("输出格式共享规则")
    await expect(readPromptAsset("rules/prompt-authoring.md")).resolves.toContain("提示词编写规则")
  })

  it("documents HTML conversion as validated reference-mode by default", async () => {
    const workflow = await readPromptAsset("rules/export-workflow.md")
    const exportHtml = await readPromptAsset("skills/export-html/SKILL.md")

    expect(workflow).toContain("思维导图 / 知识图谱")
    expect(workflow).toContain("验证引用优先")
    expect(workflow).toContain("必须一起移动才有效")
    expect(workflow).toContain("所有导出一律先写 .md 文件")
    expect(exportHtml).toContain("```markmap")
    expect(exportHtml).toContain("同级资源目录")
    expect(exportHtml).toContain("data-exam-question")
    expect(exportHtml).toContain("convert-md-to-html")
  })

  it("removes duplicated exam-context blocks from specialist teacher prompts", async () => {
    const teacherFiles = [
      "agents/xingce-zong-teacher.md",
      "agents/xingce-yanyu-teacher.md",
      "agents/xingce-shuliang-teacher.md",
      "agents/xingce-panduan-teacher.md",
      "agents/xingce-ziliao-teacher.md",
      "agents/xingce-changshi-teacher.md",
      "agents/xingce-zhengzhi-teacher.md",
    ]

    for (const teacherFile of teacherFiles) {
      const content = await readPromptAsset(teacherFile)
      expect(content).not.toContain("## 考试类型与地区感知")
    }
  })

  it("updates orchestrator to consume summary-first and champion-routing rules", async () => {
    const content = await readPromptAsset("agents/orchestrator.md")

    expect(content).toContain("共享规则选中的状元代理")
    expect(content).toContain(".opencode/rules/champion-routing.md")
    expect(content).toContain(".opencode/rules/summary-first-workflow.md")
    expect(content).toContain("题目输入与讲解遵循")
    expect(content).toContain("身份=[用户identity]")
    expect(content).toContain("QuestionArtifact")
    expect(content).toContain("申论题型指导/材料分析/大作文讲解")
  })

  it("keeps the profile creation flow from forcing an immediate follow-up update", async () => {
    const content = await readPromptAsset("agents/orchestrator.md")

    expect(content).toContain("先补齐可选资料再调用 `loadOrCreate`")
    expect(content).toContain("允许直接调用 `loadOrCreate` 创建最小档案")
  })

  it("does not promise unsupported doc/docx parsing in the shared question flow", async () => {
    const workflow = await readPromptAsset("rules/question-input-workflow.md")
    const skill = await readPromptAsset("skills/explain-question/SKILL.md")

    expect(workflow).toContain("优先支持 `.txt`、`.md`、`.pdf` 与图片格式")
    expect(workflow).toContain("不要假设 `read` 能稳定解析")
    expect(skill).toContain("若是 `.doc` / `.docx`，先请用户转成更稳定的格式")
  })

  it("ensures specialist teacher prompts follow summary-first framing without 出题原则 sections", async () => {
    const teacherFiles = [
      { file: "agents/xingce-yanyu-teacher.md", name: "言语" },
      { file: "agents/xingce-shuliang-teacher.md", name: "数量" },
      { file: "agents/xingce-panduan-teacher.md", name: "判断" },
      { file: "agents/xingce-ziliao-teacher.md", name: "资料" },
      { file: "agents/xingce-changshi-teacher.md", name: "常识" },
      { file: "agents/xingce-zhengzhi-teacher.md", name: "政治" },
      { file: "agents/xingce-zong-teacher.md", name: "行测总" },
    ]

    for (const { file, name } of teacherFiles) {
      const content = await readPromptAsset(file)
      expect(content).not.toContain("## 出题原则")
      expect(content).toContain("总结优先")
      expect(content).toContain("题目响应")
    }
  })

  it("keeps the political theory prompt typo fixed", async () => {
    const content = await readPromptAsset("agents/xingce-zhengzhi-teacher.md")

    expect(content).toContain("中国特色社会主义理论体系")
    expect(content).not.toContain("主度理论体系")
  })

  it("ships the new specialist teacher prompts", async () => {
    await expect(readPromptAsset("agents/xingce-kexue-teacher.md")).resolves.toContain("广东省考科学推理题型")
    await expect(readPromptAsset("agents/shenlun-zong-teacher.md")).resolves.toContain("申论总老师")
  })

  it("documents the scratchpad marker contract and inline-HTML separation in the export rule", async () => {
    const workflow = await readPromptAsset("rules/export-workflow.md")
    const exportHtml = await readPromptAsset("skills/export-html/SKILL.md")

    expect(workflow).toContain("data-exam-question")
    expect(workflow).toContain("内联已有 HTML 资源")
    expect(workflow).toContain("inline-html")
    expect(exportHtml).toContain("<section data-exam-question>")
    expect(exportHtml).toContain("涂鸦板")
  })

  it("preserves the only-write-on-explicit-intent rule after contract migration", async () => {
    const workflow = await readPromptAsset("rules/export-workflow.md")
    const exportHtml = await readPromptAsset("skills/export-html/SKILL.md")
    const exportMd = await readPromptAsset("skills/export-markdown/SKILL.md")

    expect(workflow).toContain("只有在用户明确要求导出时才写文件")
    expect(exportHtml).toContain("只有显式导出意图时才落文件")
    expect(exportMd).toContain("只有显式导出意图时才落文件")
  })

  it("ships the inline-html skill with explicit intent guardrails", async () => {
    const skill = await readPromptAsset("skills/inline-html/SKILL.md")

    expect(skill).toContain("inline-html-resources")
    expect(skill).toContain("仅在用户明确要求时触发")
    expect(skill).toContain("不产生半成品文件")
    expect(skill).toContain("原始 HTML 文件保持不变")
  })

  it("tool description for export-document matches the markdown-only contract", async () => {
    const { createExportDocumentTool } = await import("../../plugins/coaching-tools/tools/export-document.js")
    const tool = createExportDocumentTool()
    const desc = (tool as unknown as { description: string }).description

    expect(desc).toContain("Markdown")
    expect(desc).toContain("convert-md-to-html")
    expect(desc).not.toContain("format")
  })

  it("tool description for convert-md-to-html matches the conversion contract", async () => {
    const { createConvertMdToHtmlTool } = await import("../../plugins/coaching-tools/tools/convert-md-to-html.js")
    const tool = createConvertMdToHtmlTool()
    const desc = (tool as unknown as { description: string }).description

    expect(desc).toContain("Markdown")
    expect(desc).toContain("HTML")
    expect(desc).toContain("验证")
    expect(desc).toContain("不可达则转换失败")
  })

  it("tool description for inline-html-resources matches the explicit inline contract", async () => {
    const { createInlineHtmlResourcesTool } = await import("../../plugins/coaching-tools/tools/inline-html-resources.js")
    const tool = createInlineHtmlResourcesTool()
    const desc = (tool as unknown as { description: string }).description

    expect(desc).toContain("内联")
    expect(desc).toContain("不产生半成品文件")
    expect(desc).toContain("仅当用户明确要求")
  })

  it("export-html skill and export-workflow rule agree on the bundle contract", async () => {
    const workflow = await readPromptAsset("rules/export-workflow.md")
    const exportHtml = await readPromptAsset("skills/export-html/SKILL.md")

    const sharedTerms = [
      "同级资源目录",
      "必须一起移动",
      "data-exam-question",
      "内联",
    ]

    for (const term of sharedTerms) {
      expect(workflow).toContain(term)
      expect(exportHtml).toContain(term)
    }

    expect(workflow).toContain("验证引用优先")
    expect(exportHtml).toContain("引用")
  })

  it("export-workflow rule describes the two-step md-first flow", async () => {
    const workflow = await readPromptAsset("rules/export-workflow.md")

    expect(workflow).toContain("export-document")
    expect(workflow).toContain("convert-md-to-html")
    expect(workflow).toContain("HTML 只能从已有的 .md 文件转换")
  })

  it("documents measurable performance budgets in the export workflow", async () => {
    const workflow = await readPromptAsset("rules/export-workflow.md")
    const exportHtml = await readPromptAsset("skills/export-html/SKILL.md")

    expect(workflow).toContain("性能预算")
    expect(workflow).toContain("p50")
    expect(workflow).toContain("p95")
    expect(workflow).toContain("不会在单次转换中重复复制相同资源")

    expect(exportHtml).toContain("性能预算")
    expect(exportHtml).toContain("不会在单次转换中重复复制相同资源")
  })

  it("preserves the clear separation between default export and explicit inline", async () => {
    const workflow = await readPromptAsset("rules/export-workflow.md")
    const exportHtml = await readPromptAsset("skills/export-html/SKILL.md")
    const inlineHtml = await readPromptAsset("skills/inline-html/SKILL.md")

    expect(workflow).toContain("独立的工作流")
    expect(workflow).toContain("inline-html")

    expect(exportHtml).toContain("如需单文件离线包")
    expect(exportHtml).toContain("内联 HTML 资源功能")

    expect(inlineHtml).toContain("仅在用户明确要求时触发")
    expect(inlineHtml).toContain("不要")
    expect(inlineHtml).toContain("自动触发")
  })
})