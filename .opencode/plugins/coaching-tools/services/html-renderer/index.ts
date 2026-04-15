import { Marked } from "marked"
import markedKatex from "marked-katex-extension"

import { handleMermaid, handleChart, handleSvg, handleCanvas } from "./code-blocks.js"
import { CSS_TEMPLATE } from "./css-template.js"
import { buildClientScripts } from "./client-scripts.js"

export interface TocEntry {
  depth: number
  text: string
  id: string
}

export interface MarkdownRenderResult {
  html: string
  toc: TocEntry[]
  chartConfigs: (string | null)[]
  canvasScripts: string[]
}

const KATEX_VERSION = "0.16.45"
const MERMAID_VERSION = "11.6.0"
const CHARTJS_VERSION = "4.4.9"

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function textToId(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .trim()
}

function makeSlug(text: string, usedIds: Set<string>): string {
  const base = textToId(text)
  if (!usedIds.has(base)) {
    usedIds.add(base)
    return base
  }
  let i = 2
  while (usedIds.has(`${base}-${i}`)) i++
  const slug = `${base}-${i}`
  usedIds.add(slug)
  return slug
}

export function renderMarkdown(content: string): MarkdownRenderResult {
  const toc: TocEntry[] = []
  const chartConfigs: (string | null)[] = []
  const canvasScripts: string[] = []
  const usedIds = new Set<string>()

  let chartIndex = 0
  let canvasIndex = 0

  const marked = new Marked(
    markedKatex({ throwOnError: false }),
    {
      gfm: true,
      breaks: false,
    },
  )

  marked.use({
    renderer: {
      code({ text, lang }: { text: string; lang?: string }): string | false {
        switch (lang) {
          case "mermaid":
            return handleMermaid(text)
          case "chart": {
            const result = handleChart(text, chartIndex)
            chartConfigs.push(result.config)
            if (result.config !== null) chartIndex++
            return result.html
          }
          case "svg":
            return handleSvg(text)
          case "canvas": {
            const result = handleCanvas(text, canvasIndex)
            canvasScripts.push(result.script)
            if (result.script) canvasIndex++
            return result.html
          }
          default:
            return false
        }
      },
      heading({ tokens, depth }: { tokens: unknown[]; depth: number }): string {
        const text = (tokens || [])
          .map((t: unknown) =>
            typeof t === "object" && t !== null && "text" in t
              ? (t as { text: string }).text
              : typeof t === "object" && t !== null && "raw" in t
                ? (t as { raw: string }).raw
                : String(t),
          )
          .join("")
        const id = makeSlug(text, usedIds)
        toc.push({ depth, text, id })
        return `<h${depth} id="${escapeHtml(id)}">${(tokens as unknown[]).map(() => "").join("")}${escapeHtml(text)}</h${depth}>\n`
      },
    },
    walkTokens(token) {
      // walkTokens is used above via heading renderer; this hook is for any additional token walking
      void token
    },
  })

  const html = marked.parse(content) as string

  return { html, toc, chartConfigs, canvasScripts }
}

export function buildHtmlDocument(title: string, result: MarkdownRenderResult): string {
  const escapedTitle = escapeHtml(title)
  const { html, toc, chartConfigs, canvasScripts } = result

  const tocHtml =
    toc.length >= 2
      ? `<nav class="toc"><div class="toc-title">目录</div><ul>${toc
          .map(
            (entry) =>
              `<li class="toc-depth-${entry.depth}"><a href="#${escapeHtml(entry.id)}">${escapeHtml(entry.text)}</a></li>`,
          )
          .join("")}</ul></nav>`
      : ""

  const clientScript = buildClientScripts({ chartConfigs, canvasScripts })

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css" />
  <script defer src="https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/chart.js@${CHARTJS_VERSION}/dist/chart.umd.min.js"></script>
  <style>${CSS_TEMPLATE}</style>
</head>
<body>
  ${tocHtml}
  <main><article>${html}</article></main>
  ${clientScript}
</body>
</html>`
}
