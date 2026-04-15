export function buildClientScripts(options: {
  chartConfigs: (string | null)[]
  canvasScripts: string[]
}): string {
  const { chartConfigs, canvasScripts } = options
  const hasCharts = chartConfigs.some((c) => c !== null)
  const hasCanvas = canvasScripts.length > 0
  const hasMermaid = true

  const initBlocks: string[] = []

  if (hasMermaid) {
    initBlocks.push(`
    // Mermaid init
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: true, theme: 'default' });
      mermaid.run();
    }`)
  }

  if (hasCharts) {
    const configsJson = JSON.stringify(
      chartConfigs.map((c, i) => (c ? { index: i, config: c } : null)).filter(Boolean),
    )
    initBlocks.push(`
    // Chart.js init
    if (typeof Chart !== 'undefined') {
      var configs = ${configsJson};
      configs.forEach(function(item) {
        var canvas = document.getElementById('chart-' + item.index);
        if (!canvas) return;
        var parent = canvas.parentElement;
        if (parent) {
          canvas.width = parent.clientWidth || 800;
          canvas.height = Math.max(300, Math.round((parent.clientWidth || 800) * 0.6));
        }
        try {
          var config = JSON.parse(item.config);
          new Chart(canvas, config);
        } catch(e) {
          console.error('Chart.js init failed for chart-' + item.index, e);
        }
      });
    }`)
  }

  if (hasCanvas) {
    const scriptsJson = JSON.stringify(canvasScripts)
    initBlocks.push(`
    // Canvas init
    var scripts = ${scriptsJson};
    scripts.forEach(function(s) {
      if (!s) return;
      try { (new Function(s))(); } catch(e) { console.error('Canvas script error', e); }
    });`)
  }

  const parts: string[] = []

  parts.push(`
document.addEventListener('DOMContentLoaded', function() {
${initBlocks.join("\n")}
});
`)

  parts.push(`
// Tab switching
function switchTab(event, panelId) {
  var container = event.target.closest('.tabs');
  if (!container) return;
  container.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  container.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  event.target.classList.add('active');
  var panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}
`)

  parts.push(`
// TOC scroll highlight
document.addEventListener('DOMContentLoaded', function() {
  var nav = document.querySelector('nav.toc');
  if (!nav) return;
  var links = nav.querySelectorAll('a');
  if (links.length === 0) return;
  var headingIds = Array.from(links).map(function(a) { return a.getAttribute('href').slice(1); });
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        nav.querySelectorAll('li').forEach(function(li) { li.classList.remove('active'); });
        var link = nav.querySelector('a[href="#' + entry.target.id + '"]');
        if (link && link.parentElement) link.parentElement.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  headingIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) observer.observe(el);
  });
});
`)

  return `<script>${parts.join("\n")}</script>`
}
