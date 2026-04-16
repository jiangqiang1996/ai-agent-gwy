export function handleMermaid(text: string): string {
  if (!text.trim()) {
    return '<div class="mermaid-container"><pre class="mermaid"></pre></div>'
  }
  return `<div class="mermaid-container"><pre class="mermaid">${escapeForHtml(text)}</pre></div>`
}

export function handleMarkmap(rootJson: string, index: number): string {
  return `<div class="markmap-container"><div class="markmap-host" id="markmap-${index}" data-markmap="${encodeURIComponent(rootJson)}"><svg></svg></div></div>`
}

export function handleChart(text: string, index: number): { html: string; accepted: boolean } {
  if (!text.trim()) {
    return {
      html: '<pre class="chart-error">Chart.js 配置不能为空</pre>',
      accepted: false,
    }
  }
  try {
    JSON.parse(text)
    const encoded = encodeURIComponent(text)
    return {
      html: `<div class="chart-container"><canvas id="chart-${index}" width="800" height="450" data-chart="${encoded}"></canvas></div>`,
      accepted: true,
    }
  } catch {
    return {
      html: `<pre class="chart-error">无效的 Chart.js JSON 配置:\n${escapeForHtml(text)}</pre>`,
      accepted: false,
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

export function handleCanvas(text: string, index: number): { html: string; accepted: boolean } {
  if (!text.trim()) {
    return {
      html: '<pre class="chart-error">Canvas 代码不能为空</pre>',
      accepted: false,
    }
  }
  for (const pattern of CANVAS_BLOCKED_PATTERNS) {
    if (text.includes(pattern)) {
      return {
        html: `<pre class="chart-error">Canvas 代码包含禁止的 API 调用: ${escapeForHtml(pattern)}</pre>`,
        accepted: false,
      }
    }
  }
  return {
    html: `<div class="canvas-container"><canvas id="canvas-${index}" width="800" height="450" data-canvas-script="${encodeURIComponent(text)}"></canvas></div>`,
    accepted: true,
  }
}

function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
