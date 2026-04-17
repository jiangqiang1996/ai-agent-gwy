import { Marked } from "marked"
import { Transformer } from "markmap-lib"
import markedKatex from "marked-katex-extension"

import { handleMermaid, handleMarkmap, handleChart, handleSvg, handleCanvas } from "./code-blocks.js"
import { CSS_TEMPLATE, SCRATCHPAD_CSS } from "./css-template.js"
import { buildClientScripts } from "./client-scripts.js"
import { buildRuntimeAssetRefs } from "./runtime-assets.js"

export interface TocEntry {
  depth: number
  text: string
  id: string
}

export interface MarkdownRenderResult {
  html: string
  toc: TocEntry[]
  features: {
    hasCanvas: boolean
    hasCharts: boolean
    hasKatex: boolean
    hasMarkmap: boolean
    hasMermaid: boolean
    hasScratchpad: boolean
  }
}

export interface RenderMarkdownOptions {
  worktree: string
}

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
    .normalize("NFKC")
    .trim()
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\p{Script=Han}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "section"
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

function extractTokenText(tokens: unknown[]): string {
  return tokens
    .map((token) => {
      if (typeof token !== "object" || token === null) return ""

      if ("tokens" in token && Array.isArray((token as { tokens?: unknown[] }).tokens)) {
        return extractTokenText((token as { tokens: unknown[] }).tokens)
      }

      if ("text" in token && typeof (token as { text?: unknown }).text === "string") {
        return (token as { text: string }).text
      }

      if ("raw" in token && typeof (token as { raw?: unknown }).raw === "string") {
        return (token as { raw: string }).raw
      }

      return ""
    })
    .join("")
}

const QUESTION_MARKER_RE = /(?:【(?:例题|题目|练习|真题|考题)】|(?<![^\n])\*\*(?:【)?(?:例题|题目|练习|真题|考题)(?:】)?\*\*)/
const OPTION_LINE_RE = /^[A-D][.．、)\s]/
const ANSWER_LINE_RE = /(?:正确答案[：:]\s*[A-D]|答案[：:]\s*[A-D]|选\s*[A-D])/
const DETAILS_OPEN_RE = /<details[\s>]/
const EXAM_QUESTION_RE = /data-exam-question/

function autoWrapQuestions(html: string): string {
  if (EXAM_QUESTION_RE.test(html)) return html
  if (!QUESTION_MARKER_RE.test(html) && !OPTION_LINE_RE.test(html)) return html

  const lines = html.split("\n")
  const result: string[] = []
  let inQuestion = false
  let questionLines: string[] = []
  let foundOptions = false

  function flushQuestion(): void {
    if (inQuestion && questionLines.length > 0) {
      const answerIdx = questionLines.findIndex((l) => ANSWER_LINE_RE.test(l.trim()) || DETAILS_OPEN_RE.test(l))
      let body: string
      if (answerIdx > 0) {
        const questionPart = questionLines.slice(0, answerIdx).join("\n")
        const answerPart = questionLines.slice(answerIdx).join("\n")
        const insideDetails = DETAILS_OPEN_RE.test(answerPart)
        if (insideDetails) {
          body = questionPart + "\n" + answerPart
        } else {
          body = questionPart + '\n<details>\n<summary>点击查看答案与解析</summary>\n\n' + answerPart + "\n\n</details>"
        }
      } else {
        body = questionLines.join("\n")
      }
      result.push('<section data-exam-question>', body, "</section>")
    } else {
      for (const l of questionLines) result.push(l)
    }
    questionLines = []
    inQuestion = false
    foundOptions = false
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (EXAM_QUESTION_RE.test(trimmed)) {
      flushQuestion()
      result.push(line)
      continue
    }

    if (trimmed.startsWith("<h") && /^<h[1-6]/.test(trimmed)) {
      flushQuestion()
      result.push(line)
      continue
    }

    const isQuestionStart = QUESTION_MARKER_RE.test(trimmed)
    const isOptionLine = OPTION_LINE_RE.test(trimmed)

    if (isQuestionStart && inQuestion) {
      flushQuestion()
    }

    if (!inQuestion && (isQuestionStart || isOptionLine)) {
      inQuestion = true
      questionLines = [line]
      if (isOptionLine) foundOptions = true
      continue
    }

    if (inQuestion) {
      if (isOptionLine) foundOptions = true
      if (trimmed === "" && foundOptions && i + 1 < lines.length) {
        const nextTrimmed = lines[i + 1].trim()
        if (ANSWER_LINE_RE.test(nextTrimmed) || DETAILS_OPEN_RE.test(nextTrimmed) || QUESTION_MARKER_RE.test(nextTrimmed) || /^<h[1-6]/.test(nextTrimmed)) {
          questionLines.push(line)
          flushQuestion()
          continue
        }
      }
      questionLines.push(line)
      continue
    }

    result.push(line)
  }

  flushQuestion()

  return result.join("\n")
}

