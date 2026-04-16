export interface ClientScriptOptions {
  hasCanvas: boolean
  hasCharts: boolean
  hasKatex: boolean
  hasMarkmap: boolean
  hasMermaid: boolean
  hasScratchpad: boolean
}

function escapeInlineScript(text: string): string {
  return text
    .replace(/<\/script/gi, "<\\/script")
    .replace(/<!--/g, "<\\!--")
}

export function buildClientScripts(options: ClientScriptOptions): string {
  const { hasCanvas, hasCharts, hasMarkmap, hasMermaid, hasScratchpad } = options

  const initBlocks: string[] = []

  if (hasMermaid) {
    initBlocks.push(`
    // Mermaid init
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
      mermaid.run({ querySelector: '.mermaid' });
    }`)
  }

  if (hasCharts) {
    initBlocks.push(`
    // Chart.js init
    if (typeof Chart !== 'undefined') {
      document.querySelectorAll('canvas[data-chart]').forEach(function(canvas) {
        if (!canvas) return;
        var parent = canvas.parentElement;
        if (parent) {
          canvas.width = parent.clientWidth || 800;
          canvas.height = Math.max(300, Math.round((parent.clientWidth || 800) * 0.6));
        }
        try {
          var encoded = canvas.getAttribute('data-chart') || '';
          var config = JSON.parse(decodeURIComponent(encoded));
          new Chart(canvas, config);
        } catch(e) {
          console.error('Chart.js init failed', e);
        }
      });
    }`)
  }

  if (hasCanvas) {
    initBlocks.push(`
    // Canvas init
    document.querySelectorAll('canvas[data-canvas-script]').forEach(function(canvas) {
      try {
        var parent = canvas.parentElement;
        if (parent) {
          canvas.width = parent.clientWidth || 800;
          canvas.height = Math.max(320, Math.round((parent.clientWidth || 800) * 0.56));
        }
        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        var encoded = canvas.getAttribute('data-canvas-script') || '';
        var draw = new Function('canvas', 'ctx', decodeURIComponent(encoded));
        draw(canvas, ctx);
      } catch(e) {
        console.error('Canvas script error', e);
      }
    });`)
  }

  if (hasMarkmap) {
    initBlocks.push(`
    // Markmap init
    if (window.markmap && window.markmap.Markmap) {
      document.querySelectorAll('.markmap-host[data-markmap]').forEach(function(host) {
        try {
          var svg = host.querySelector('svg');
          if (!svg) return;
          var encoded = host.getAttribute('data-markmap') || '';
          var data = JSON.parse(decodeURIComponent(encoded));
          var mm = window.markmap.Markmap.create(svg, {
            autoFit: true,
            duration: 400,
            fitRatio: 0.85,
            maxWidth: 240,
            initialExpandLevel: 2,
          }, data);

          if (window.markmap.Toolbar) {
            var toolbar = window.markmap.Toolbar.create(mm);
            toolbar.el.style.position = 'absolute';
            toolbar.el.style.right = '12px';
            toolbar.el.style.bottom = '12px';
            host.appendChild(toolbar.el);
          }
        } catch (e) {
          console.error('Markmap init failed', e);
        }
      });
    }`)
  }

  if (hasScratchpad) {
    initBlocks.push(`
    // Scratchpad init
    (function() {
      var all = document.querySelectorAll('[data-exam-question]');
      var top = [];
      all.forEach(function(el) {
        var p = el.parentElement;
        var nested = false;
        while (p) {
          if (p.hasAttribute && p.hasAttribute('data-exam-question')) { nested = true; break; }
          p = p.parentElement;
        }
        if (!nested) top.push(el);
      });
      top.forEach(function(c) {
        try { spSetup(c); } catch(e) { console.error('Scratchpad error', e); }
      });
      function spSetup(ct) {
        var cv = document.createElement('canvas');
        cv.className = 'scratchpad-overlay';
        var dpr = window.devicePixelRatio || 1;
        var st = [];
        var cur = null;
        var pid = null;
        var on = false;
        function spResize() {
          var r = ct.getBoundingClientRect();
          cv.width = Math.round(r.width * dpr);
          cv.height = Math.round(r.height * dpr);
          cv.style.width = r.width + 'px';
          cv.style.height = r.height + 'px';
          spRedraw();
        }
        function spRedraw() {
          var x = cv.getContext('2d');
          if (!x) return;
          x.setTransform(dpr, 0, 0, dpr, 0, 0);
          x.clearRect(0, 0, cv.width, cv.height);
          x.strokeStyle = '#ef4444';
          x.lineWidth = 2;
          x.lineCap = 'round';
          x.lineJoin = 'round';
          for (var i = 0; i < st.length; i++) {
            var s = st[i];
            if (s.length < 2) continue;
            x.beginPath();
            x.moveTo(s[0].x, s[0].y);
            for (var j = 1; j < s.length; j++) x.lineTo(s[j].x, s[j].y);
            x.stroke();
          }
        }
        var bar = document.createElement('div');
        bar.className = 'scratchpad-controls';
        var bd = document.createElement('button');
        bd.className = 'scratchpad-btn';
        bd.textContent = '\u6D82\u9E26';
        var bc = document.createElement('button');
        bc.className = 'scratchpad-btn scratchpad-btn-danger';
        bc.textContent = '\u6E05\u9664';
        bc.style.display = 'none';
        var bx = document.createElement('button');
        bx.className = 'scratchpad-btn';
        bx.textContent = '\u9000\u51FA';
        bx.style.display = 'none';
        bar.appendChild(bd);
        bar.appendChild(bc);
        bar.appendChild(bx);
        ct.appendChild(cv);
        ct.appendChild(bar);
        bd.addEventListener('click', function() {
          on = !on;
          cv.classList.toggle('active', on);
          bd.classList.toggle('active', on);
          bd.textContent = on ? '\u6D82\u9E26\u4E2D' : '\u6D82\u9E26';
          bc.style.display = on ? '' : 'none';
          bx.style.display = on ? '' : 'none';
          if (on) spResize();
        });
        bc.addEventListener('click', function() {
          st.length = 0;
          var x = cv.getContext('2d');
          if (x) { x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, cv.width, cv.height); }
        });
        bx.addEventListener('click', function() {
          on = false;
          st.length = 0;
          cv.classList.remove('active');
          bd.classList.remove('active');
          bd.textContent = '\u6D82\u9E26';
          bc.style.display = 'none';
          bx.style.display = 'none';
          var x = cv.getContext('2d');
          if (x) { x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, cv.width, cv.height); }
        });
        cv.addEventListener('pointerdown', function(e) {
          if (!on) return;
          e.preventDefault();
          cv.setPointerCapture(e.pointerId);
          pid = e.pointerId;
          var r = cv.getBoundingClientRect();
          cur = [{ x: e.clientX - r.left, y: e.clientY - r.top }];
        });
        cv.addEventListener('pointermove', function(e) {
          if (!on || e.pointerId !== pid || !cur) return;
          e.preventDefault();
          var r = cv.getBoundingClientRect();
          var pt = { x: e.clientX - r.left, y: e.clientY - r.top };
          cur.push(pt);
          var x = cv.getContext('2d');
          if (x && cur.length >= 2) {
            x.strokeStyle = '#ef4444';
            x.lineWidth = 2;
            x.lineCap = 'round';
            x.lineJoin = 'round';
            x.beginPath();
            x.moveTo(cur[cur.length - 2].x, cur[cur.length - 2].y);
            x.lineTo(pt.x, pt.y);
            x.stroke();
          }
        });
        function spEnd(e) {
          if (e.pointerId !== pid) return;
          if (cur && cur.length > 0) st.push(cur);
          cur = null;
          pid = null;
        }
        cv.addEventListener('pointerup', spEnd);
        cv.addEventListener('pointercancel', spEnd);
        if (typeof ResizeObserver !== 'undefined') {
          new ResizeObserver(function() { if (on) spResize(); }).observe(ct);
        }
      }
    })();`)
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

  return `<script>${escapeInlineScript(parts.join("\n"))}</script>`
}
