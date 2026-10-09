import { marked } from 'marked';

function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractHeadings(markdown) {
  const lines = markdown.split('\n');
  const headings = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimStart();
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      headings.push({ level, text, id: slugify(text), line: i + 1 });
    }
  }
  return headings;
}

/**
 * Build a collapsible TOC.
 * - Top level (h1) items are always visible.
 * - Nested levels (h2..h6) are hidden until their parent is expanded.
 * - Each parent link has a toggle marker; click the row to expand/collapse its subtree.
 */
function buildTOC(headings) {
  if (!headings.length) return '';

  // Build a tree using a stack: the stack holds ancestors by level.
  // roots = level-1 nodes (or orphaned higher-level nodes that have no parent).
  const roots = [];
  const stack = []; // each entry: { node, level }

  for (const h of headings) {
    const node = { id: h.id, text: h.text, level: h.level, children: [] };

    // Pop the stack until the top's level < h.level, then parent = top.
    while (stack.length && stack[stack.length - 1].node.level >= h.level) {
      stack.pop();
    }
    if (stack.length) {
      const parent = stack[stack.length - 1].node;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push({ node, level: h.level });
  }

  // Render a node. depth = 0 for roots.
  function renderNode(node, depth) {
    const hasKids = node.children.length > 0;
    const itemClass = `toc-item toc-l${node.level}${hasKids ? ' has-children' : ''}`;
    const marker = hasKids
      ? '<span class="toc-marker" aria-hidden="true">▸</span>'
      : '';
    let html = `<li class="${itemClass}">
      <a href="#${node.id}">${marker}<span class="toc-text">${node.text}</span></a>`;
    if (hasKids) {
      // Default collapsed: all nested lists start hidden
      html += `<ul class="toc-sub hidden">`;
      for (const c of node.children) html += renderNode(c, depth + 1);
      html += `</ul>`;
    }
    html += `</li>`;
    return html;
  }

  let inner = '';
  for (const n of roots) inner += renderNode(n, 0);

  return `<ul class="toc-sub toc-roots">${inner}</ul>`;
}

/**
 * Convert Markdown source to a full standalone HTML document
 * with a collapsible sidebar TOC and search box.
 */
export function convertMarkdownToHTML(markdown, filename = 'document.md') {
  const headings = extractHeadings(markdown);
  const tocHtml = buildTOC(headings);
  const hasToc = headings.length > 0;

  // Marked v12 renderer.heading(text, raw, options)
  marked.use({
    gfm: true,
    renderer: {
      heading(text, raw, options) {
        const level = Number(raw) || 1;
        const id = slugify(text);
        return `<h${level} id="${id}">${marked.parseInline(text)}</h${level}>\n`;
      },
    },
  });

  const bodyHtml = marked.parse(markdown);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename.replace(/\\.md$/i, '')}</title>
  <style>
    :root {
      --bg: #f8f9fb;
      --sidebar-bg: #ffffff;
      --content-bg: #ffffff;
      --text: #1a1a2e;
      --text-secondary: #555;
      --accent: #4a6cf7;
      --accent-light: #e8edff;
      --border: #e2e8f0;
      --code-bg: #f1f5f9;
      --sidebar-w: 300px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      display: flex;
      min-height: 100vh;
    }
    /* ============ Sidebar ============ */
    .sidebar {
      width: var(--sidebar-w);
      min-width: var(--sidebar-w);
      background: var(--sidebar-bg);
      border-right: 1px solid var(--border);
      position: fixed;
      top: 0; left: 0; bottom: 0;
      overflow-y: auto;
      padding: 16px 0 24px 0;
      z-index: 100;
      transition: transform 0.3s;
      display: flex;
      flex-direction: column;
    }
    /* Collapse/expand button — hugging the sidebar's right edge */
    .sidebar-collapse-btn {
      position: fixed;
      top: 16px;
      left: var(--sidebar-w);
      width: 28px; height: 28px;
      border: 1px solid var(--border);
      border-left: none;
      border-radius: 0 6px 6px 0;
      background: #fff;
      color: var(--text-secondary);
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: left 0.3s, background 0.2s, color 0.2s, border-color 0.2s;
      z-index: 101;
      box-shadow: 2px 0 8px rgba(0,0,0,0.1);
    }
    .sidebar-collapse-btn:hover {
      color: var(--accent);
      background: var(--accent-light);
      border-color: var(--accent);
    }
    /* When sidebar is collapsed, button slides to the very left edge
       and becomes a prominent accent tab so the user can always re-expand */
    .sidebar-collapse-btn.collapsed {
      left: 0;
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
      border-radius: 0 6px 6px 0;
      box-shadow: 2px 0 12px rgba(74,108,247,0.45);
    }
    /* Search */
    .search-wrap {
      padding: 0 16px 12px;
      position: relative;
    }
    .search-input {
      width: 100%;
      padding: 8px 32px 8px 32px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13.5px;
      outline: none;
      background: var(--code-bg);
      transition: all 0.15s;
    }
    .search-input:focus {
      border-color: var(--accent);
      background: #fff;
      box-shadow: 0 0 0 3px rgba(74,108,247,0.15);
    }
    .search-icon {
      position: absolute;
      left: 28px; top: 50%;
      transform: translateY(-50%);
      color: var(--text-secondary);
      pointer-events: none;
      font-size: 14px;
    }
    .search-clear {
      position: absolute;
      right: 24px; top: 50%;
      transform: translateY(-50%);
      border: none;
      background: transparent;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 14px;
      display: none;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .search-clear:hover { color: var(--accent); background: var(--accent-light); }
    .search-clear.visible { display: block; }
    .no-result {
      padding: 16px;
      text-align: center;
      color: var(--text-secondary);
      font-size: 13px;
      display: none;
    }
    .no-result.visible { display: block; }
    /* Header */
    .sidebar-header {
      padding: 8px 20px 14px;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-bottom: 1px solid var(--border);
      margin-bottom: 8px;
    }
    .sidebar-header .filename {
      color: var(--text);
      font-size: 14px;
      font-weight: 600;
      text-transform: none;
      letter-spacing: normal;
      margin-top: 4px;
      word-break: break-all;
    }
    /* TOC tree */
    .toc-tree {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }
    .toc-sub {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .toc-sub .toc-sub {
      margin-left: 18px;
      border-left: 1px dashed var(--border);
      padding-left: 8px;
    }
    .toc-sub.hidden { display: none; }
    .toc-item a {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 16px 5px 12px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 13.5px;
      border-left: 3px solid transparent;
      transition: all 0.15s;
      cursor: pointer;
    }
    .toc-item a:hover {
      color: var(--accent);
      background: var(--accent-light);
      border-left-color: var(--accent);
    }
    .toc-l1 a { font-weight: 600; font-size: 14px; padding-left: 8px; }
    .toc-item a .toc-text {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .toc-item.has-children > a .toc-marker {
      font-size: 10px;
      color: var(--text-secondary);
      transition: transform 0.2s;
      flex-shrink: 0;
    }
    .toc-item.has-children.expanded > a .toc-marker {
      transform: rotate(90deg);
      color: var(--accent);
    }
    .toc-item.has-children > a { cursor: pointer; }
    /* Search highlight */
    mark {
      background: #fde68a;
      color: #92400e;
      border-radius: 2px;
      padding: 0 2px;
    }
    .toc-item.search-hidden { display: none; }
    /* Main content */
    .content {
      margin-left: var(--sidebar-w);
      flex: 1;
      padding: 40px 48px;
      max-width: 900px;
      min-width: 0;
    }
    .content h1 { font-size: 2em; margin: 0 0 16px; padding-bottom: 12px; border-bottom: 2px solid var(--border); }
    .content h2 { font-size: 1.5em; margin: 32px 0 12px; }
    .content h3 { font-size: 1.25em; margin: 24px 0 10px; }
    .content h4 { font-size: 1.1em; margin: 20px 0 8px; }
    .content h5 { font-size: 1em; margin: 16px 0 6px; }
    .content h6 { font-size: 0.9em; margin: 14px 0 6px; color: var(--text-secondary); }
    .content p { margin: 0 0 16px; }
    .content ul, .content ol { margin: 0 0 16px; padding-left: 28px; }
    .content li { margin: 4px 0; }
    .content blockquote {
      margin: 0 0 16px;
      padding: 12px 20px;
      border-left: 4px solid var(--accent);
      background: var(--accent-light);
      color: var(--text-secondary);
      border-radius: 0 6px 6px 0;
    }
    .content code {
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
      font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
    }
    .content pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 18px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 0 0 16px;
      font-size: 13.5px;
      line-height: 1.6;
    }
    .content pre code {
      background: none;
      color: inherit;
      padding: 0;
    }
    .content table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 16px;
      font-size: 14px;
    }
    .content th, .content td {
      padding: 10px 14px;
      border: 1px solid var(--border);
      text-align: left;
    }
    .content th {
      background: var(--code-bg);
      font-weight: 600;
    }
    .content img {
      max-width: 100%;
      border-radius: 8px;
      margin: 8px 0;
    }
    .content a {
      color: var(--accent);
      text-decoration: none;
    }
    .content a:hover { text-decoration: underline; }
    .content hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 32px 0;
    }
    /* Scroll highlight */
    .toc-item a.active {
      color: var(--accent);
      background: var(--accent-light);
      border-left-color: var(--accent);
      font-weight: 600;
    }
  </style>
</head>

  ${hasToc ? `<button class="sidebar-collapse-btn" id="sidebarCollapseBtn" aria-label="折叠侧边栏" title="折叠侧边栏">▶</button>
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      目录
      <div class="filename">${filename}</div>
    </div>
    <div class="search-wrap">
      <span class="search-icon">🔍</span>
      <input type="search" class="search-input" id="searchInput" placeholder="搜索标题或内容…" autocomplete="off">
      <button class="search-clear" id="searchClear" aria-label="清除">✕</button>
    </div>
    <div class="toc-tree" id="tocTree">${tocHtml}</div>
    <div class="no-result" id="noResult">没有匹配的标题</div>
  </aside>` : ''}
  <main class="content" id="content">
    ${bodyHtml}
  </main>
  <script>
    // ============ 1. Collapsible TOC ============
    (function() {
      const tree = document.getElementById('tocTree');
      if (!tree) return;

      // Shared state: whether the search filter is active
      // (exposed on window so the search handler can toggle it)
      window.__searchActive = false;

      // Click on h1 row with children → toggle expand/collapse
      // When search is active, clicking a result should navigate (jump), not toggle.
      tree.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;
        const item = link.parentElement;
        if (!item.classList.contains('has-children')) return;

        // If a search is active, let the click navigate (jump to section)
        if (window.__searchActive) return;

        // Otherwise toggle expand/collapse
        e.preventDefault();
        const sub = item.querySelector(':scope > .toc-sub');
        if (sub) {
          item.classList.toggle('expanded');
          sub.classList.toggle('hidden');
        }
      });
    })();

    // ============ 2. Sidebar collapse (desktop) ============
    (function() {
      const btn = document.getElementById('sidebarCollapseBtn');
      const sidebar = document.getElementById('sidebar');
      const content = document.getElementById('content');
      if (!btn || !sidebar || !content) return;

      const collapsedKey = 'sidebarCollapsed';
      let collapsed = localStorage.getItem(collapsedKey) === '1';

      function apply() {
        if (collapsed) {
          sidebar.style.transform = 'translateX(-100%)';
          sidebar.classList.add('is-collapsed');
          content.style.marginLeft = '0';
          btn.classList.add('collapsed');
          btn.textContent = '◀';
          btn.title = '展开侧边栏';
        } else {
          sidebar.style.transform = '';
          sidebar.classList.remove('is-collapsed');
          content.style.marginLeft = '';
          btn.classList.remove('collapsed');
          btn.textContent = '▶';
          btn.title = '折叠侧边栏';
        }
      }
      apply();

      btn.addEventListener('click', () => {
        collapsed = !collapsed;
        localStorage.setItem(collapsedKey, collapsed ? '1' : '0');
        apply();
      });
    })();

    // ============ 3. Search (filter titles + jump to content) ============
    (function() {
      const input = document.getElementById('searchInput');
      const clearBtn = document.getElementById('searchClear');
      const noResult = document.getElementById('noResult');
      const tree = document.getElementById('tocTree');
      if (!input || !tree) return;

      // Collect all heading text (from TOC) + content text (for keyword match)
      const allItems = [...tree.querySelectorAll('.toc-item')];
      // Save original labels on the <li> element (consistent read/write on el)
      allItems.forEach(el => {
        const link = el.querySelector(':scope > a');
        if (link) {
          el.dataset.originalLabel = link.innerHTML;
        }
      });

      function escapeRegex(s) {
        return s.replace(/[.*+?^$[](){}|\\]/g, '\\$&');
      }

      function filter(query) {
        const q = query.trim().toLowerCase();
        // Tell the collapsible handler whether search is active
        window.__searchActive = q.length > 0;
        clearBtn.classList.toggle('visible', q.length > 0);
        if (!q) {
          allItems.forEach(el => {
            el.classList.remove('search-hidden');
            const link = el.querySelector(':scope > a');
            if (link) link.innerHTML = el.dataset.originalLabel;
            const sub = el.querySelector(':scope > .toc-sub');
            if (sub) sub.classList.remove('hidden');
          });
          noResult.classList.remove('visible');
          return;
        }

        let matchCount = 0;
        // Match against titles
        allItems.forEach(el => {
          const link = el.querySelector(':scope > a');
          if (!link) return;
          // Read from el (consistent with set on line above)
          const label = (el.dataset.originalLabel || '').replace(/<[^>]+>/g, '');
          const isMatch = label.toLowerCase().includes(q);

          if (isMatch) {
            el.classList.remove('search-hidden');
            matchCount++;
            // Highlight matched text
            const re = new RegExp('(' + escapeRegex(query) + ')', 'gi');
            const textSpan = link.querySelector('.toc-text');
            if (textSpan) {
              const cleanText = textSpan.textContent;
              textSpan.innerHTML = cleanText.replace(re, '<mark>$1</mark>');
            }
            // Expand ancestors so the matched item is visible
            let p = el.parentElement;
            while (p && p !== tree) {
              if (p.classList && p.classList.contains('toc-sub')) {
                p.classList.remove('hidden');
                const parentItem = p.parentElement;
                if (parentItem && parentItem.classList) parentItem.classList.add('expanded');
              }
              p = p.parentElement;
            }
          } else {
            el.classList.add('search-hidden');
            const textSpan = link.querySelector('.toc-text');
            if (textSpan) textSpan.innerHTML = textSpan.textContent;
          }
        });

        noResult.classList.toggle('visible', matchCount === 0);
      }

      input.addEventListener('input', () => filter(input.value));
      input.addEventListener('focus', () => filter(input.value));

      clearBtn.addEventListener('click', () => {
        input.value = '';
        filter('');
        input.focus();
      });

      // Keyboard: Esc clears
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          input.value = '';
          filter('');
          input.blur();
        }
      });

      // Jump: when user presses Enter, jump to the first matched item.
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const q = input.value.trim().toLowerCase();
          if (!q) return;
          // Find the first item that matches the query (and is not hidden)
          const first = allItems.find(el => {
            if (el.classList.contains('search-hidden')) return false;
            const label = (el.dataset.originalLabel || '').replace(/<[^>]+>/g, '').toLowerCase();
            return label.includes(q);
          });
          if (first) {
            const link = first.querySelector(':scope > a');
            if (link) {
              // Navigate to the section; keep search state active
              window.location.hash = link.getAttribute('href').slice(1);
            }
          }
        }
      });
    })();

    // ============ 4. Scroll spy ============
    (function() {
      const links = document.querySelectorAll('.toc-item a');
      const headings = Array.from(document.querySelectorAll('#content h1[id], #content h2[id], #content h3[id], #content h4[id], #content h5[id], #content h6[id]'));
      if (!headings.length) return;
      const visible = new Set();
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        });
        if (!visible.size) return;
        let topId = null;
        let topY = Infinity;
        visible.forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            const r = el.getBoundingClientRect();
            if (r.top < topY) { topY = r.top; topId = id; }
          }
        });
        if (!topId) return;
        links.forEach(l => l.classList.remove('active'));
        const active = document.querySelector('.toc-item a[href="#' + topId + '"]');
        if (active) active.classList.add('active');
      }, { rootMargin: '0px 0px -60% 0px' });
      headings.forEach(h => observer.observe(h));
    })();
  </script>
</body>
</html>`;
}
