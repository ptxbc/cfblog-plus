/* CFBlog · JustNews 文章页增强
 * 阅读时长 / 图片灯箱 / KaTeX 公式 / Mermaid 流程图
 * 依赖（在 article.html 中先于本文件加载）：
 *   katex.min.js + auto-render.min.js + mermaid.min.js
 */
(function () {
  'use strict';

  /* ---------- 1. 阅读时长 ---------- */
  function initReadingTime() {
    var el = document.getElementById('article-readtime');
    var content = document.querySelector('.article-content');
    if (!el || !content) return;
    var text = content.textContent || '';
    // 中文按字计（300 字/分钟），英文按词计（200 词/分钟）
    var cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    var latin = (text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
      .match(/[A-Za-z0-9]+(?:[''-][A-Za-z0-9]+)*/g) || []).length;
    var minutes = Math.max(1, Math.ceil(cjk / 300 + latin / 200));
    el.textContent = minutes + ' 分钟 · ' + (cjk + latin) + ' 字';
  }

  /* ---------- 2. 图片灯箱 ---------- */
  var overlay = null, images = [], current = 0;
  var zoom = 1, panX = 0, panY = 0, panning = false, panJustEnded = false;

  function applyTransform() {
    var img = overlay.querySelector('.lightbox-img');
    img.style.transform = (zoom > 1 || panX || panY) ? 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoom + ')' : '';
    var hint = overlay.querySelector('.lightbox-zoom-hint');
    if (hint) {
      hint.textContent = Math.round(zoom * 100) + '%';
      hint.style.opacity = zoom > 1 ? '1' : '0';
    }
  }

  function clampPan() {
    var img = overlay.querySelector('.lightbox-img');
    var w = img.naturalWidth || img.clientWidth, h = img.naturalHeight || img.clientHeight;
    var maxX = Math.max(0, (w * zoom - overlay.clientWidth) / 2);
    var maxY = Math.max(0, (h * zoom - overlay.clientHeight) / 2);
    if (panX > maxX) panX = maxX; if (panX < -maxX) panX = -maxX;
    if (panY > maxY) panY = maxY; if (panY < -maxY) panY = -maxY;
  }

  function resetZoom() { zoom = 1; panX = 0; panY = 0; }

  function zoomAt(mx, my, factor) {
    var rect = overlay.getBoundingClientRect();
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    var nz = Math.min(8, Math.max(1, zoom * factor));
    if (nz === zoom) return;
    var lx = (mx - (cx + panX)) / zoom;
    var ly = (my - (cy + panY)) / zoom;
    zoom = nz;
    panX = (mx - cx) - lx * zoom;
    panY = (my - cy) - ly * zoom;
    clampPan();
    applyTransform();
  }

  function buildOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '图片预览');
    var html =
      '<button class="lightbox-btn lightbox-prev" type="button" aria-label="上一张">‹</button>' +
      '<img class="lightbox-img" alt="图片预览" draggable="false">' +
      '<button class="lightbox-btn lightbox-next" type="button" aria-label="下一张">›</button>' +
      '<button class="lightbox-btn lightbox-close" type="button" aria-label="关闭">✕</button>' +
      '<div class="lightbox-zoom-hint" aria-hidden="true">100%</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    var img = overlay.querySelector('.lightbox-img');
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay && !panJustEnded) closeLightbox();
    });
    overlay.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    overlay.querySelector('.lightbox-prev').addEventListener('click', function (e) {
      e.stopPropagation(); show(current - 1);
    });
    overlay.querySelector('.lightbox-next').addEventListener('click', function (e) {
      e.stopPropagation(); show(current + 1);
    });
    // 滚轮缩放（以鼠标指针为中心）
    overlay.addEventListener('wheel', function (e) {
      if (!overlay.classList.contains('show')) return;
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    // 拖拽平移（放大后）
    img.addEventListener('mousedown', function (e) {
      if (zoom <= 1 && !panX && !panY) return;
      panning = true;
      panJustEnded = false;
      img.classList.add('panning');
      var sx = e.clientX, sy = e.clientY, spx = panX, spy = panY;
      function move(ev) {
        if (!panning) return;
        panX = spx + (ev.clientX - sx);
        panY = spy + (ev.clientY - sy);
        clampPan();
        applyTransform();
        ev.preventDefault();
      }
      function up() {
        panning = false;
        panJustEnded = true;
        img.classList.remove('panning');
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        setTimeout(function () { panJustEnded = false; }, 400);
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    img.addEventListener('dragstart', function (e) { e.preventDefault(); });
    // 双击切换 1x / 2.5x
    img.addEventListener('dblclick', function (e) {
      e.preventDefault();
      if (zoom > 1) { resetZoom(); applyTransform(); }
      else zoomAt(overlay.clientWidth / 2, overlay.clientHeight / 2, 2.5);
    });
  }

  function show(i) {
    if (!images.length) return;
    current = (i + images.length) % images.length;
    var img = overlay.querySelector('.lightbox-img');
    resetZoom();
    img.src = images[current].src;
    img.alt = images[current].alt || '图片预览';
    var nav = images.length > 1 ? 'visible' : 'hidden';
    overlay.querySelector('.lightbox-prev').style.visibility = nav;
    overlay.querySelector('.lightbox-next').style.visibility = nav;
    overlay.classList.add('show');
    document.body.classList.add('lightbox-open');
    applyTransform();
  }

  function closeLightbox() {
    if (!overlay) return;
    overlay.classList.remove('show');
    document.body.classList.remove('lightbox-open');
    resetZoom();
    applyTransform();
  }

  function initLightbox() {
    var content = document.querySelector('.article-content');
    if (!content) return;
    images = Array.prototype.slice.call(content.querySelectorAll('img'));
    images.forEach(function (img, idx) {
      var link = img.closest ? img.closest('a') : null;
      var href = link ? (link.getAttribute('href') || '') : '';
      // 链接指向图片（含 img.zli8.com 图床——它强制 Content-Disposition: attachment）
      var isImgTarget = /\.(png|jpe?g|gif|webp|svg|avif|bmp)([?#].*)?$/i.test(href) || /img\.zli8\.com\/file\//i.test(href);
      // 链接指向文章/外部页面：不劫持，保持原行为
      if (link && !isImgTarget) return;
      img.addEventListener('click', function (e) {
        if (link) e.preventDefault(); // 阻止图床强制下载/跳转
        buildOverlay();
        show(idx);
      });
      img.style.cursor = 'zoom-in';
    });
    document.addEventListener('keydown', function (e) {
      if (!overlay || !overlay.classList.contains('show')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
  }

  /* ---------- 3. KaTeX 数学公式 ---------- */
  function initKaTeX() {
    var content = document.querySelector('.article-content');
    if (!content || typeof renderMathInElement !== 'function') return;
    renderMathInElement(content, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false
    });
  }

  /* ---------- 4. Mermaid 流程图 ---------- */
  function mermaidTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
  }

  function initMermaid() {
    if (typeof mermaid === 'undefined') return;
    // 预先缓存每个图表的源码文本（mermaid 渲染后会把源码替换成 svg）
    var srcMap = new WeakMap();
    document.querySelectorAll('.article-content .mermaid').forEach(function (node) {
      srcMap.set(node, node.textContent);
    });

    function render() {
      mermaid.initialize({ startOnLoad: false, theme: mermaidTheme(), securityLevel: 'strict' });
      mermaid.run({ querySelector: '.article-content .mermaid' }).catch(function () {});
    }

    render();

    // 主题切换时重绘（mermaid 不支持动态换肤：还原源码后重新渲染）
    new MutationObserver(function () {
      document.querySelectorAll('.article-content .mermaid').forEach(function (node) {
        if (node.getAttribute('data-processed')) {
          node.removeAttribute('data-processed');
          node.innerHTML = '';
          node.appendChild(document.createTextNode(srcMap.get(node) || ''));
        }
      });
      render();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function boot() {
    initReadingTime();
    initLightbox();
    initKaTeX();
    initMermaid();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
