export function handleMermaid(text: string): string {
  if (!text.trim()) {
    return '<div class="mermaid-container"><pre class="mermaid"></pre></div>'
  }
  return `<div class="mermaid-container"><pre class="mermaid">${escapeForHtml(text)}</pre></div>`
}

export function handleChart(text: string, index: number): { html: string; config: string | null } {
  if (!text.trim()) {
    return { html: `<div class="chart-container"><canvas id="chart-0" width="800" height="450"></canvas></div>`, config: null }
  }
  try {
    JSON.parse(text)
    const encoded = Buffer.from(text, "utf-8").toString("base64")
    return {
      html: `<div class="chart-container"><canvas id="chart-${index}" width="800" height="450" data-chart="${encoded}"></canvas></div>`,
      config: text,
    }
  } catch {
    return {
      html: `<pre class="chart-error">无效的 Chart.js JSON 配置:\n${escapeForHtml(text)}</pre>`,
      config: null,
    }
  }
}

export function handleSvg(text: string): string {
  if (!text.trim()) {
    return '<div class="svg-container"></div>'
  }
  const sanitized = text
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/\son\w+\s*=/gi, " data-removed=")
    .replace(/href\s*=\s*["']?\s*javascript:/gi, "data-removed=")
  return `<div class="svg-container">${sanitized}</div>`
}

const CANVAS_BLOCKED_PATTERNS = [
  "fetch(",
  "XMLHttpRequest",
  "eval(",
  "import(",
  "Function(",
  "setTimeout(",
  "setInterval(",
  "document.cookie",
  "window.location",
  "document.write",
  "document.body",
  "document.head",
  "window.open",
  "window[" ,
  "document[",
  "this.constructor",
  "__proto__",
  "prototype[",
]

export function handleCanvas(text: string, index: number): { html: string; script: string } {
  if (!text.trim()) {
    return { html: `<div class="canvas-container"><canvas id="canvas-${index}" width="800" height="450"></canvas></div>`, script: "" }
  }
  for (const pattern of CANVAS_BLOCKED_PATTERNS) {
    if (text.includes(pattern)) {
      return {
        html: `<pre class="chart-error">Canvas 代码包含禁止的 API 调用: ${escapeForHtml(pattern)}</pre>`,
        script: "",
      }
    }
  }
  return {
    html: `<div class="canvas-container"><canvas id="canvas-${index}" width="800" height="450"></canvas></div>`,
    script: `(function(){var canvas=document.getElementById("canvas-${index}");if(!canvas)return;canvas.width=canvas.parentElement.clientWidth||800;canvas.height=450;var ctx=canvas.getContext("2d");${text}})();`,
  }
}

function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
