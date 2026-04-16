export const CSS_TEMPLATE = `
:root {
  --primary: #4f46e5;
  --primary-light: #818cf8;
  --text: #1f2937;
  --text-light: #6b7280;
  --bg: #ffffff;
  --bg-alt: #f9fafb;
  --border: #e5e7eb;
  --border-light: #f3f4f6;
  --code-bg: #1e293b;
  --code-text: #e2e8f0;
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --sidebar-width: 260px;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--bg);
  line-height: 1.8;
  font-size: 16px;
  display: flex;
  min-height: 100vh;
}

body.no-toc main {
  margin: 0 auto;
}

nav.toc {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: var(--bg-alt);
  border-right: 1px solid var(--border);
  padding: 24px 16px;
  overflow-y: auto;
  font-size: 14px;
}

nav.toc .toc-title {
  font-weight: 700;
  color: var(--text);
  margin-bottom: 12px;
  font-size: 15px;
  letter-spacing: 0.5px;
}

nav.toc ul { list-style: none; }

nav.toc li {
  margin: 4px 0;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

nav.toc li:hover { background: var(--border-light); }

nav.toc li.active {
  background: #eef2ff;
  color: var(--primary);
  font-weight: 600;
}

nav.toc a {
  color: var(--text-light);
  text-decoration: none;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

nav.toc li.active a { color: var(--primary); }

nav.toc .toc-depth-2 { padding-left: 8px; }
nav.toc .toc-depth-3 { padding-left: 20px; }
nav.toc .toc-depth-4 { padding-left: 32px; }

main {
  margin-left: var(--sidebar-width);
  flex: 1;
  padding: 40px 48px;
  max-width: 900px;
}

article {
  background: var(--bg);
  max-width: 100%;
}

h1 { font-size: 28px; margin-bottom: 24px; border-bottom: 3px solid var(--primary); padding-bottom: 12px; color: var(--text); }
h2 { font-size: 24px; margin-top: 40px; margin-bottom: 16px; color: var(--text); padding-bottom: 8px; border-bottom: 1px solid var(--border); }
h3 { font-size: 20px; margin-top: 32px; margin-bottom: 12px; color: var(--text); }
h4 { font-size: 17px; margin-top: 24px; margin-bottom: 8px; color: var(--text-light); }

p { margin-bottom: 16px; }

strong { font-weight: 700; color: var(--text); }
em { font-style: italic; }

a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }

ul, ol { padding-left: 24px; margin-bottom: 16px; }
li { margin: 6px 0; }

table { border-collapse: collapse; width: 100%; margin: 20px 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
th, td { border: 1px solid var(--border); padding: 10px 14px; text-align: left; }
th { background: var(--bg-alt); font-weight: 600; color: var(--text); }
tr:nth-child(even) { background: var(--bg-alt); }
tr:hover { background: #eef2ff; }

code { background: var(--border-light); padding: 2px 6px; border-radius: 4px; font-size: 0.9em; font-family: var(--font-mono); color: var(--primary); }

pre { background: var(--code-bg); padding: 20px; border-radius: 8px; overflow-x: auto; margin: 16px 0; line-height: 1.6; }
pre code { background: none; padding: 0; color: var(--code-text); font-size: 14px; }

blockquote { border-left: 4px solid var(--primary); margin: 20px 0; padding: 12px 20px; background: var(--bg-alt); border-radius: 0 8px 8px 0; color: var(--text-light); }
blockquote p:last-child { margin-bottom: 0; }

hr { border: none; border-top: 1px solid var(--border); margin: 32px 0; }

img { display: block; max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 12px; margin: 16px auto; border: 1px solid var(--border); background: linear-gradient(180deg, #fff, var(--bg-alt)); box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08); }

details { margin: 16px 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
summary { padding: 12px 16px; background: var(--bg-alt); cursor: pointer; font-weight: 600; user-select: none; list-style: none; display: flex; align-items: center; gap: 8px; }
summary::before { content: "▸"; transition: transform 0.2s; font-size: 12px; }
details[open] summary::before { transform: rotate(90deg); }
details > *:not(summary) { padding: 0 16px; }

.tabs { margin: 16px 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.tab-buttons { display: flex; border-bottom: 1px solid var(--border); background: var(--bg-alt); }
.tab-btn { padding: 10px 20px; border: none; background: none; cursor: pointer; font-size: 14px; color: var(--text-light); font-family: var(--font-sans); transition: all 0.2s; border-bottom: 2px solid transparent; }
.tab-btn:hover { color: var(--primary); background: var(--border-light); }
.tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; background: var(--bg); }
.tab-panel { display: none; padding: 16px 20px; }
.tab-panel.active { display: block; }

.tip { position: relative; display: inline-block; border-bottom: 1px dashed var(--primary); cursor: help; color: var(--primary); }
.tip-text { visibility: hidden; position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%); background: var(--text); color: var(--bg); padding: 6px 12px; border-radius: 6px; font-size: 13px; white-space: nowrap; z-index: 10; opacity: 0; transition: opacity 0.2s; }
.tip-text::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-top-color: var(--text); }
.tip:hover .tip-text { visibility: visible; opacity: 1; }

.mermaid-container { margin: 20px 0; text-align: center; }
.mermaid-container pre.mermaid { background: var(--bg-alt); border: 1px solid var(--border); border-radius: 8px; padding: 20px; text-align: left; font-size: 14px; }

.chart-container { margin: 20px 0; text-align: center; }
.chart-container canvas { width: 100% !important; height: auto !important; max-width: 800px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); }

.svg-container { margin: 20px 0; text-align: center; }
.svg-container svg { max-width: 100%; height: auto; }

.canvas-container { margin: 20px 0; text-align: center; }
.canvas-container canvas { width: 100%; max-width: 800px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); }

.markmap-container { margin: 24px 0; border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: radial-gradient(circle at top, #ffffff, #f8fafc 58%, #eef2ff 100%); box-shadow: 0 18px 40px rgba(79, 70, 229, 0.08); }
.markmap-host { position: relative; min-height: 360px; }
.markmap-host > svg { display: block; width: 100%; min-height: 360px; }

pre.chart-error { background: #fef2f2; border: 1px solid #fecaca; color: var(--error); padding: 12px 16px; border-radius: 8px; font-family: var(--font-mono); font-size: 13px; }

.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
.badge-info { background: #dbeafe; color: #1d4ed8; }
.badge-success { background: #dcfce7; color: #15803d; }
.badge-warning { background: #fef3c7; color: #92400e; }
.badge-error { background: #fee2e2; color: #b91c1c; }

.callout { padding: 16px 20px; border-radius: 8px; margin: 16px 0; border-left: 4px solid var(--primary); }
.callout-info { background: #eff6ff; border-left-color: #3b82f6; }
.callout-warning { background: #fffbeb; border-left-color: #f59e0b; }
.callout-success { background: #f0fdf4; border-left-color: #10b981; }
.callout-error { background: #fef2f2; border-left-color: #ef4444; }

.katex-display { margin: 16px 0; overflow-x: auto; }

@media (max-width: 1024px) {
  nav.toc { display: none; }
  main { margin-left: 0; padding: 24px; }
}

@media print {
  nav.toc { display: none; }
  main { margin-left: 0; padding: 0; }
}
`.trim()

export const SCRATCHPAD_CSS = `
[data-exam-question] {
  position: relative;
}

.scratchpad-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.scratchpad-overlay.active {
  pointer-events: auto;
  cursor: crosshair;
  touch-action: none;
}

.scratchpad-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 11;
  display: flex;
  gap: 4px;
  background: rgba(255,255,255,0.95);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.scratchpad-btn {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg);
  cursor: pointer;
  font-size: 12px;
  font-family: var(--font-sans);
  color: var(--text);
  transition: background 0.15s;
}

.scratchpad-btn:hover {
  background: var(--border-light);
}

.scratchpad-btn.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.scratchpad-btn-danger:hover {
  background: #fee2e2;
  color: #b91c1c;
}
`.trim()
