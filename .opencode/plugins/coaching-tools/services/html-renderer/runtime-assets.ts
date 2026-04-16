import { join } from "node:path"
import { fileURLToPath } from "node:url"

const NODE_MODULES_DIR = fileURLToPath(new URL("../../../../node_modules/", import.meta.url))

export interface RuntimeAssetFeatures {
  hasCanvas: boolean
  hasCharts: boolean
  hasKatex: boolean
  hasMarkmap: boolean
  hasMermaid: boolean
  hasScratchpad?: boolean
}

export interface RuntimeAssetInfo {
  localPath: string
  relPath: string
  label: string
  kind: "script" | "style"
}

function resolveNodeModulePath(relativePath: string): string {
  return join(NODE_MODULES_DIR, relativePath)
}

export function getNodeModulesDir(): string {
  return NODE_MODULES_DIR
}

export function getRuntimeAssetPaths(features: RuntimeAssetFeatures): RuntimeAssetInfo[] {
  const assets: RuntimeAssetInfo[] = []

  if (features.hasKatex) {
    assets.push({ localPath: resolveNodeModulePath("katex/dist/katex.min.css"), relPath: "katex/dist/katex.min.css", label: "katex-css", kind: "style" })
  }

  if (features.hasMermaid) {
    assets.push({ localPath: resolveNodeModulePath("mermaid/dist/mermaid.min.js"), relPath: "mermaid/dist/mermaid.min.js", label: "mermaid-js", kind: "script" })
  }

  if (features.hasCharts) {
    assets.push({ localPath: resolveNodeModulePath("chart.js/dist/chart.umd.min.js"), relPath: "chart.js/dist/chart.umd.min.js", label: "chart-js", kind: "script" })
  }

  if (features.hasMarkmap) {
    assets.push({ localPath: resolveNodeModulePath("d3/dist/d3.min.js"), relPath: "d3/dist/d3.min.js", label: "d3-js", kind: "script" })
    assets.push({ localPath: resolveNodeModulePath("markmap-view/dist/browser/index.js"), relPath: "markmap-view/dist/browser/index.js", label: "markmap-view-js", kind: "script" })
    assets.push({ localPath: resolveNodeModulePath("markmap-toolbar/dist/index.js"), relPath: "markmap-toolbar/dist/index.js", label: "markmap-toolbar-js", kind: "script" })
    assets.push({ localPath: resolveNodeModulePath("markmap-toolbar/dist/style.css"), relPath: "markmap-toolbar/dist/style.css", label: "markmap-toolbar-css", kind: "style" })
  }

  return assets
}

export function buildRuntimeAssetRefs(
  features: RuntimeAssetFeatures,
  assetRelDir: string,
): { styles: string; scripts: string } {
  const styles: string[] = []
  const scripts: string[] = []

  const refBase = `${assetRelDir}/runtime`

  if (features.hasKatex) {
    styles.push(`<link rel="stylesheet" href="${refBase}/katex/dist/katex.min.css">`)
  }

  if (features.hasMarkmap) {
    styles.push(`<link rel="stylesheet" href="${refBase}/markmap-toolbar/dist/style.css">`)
  }

  if (features.hasMermaid) {
    scripts.push(`<script src="${refBase}/mermaid/dist/mermaid.min.js"></script>`)
  }

  if (features.hasCharts) {
    scripts.push(`<script src="${refBase}/chart.js/dist/chart.umd.min.js"></script>`)
  }

  if (features.hasMarkmap) {
    scripts.push(`<script src="${refBase}/d3/dist/d3.min.js"></script>`)
    scripts.push(`<script src="${refBase}/markmap-view/dist/browser/index.js"></script>`)
    scripts.push(`<script src="${refBase}/markmap-toolbar/dist/index.js"></script>`)
  }

  return { styles: styles.join("\n"), scripts: scripts.join("\n") }
}