export async function renderMarkdown(content: string, options: RenderMarkdownOptions): Promise<MarkdownRenderResult> {
  const toc: TocEntry[] = []
  const usedIds = new Set<string>()
  const features = {
    hasCanvas: false,
    hasCharts: false,
    hasKatex: false,
    hasMarkmap: false,
    hasMermaid: false,
    hasScratchpad: false,
  }

  let chartIndex = 0
  let canvasIndex = 0
  let markmapIndex = 0
  let markmapTransformer: Transformer | null = null

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
        switch (lang?.toLowerCase()) {
          case "mermaid":
            features.hasMermaid = true
            return handleMermaid(text)
          case "markmap":
          case "mindmap": {
            try {
              markmapTransformer ||= new Transformer()
              const root = markmapTransformer.transform(text).root
              const html = handleMarkmap(JSON.stringify(root), markmapIndex)
              markmapIndex++
              features.hasMarkmap = true
              return html
            } catch {
              return `<pre class="chart-error">无效的 Markmap / Mindmap 内容:\n${escapeHtml(text)}</pre>`
            }
          }
          case "chart": {
            const result = handleChart(text, chartIndex)
            if (result.accepted) {
              chartIndex++
              features.hasCharts = true
            }
            return result.html
          }
          case "svg":
            return handleSvg(text)
          case "canvas": {
            const result = handleCanvas(text, canvasIndex)
            if (result.accepted) {
              canvasIndex++
              features.hasCanvas = true
            }
            return result.html
          }
          default:
            return false
        }
      },
      heading(this: { parser: { parseInline(tokens: unknown[]): string } }, { tokens, depth }: { tokens: unknown[]; depth: number }): string {
        const text = extractTokenText(tokens || [])
        const id = makeSlug(text, usedIds)
        toc.push({ depth, text, id })
        return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`
      },
    },
    walkTokens(token) {
      void token
    },
  })

  const rawHtml = marked.parse(content) as string
  const html = autoWrapQuestions(rawHtml)
  features.hasKatex = html.includes("class=\"katex")
  features.hasScratchpad = html.includes("data-exam-question")

  return { html, toc, features }
}

export function buildHtmlDocument(title: string, result: MarkdownRenderResult, assetRelDir: string): string {
  const escapedTitle = escapeHtml(title)
  const { html, toc, features } = result
  const bodyClass = toc.length >= 2 ? "has-toc" : "no-toc"

  const tocHtml =
    toc.length >= 2
      ? `<nav class="toc"><div class="toc-title">目录</div><ul>${toc
          .map(
            (entry) =>
              `<li class="toc-depth-${entry.depth}"><a href="#${escapeHtml(entry.id)}">${escapeHtml(entry.text)}</a></li>`,
          )
          .join("")}</ul></nav>`
      : ""

  const runtimeAssets = buildRuntimeAssetRefs(features, assetRelDir)
  const clientScript = buildClientScripts(features)
  const fullCss = features.hasScratchpad ? CSS_TEMPLATE + "\n" + SCRATCHPAD_CSS : CSS_TEMPLATE

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapedTitle}</title>
  ${runtimeAssets.styles}
  <style>${fullCss}</style>
</head>
<body class="${bodyClass}">
  ${tocHtml}
  <main><article>${html}</article></main>
  ${runtimeAssets.scripts}
  ${clientScript}
</body>
</html>`
}
