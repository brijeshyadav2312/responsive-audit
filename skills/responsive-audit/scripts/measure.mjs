const MEASURE = ({ width, height, profile, cssFacts }) => {
  const issues = [];
  const root = document.documentElement;
  const body = document.body;
  const vw = root.clientWidth || window.innerWidth;
  const vh = window.innerHeight;
  const ios = Boolean(profile && profile.os === 'ios');
  const tv = Boolean(profile && profile.os === 'tv');
  const touch = Boolean(profile && profile.touch) || (!profile && vw <= 900);
  const group = profile ? profile.group : null;

  const styleCache = new WeakMap();
  const rectCache = new WeakMap();
  const selectorCache = new WeakMap();
  const visibleCache = new WeakMap();
  const laidOutCache = new WeakMap();
  const opacityCache = new WeakMap();
  const ignoredCache = new WeakMap();
  const insideScrollerCache = new WeakMap();
  const clippedByAncestorCache = new WeakMap();
  const clippingAncestorCache = new WeakMap();
  const proseLinkCache = new WeakMap();

  const styleOf = (el) => {
    let cs = styleCache.get(el);
    if (!cs) {
      cs = getComputedStyle(el);
      styleCache.set(el, cs);
    }
    return cs;
  };

  const rawRectOf = (el) => {
    let rect = rectCache.get(el);
    if (!rect) {
      rect = el.getBoundingClientRect();
      rectCache.set(el, rect);
    }
    return rect;
  };

  const uniqueSelector = (el) => {
    if (!el || el.nodeType !== 1) return '';
    if (el === body) return 'body';

    const cached = selectorCache.get(el);
    if (cached !== undefined) return cached;

    const remember = (value) => {
      selectorCache.set(el, value);
      return value;
    };

    if (!body || !body.contains(el)) {
      const tag = el.tagName.toLowerCase();
      if (el.id) {
        try {
          const idSel = '#' + CSS.escape(el.id);
          if (document.querySelectorAll(idSel).length === 1) return remember(idSel);
        } catch {
          // fall through
        }
      }
      return remember(tag);
    }

    if (el.id) {
      try {
        const idSel = '#' + CSS.escape(el.id);
        if (document.querySelectorAll(idSel).length === 1) return remember(idSel);
      } catch {
        // fall through
      }
    }

    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== body) {
      const tag = node.tagName.toLowerCase();
      if (!node.parentElement) break;
      let index = 1;
      for (
        let sibling = node.previousElementSibling;
        sibling;
        sibling = sibling.previousElementSibling
      ) {
        if (sibling.tagName === node.tagName) index += 1;
      }
      parts.unshift(tag + ':nth-of-type(' + index + ')');
      node = node.parentElement;
    }
    return remember(parts.length ? 'body > ' + parts.join(' > ') : 'body');
  };

  const isVisible = (el) => {
    const cached = visibleCache.get(el);
    if (cached !== undefined) return cached;
    const cs = styleOf(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.contentVisibility === 'hidden') {
      visibleCache.set(el, false);
      return false;
    }
    if (Number(cs.opacity) < 0.02) {
      visibleCache.set(el, false);
      return false;
    }
    const rect = rawRectOf(el);
    const visible = rect.width > 0 && rect.height > 0;
    visibleCache.set(el, visible);
    return visible;
  };

  const isLaidOut = (el) => {
    const cached = laidOutCache.get(el);
    if (cached !== undefined) return cached;
    const cs = styleOf(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.contentVisibility === 'hidden') {
      laidOutCache.set(el, false);
      return false;
    }
    const rect = rawRectOf(el);
    const laidOut = rect.width > 0 && rect.height > 0;
    laidOutCache.set(el, laidOut);
    return laidOut;
  };

  const effectiveOpacity = (el) => {
    const cached = opacityCache.get(el);
    if (cached !== undefined) return cached;
    let value = 1;
    let node = el;
    while (node && node !== root) {
      value *= Number(styleOf(node).opacity);
      if (value < 0.02) break;
      node = node.parentElement;
    }
    opacityCache.set(el, value);
    return value;
  };

  const isIgnored = (el) => {
    const cached = ignoredCache.get(el);
    if (cached !== undefined) return cached;
    const ignored = Boolean(el.closest('[aria-hidden="true"], [inert]'));
    ignoredCache.set(el, ignored);
    return ignored;
  };

  const rectOf = (el) => {
    const r = rawRectOf(el);
    return {
      x: Math.round(r.x),
      y: Math.round(r.y),
      width: Math.round(r.width),
      height: Math.round(r.height),
      right: Math.round(r.right),
      bottom: Math.round(r.bottom),
    };
  };

  const textOf = (el, limit = 60) =>
    (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, limit);

  const directText = (el) => {
    let out = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 3) out += node.textContent;
    }
    return out.replace(/\s+/g, ' ').trim();
  };

  const clipsX = (cs) => cs.overflowX === 'hidden' || cs.overflowX === 'clip';
  const scrollsX = (cs) => cs.overflowX === 'auto' || cs.overflowX === 'scroll';

  const insideScroller = (el) => {
    const cached = insideScrollerCache.get(el);
    if (cached !== undefined) return cached;
    let node = el.parentElement;
    while (node && node !== body) {
      if (scrollsX(styleOf(node))) {
        insideScrollerCache.set(el, true);
        return true;
      }
      node = node.parentElement;
    }
    insideScrollerCache.set(el, false);
    return false;
  };

  const clippedByAncestor = (el) => {
    const cached = clippedByAncestorCache.get(el);
    if (cached !== undefined) return cached;
    let node = el.parentElement;
    while (node && node !== body && node !== root) {
      const cs = styleOf(node);
      if (scrollsX(cs)) {
        clippedByAncestorCache.set(el, true);
        return true;
      }
      if (clipsX(cs)) {
        const r = rawRectOf(node);
        if (r.right <= vw + 1 && r.left >= -1) {
          clippedByAncestorCache.set(el, true);
          return true;
        }
      }
      node = node.parentElement;
    }
    clippedByAncestorCache.set(el, false);
    return false;
  };

  const clippingAncestor = (el) => {
    const cached = clippingAncestorCache.get(el);
    if (cached !== undefined) return cached;
    const rect = rawRectOf(el);
    let node = el.parentElement;
    while (node && node !== root) {
      const cs = styleOf(node);
      if (scrollsX(cs)) {
        clippingAncestorCache.set(el, null);
        return null;
      }
      if (clipsX(cs)) {
        const box = rawRectOf(node);
        const left = box.left + node.clientLeft;
        const right = left + node.clientWidth;
        if (right - left > 1) {
          const leftAmount = Math.max(0, left - rect.left);
          const rightAmount = Math.max(0, rect.right - right);
          if (leftAmount > 6 || rightAmount > 6) {
            const result = {
              node,
              left,
              right,
              amount: Math.round(Math.max(leftAmount, rightAmount)),
            };
            clippingAncestorCache.set(el, result);
            return result;
          }
        }
      }
      node = node.parentElement;
    }
    clippingAncestorCache.set(el, null);
    return null;
  };

  const isProseLink = (el) => {
    const cached = proseLinkCache.get(el);
    if (cached !== undefined) return cached;
    if (el.tagName !== 'A') {
      proseLinkCache.set(el, false);
      return false;
    }
    const cs = styleOf(el);
    if (cs.display !== 'inline') {
      proseLinkCache.set(el, false);
      return false;
    }
    const prose = el.closest('p, li, dd, dt, blockquote, figcaption, td');
    if (!prose) {
      proseLinkCache.set(el, false);
      return false;
    }
    const isProse = (el.innerText || '').trim().length > 0;
    proseLinkCache.set(el, isProse);
    return isProse;
  };

  let viewportFitCover = false;
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    issues.push({
      id: 'viewport-meta',
      severity: 'P1',
      title: 'Missing viewport meta',
      detail:
        'No <meta name="viewport"> found; mobile browsers will use a desktop layout viewport and shrink the page.',
      evidence: [],
    });
  } else {
    const content = meta.getAttribute('content') || '';
    viewportFitCover = /viewport-fit\s*=\s*cover/i.test(content);
    if (!/width\s*=\s*device-width/i.test(content)) {
      issues.push({
        id: 'viewport-meta-width',
        severity: 'P1',
        title: 'Viewport meta omits device-width',
        detail:
          'The viewport meta does not set width=device-width, so mobile browsers use a wider layout viewport.',
        evidence: [
          {
            selector: 'meta[name="viewport"]',
            tag: 'meta',
            text: content,
            rect: null,
          },
        ],
      });
    }
    if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(content)) {
      issues.push({
        id: 'zoom-blocked',
        severity: 'P2',
        title: 'Zoom is blocked',
        detail: 'Viewport meta disables pinch zoom, which fails WCAG 1.4.4.',
        evidence: [
          {
            selector: 'meta[name="viewport"]',
            tag: 'meta',
            text: content,
            rect: null,
          },
        ],
      });
    }
  }

  const visualViewportWidth = window.visualViewport
    ? Math.round(window.visualViewport.width)
    : window.innerWidth;
  if (visualViewportWidth > 0 && window.innerWidth > visualViewportWidth + 2) {
    issues.push({
      id: 'layout-viewport-expanded',
      severity: 'P1',
      title: 'Layout viewport wider than the screen',
      detail:
        'The layout viewport is ' +
        window.innerWidth +
        'px wide but the visual viewport is ' +
        visualViewportWidth +
        'px. Overflowing content forces mobile browsers to widen the layout viewport, which can clip fixed navigation and content.',
      evidence: [
        {
          selector: 'html',
          tag: 'html',
          text:
            'layout viewport ' +
            window.innerWidth +
            'px, visual viewport ' +
            visualViewportWidth +
            'px',
          rect: null,
        },
      ],
    });
  }

  const scrollWidth = root.scrollWidth;
  const overflow = scrollWidth - vw;
  if (overflow > 1) {
    const raw = [];
    for (const el of body.querySelectorAll('*')) {
      if (!isLaidOut(el) || isIgnored(el)) continue;
      const rect = rawRectOf(el);
      if (rect.right <= vw + 1 || rect.left >= vw) continue;
      if (clippedByAncestor(el)) continue;
      raw.push(el);
    }

    const normalized = [];
    for (const original of raw) {
      let el = original;
      let guard = 0;
      while (guard < 4) {
        const cs = styleOf(el);
        if (!cs.display.startsWith('inline')) break;
        const parent = el.parentElement;
        if (!parent || parent === body) break;
        if (rawRectOf(parent).right <= vw + 1) break;
        el = parent;
        guard += 1;
      }
      normalized.push(el);
    }

    const unique = [...new Set(normalized)];
    const offendersSet = new Set(unique);
    const roots = unique.filter((el) => {
      let parent = el.parentElement;
      while (parent && parent !== body) {
        if (offendersSet.has(parent)) return false;
        parent = parent.parentElement;
      }
      return true;
    });
    const anyVisible = roots.some((el) => effectiveOpacity(el) >= 0.02);
    const offenders = roots
      .map((el) => ({
        el,
        rect: rawRectOf(el),
        visible: effectiveOpacity(el) >= 0.02,
      }))
      .sort((a, b) => Number(b.visible) - Number(a.visible) || b.rect.right - a.rect.right)
      .slice(0, 8);

    issues.push({
      id: 'horizontal-overflow',
      severity: overflow > 8 ? (anyVisible ? 'P0' : 'P1') : 'P1',
      title: 'Horizontal overflow',
      detail:
        'Document is ' +
        overflow +
        'px wider than the ' +
        vw +
        'px layout viewport (scrollWidth ' +
        scrollWidth +
        'px).' +
        (anyVisible
          ? ''
          : ' All identified offenders are transparent or pre-reveal, but they still widen the layout viewport.'),
      evidence: offenders.map(({ el }) => ({
        selector: uniqueSelector(el),
        parent:
          el.parentElement && el.parentElement !== body
            ? uniqueSelector(el.parentElement)
            : null,
        tag: el.tagName.toLowerCase(),
        text: textOf(el),
        detail:
          effectiveOpacity(el) < 0.02 ? 'Transparent/pre-reveal element' : undefined,
        rect: rectOf(el),
      })),
    });
  }

  const fixedFit = [];
  for (const el of body.querySelectorAll('*')) {
    if (fixedFit.length >= 8) break;
    if (!isVisible(el) || isIgnored(el)) continue;
    if (effectiveOpacity(el) < 0.02) continue;
    const cs = styleOf(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.pointerEvents === 'none') continue;
    const rect = rawRectOf(el);
    if (rect.right <= 0 || rect.left >= vw || rect.bottom <= 0 || rect.top >= vh) continue;
    const leftAmount = Math.max(0, -rect.left);
    const rightAmount = Math.max(0, rect.right - vw);
    if (leftAmount <= 1 && rightAmount <= 1) continue;
    if (clippedByAncestor(el)) continue;
    fixedFit.push({
      selector: uniqueSelector(el),
      tag: el.tagName.toLowerCase(),
      text: textOf(el, 50),
      detail:
        'Extends ' +
        Math.round(Math.max(leftAmount, rightAmount)) +
        'px past the ' +
        vw +
        'px viewport horizontally',
      rect: rectOf(el),
    });
  }
  if (fixedFit.length) {
    issues.push({
      id: 'fixed-viewport-fit',
      severity: 'P1',
      title: 'Fixed or sticky element does not fit the viewport',
      detail:
        fixedFit.length +
        ' fixed/sticky element(s) extend past the viewport edge. On mobile this can clip navigation, headers, and overlay controls.',
      evidence: fixedFit,
    });
  }

  const clipEvidence = [];
  for (const el of body.querySelectorAll(
    'p, span, h1, h2, h3, h4, h5, h6, a, button, label, li, td, th, div, figcaption, summary, dt, dd, blockquote'
  )) {
    if (clipEvidence.length >= 8) break;
    if (!isVisible(el) || isIgnored(el)) continue;
    const box = rawRectOf(el);
    if (box.right <= 0 || box.left >= vw || box.bottom <= 0) continue;
    const cs = styleOf(el);
    if (!clipsX(cs)) continue;
    if (el.clientWidth <= 2 || el.clientHeight <= 2) continue;
    if (cs.textOverflow === 'ellipsis') continue;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') continue;
    if (cs.display === 'inline') continue;
    if (el.scrollWidth <= el.clientWidth + 2) continue;
    if (insideScroller(el)) continue;
    const text = textOf(el, 120);
    if (text.length < 12) continue;
    clipEvidence.push({
      selector: uniqueSelector(el),
      tag: el.tagName.toLowerCase(),
      text,
      detail: 'Cut off by ' + (el.scrollWidth - el.clientWidth) + 'px',
      rect: rectOf(el),
    });
  }
  if (clipEvidence.length) {
    issues.push({
      id: 'text-clip',
      severity: 'P1',
      title: 'Clipped text',
      detail:
        clipEvidence.length +
        ' element(s) hide text that does not fit their box. Ellipsis and line-clamp truncation are excluded.',
      evidence: clipEvidence,
    });
  }

  const clippedContent = [];
  for (const el of body.querySelectorAll(
    'h1, h2, h3, h4, h5, h6, p, span, a, button, label, li, td, th, figcaption, summary, dt, dd, blockquote, img, video, input, textarea, select'
  )) {
    if (clippedContent.length >= 8) break;
    const tag = el.tagName.toLowerCase();
    const media = tag === 'img' || tag === 'video';
    const text = directText(el);
    const interactive =
      !text && !media
        ? Boolean(
            el.closest(
              'a, button, input, select, textarea, summary, [role="button"], [role="link"]'
            )
          )
        : false;
    if (!text && !media && !interactive) continue;
    if (!isVisible(el) || isIgnored(el)) continue;
    if (effectiveOpacity(el) < 0.02) continue;
    const rect = rawRectOf(el);
    if (rect.right <= 0 || rect.left >= vw) continue;
    if (el.clientWidth <= 2 || el.clientHeight <= 2) continue;
    const cs = styleOf(el);
    if (clipsX(cs)) continue;
    if (cs.textOverflow === 'ellipsis') continue;
    if (cs.webkitLineClamp && cs.webkitLineClamp !== 'none') continue;
    const clip = clippingAncestor(el);
    if (!clip) continue;
    clippedContent.push({
      selector: uniqueSelector(el),
      parent: uniqueSelector(clip.node),
      tag,
      text: text ? text.slice(0, 80) : textOf(el, 80),
      detail: 'Extends ' + clip.amount + 'px past a clipping ancestor',
      rect: rectOf(el),
    });
  }
  if (clippedContent.length) {
    issues.push({
      id: 'clipped-content',
      severity: 'P1',
      title: 'Content clipped by an ancestor',
      detail:
        clippedContent.length +
        ' text, media, or interactive element(s) extend past an overflow-hidden/clip ancestor. Scroll containers and intentional ellipsis/line-clamp truncation are excluded.',
      evidence: clippedContent,
    });
  }

  if (touch) {
    const nodes = body.querySelectorAll(
      'a, button, input, select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"]'
    );
    const candidates = [];
    for (const el of nodes) {
      if (!isVisible(el) || isIgnored(el)) continue;
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
      if (el.tagName === 'A' && !el.hasAttribute('href') && !el.hasAttribute('role')) continue;
      if (el.tagName === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'hidden') {
        continue;
      }
      if (isProseLink(el)) continue;
      const rect = rawRectOf(el);
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.right <= 0 || rect.left >= vw || rect.bottom <= 0) continue;
      const label = el.closest('label');
      if (label && label !== el) {
        const labelRect = rawRectOf(label);
        if (labelRect.width >= 43.5 && labelRect.height >= 43.5) continue;
      }
      candidates.push({ el, rect });
    }

    const spacingCell = 32;
    const spacingCells = new Map();
    const largeCandidates = [];
    for (let index = 0; index < candidates.length; index += 1) {
      const rect = candidates[index].rect;
      const minX = Math.floor(rect.left / spacingCell);
      const maxX = Math.floor(rect.right / spacingCell);
      const minY = Math.floor(rect.top / spacingCell);
      const maxY = Math.floor(rect.bottom / spacingCell);
      if (maxX - minX > 4 || maxY - minY > 4) {
        largeCandidates.push(index);
        continue;
      }
      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          const key = x + ':' + y;
          let bucket = spacingCells.get(key);
          if (!bucket) {
            bucket = [];
            spacingCells.set(key, bucket);
          }
          bucket.push(index);
        }
      }
    }

    const spacingChecked = new Uint32Array(candidates.length);
    let spacingQuery = 0;

    const spacingPass = (candidate, candidateIndex) => {
      const cx = candidate.rect.left + candidate.rect.width / 2;
      const cy = candidate.rect.top + candidate.rect.height / 2;
      spacingQuery += 1;
      const query = spacingQuery;

      const check = (otherIndex) => {
        if (otherIndex === candidateIndex) return true;
        if (spacingChecked[otherIndex] === query) return true;
        spacingChecked[otherIndex] = query;
        const rect = candidates[otherIndex].rect;
        const ocx = rect.left + rect.width / 2;
        const ocy = rect.top + rect.height / 2;
        const dx = cx - ocx;
        const dy = cy - ocy;
        if (dx * dx + dy * dy < 576) return false;
        const nx = Math.max(rect.left, Math.min(cx, rect.right));
        const ny = Math.max(rect.top, Math.min(cy, rect.bottom));
        const rx = cx - nx;
        const ry = cy - ny;
        return rx * rx + ry * ry >= 144;
      };

      const minX = Math.floor((cx - 24) / spacingCell);
      const maxX = Math.floor((cx + 24) / spacingCell);
      const minY = Math.floor((cy - 24) / spacingCell);
      const maxY = Math.floor((cy + 24) / spacingCell);
      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          const bucket = spacingCells.get(x + ':' + y);
          if (!bucket) continue;
          for (const otherIndex of bucket) {
            if (!check(otherIndex)) return false;
          }
        }
      }
      for (const otherIndex of largeCandidates) {
        if (!check(otherIndex)) return false;
      }
      return true;
    };

    const itemFor = (candidate) => ({
      selector: uniqueSelector(candidate.el),
      tag: candidate.el.tagName.toLowerCase(),
      text: textOf(candidate.el, 40),
      rect: rectOf(candidate.el),
    });

    const tiny = [];
    const small = [];
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const { rect } = candidate;
      if (rect.width < 23.5 || rect.height < 23.5) {
        if (spacingPass(candidate, index)) small.push(candidate);
        else tiny.push(candidate);
      } else if (rect.width < 43.5 || rect.height < 43.5) {
        small.push(candidate);
      }
    }

    if (tiny.length) {
      issues.push({
        id: 'tap-target-critical',
        severity: 'P1',
        title: 'Tap targets under 24px',
        detail:
          tiny.length +
          ' interactive element(s) are below the WCAG 2.2 target minimum of 24x24 and fail the spacing exception. Inline prose links are exempt.',
        evidence: tiny.slice(0, 8).map(itemFor),
      });
    }
    if (small.length) {
      issues.push({
        id: 'tap-target-advisory',
        severity: 'P3',
        title: 'Tap targets under 44px',
        detail: small.length + ' interactive element(s) are below the 44x44 comfortable size.',
        evidence: small.slice(0, 8).map(itemFor),
      });
    }
  }

  const distorted = [];
  for (const media of body.querySelectorAll('img, video')) {
    if (!isVisible(media) || isIgnored(media)) continue;
    const naturalWidth = media.naturalWidth || media.videoWidth || 0;
    const naturalHeight = media.naturalHeight || media.videoHeight || 0;
    if (!naturalWidth || !naturalHeight) continue;
    const cs = styleOf(media);
    const fit = cs.objectFit || 'fill';
    if (fit !== 'fill') continue;
    const rect = rawRectOf(media);
    if (rect.width < 20 || rect.height < 20) continue;
    if (rect.right <= 0 || rect.left >= vw || rect.bottom <= 0) continue;
    const naturalRatio = naturalWidth / naturalHeight;
    const renderedRatio = rect.width / rect.height;
    const drift = Math.abs(renderedRatio - naturalRatio) / naturalRatio;
    if (drift > 0.15) {
      distorted.push({
        selector: uniqueSelector(media),
        tag: media.tagName.toLowerCase(),
        text: media.getAttribute('alt') || '',
        detail: Math.round(drift * 100) + '% distortion (object-fit: fill)',
        rect: rectOf(media),
      });
    }
  }
  if (distorted.length) {
    issues.push({
      id: 'image-distortion',
      severity: 'P2',
      title: 'Distorted media',
      detail:
        distorted.length +
        ' image/video element(s) stretch more than 15% from their natural aspect ratio. object-fit other than fill is excluded.',
      evidence: distorted.slice(0, 6),
    });
  }

  const overlayCandidates = [];
  for (const el of body.querySelectorAll('*')) {
    if (!isVisible(el) || isIgnored(el)) continue;
    const cs = styleOf(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.pointerEvents === 'none') continue;
    const rect = rawRectOf(el);
    if (rect.right <= 0 || rect.left >= vw || rect.bottom <= 0 || rect.top >= vh) continue;
    if (rect.height >= vh * 0.4 && rect.width >= vw * 0.4) {
      overlayCandidates.push({ el, rect });
    }
  }
  const overlays = overlayCandidates.filter(
    ({ el }) =>
      !overlayCandidates.some(
        ({ el: other }) => other !== el && other.contains(el)
      )
  );
  if (overlays.length) {
    issues.push({
      id: 'fixed-overlay',
      severity: 'P2',
      title: 'Fixed overlay takes over the viewport',
      detail:
        overlays.length +
        ' fixed/sticky element(s) cover at least 40% of both viewport dimensions.',
      evidence: overlays.slice(0, 5).map(({ el, rect }) => ({
        selector: uniqueSelector(el),
        tag: el.tagName.toLowerCase(),
        text: textOf(el),
        detail:
          'Covers ' +
          Math.round((rect.height / vh) * 100) +
          '% of viewport height and ' +
          Math.round((rect.width / vw) * 100) +
          '% of width',
        rect: rectOf(el),
      })),
    });
  }

  if (ios) {
    const zoomed = [];
    for (const el of body.querySelectorAll('input, select, textarea')) {
      if (!isVisible(el) || isIgnored(el)) continue;
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (['hidden', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'button', 'reset', 'image'].includes(type)) {
        continue;
      }
      if (el.disabled || el.readOnly) continue;
      const cs = styleOf(el);
      const fontSize = Number.parseFloat(cs.fontSize);
      if (!Number.isFinite(fontSize) || fontSize >= 16) continue;
      const rect = rawRectOf(el);
      if (rect.right <= 0 || rect.left >= vw || rect.bottom <= 0) continue;
      zoomed.push({
        selector: uniqueSelector(el),
        tag: el.tagName.toLowerCase(),
        text: el.getAttribute('name') || el.getAttribute('aria-label') || '',
        detail: 'Font size ' + fontSize + 'px',
        rect: rectOf(el),
      });
    }
    if (zoomed.length) {
      issues.push({
        id: 'ios-input-zoom',
        severity: 'P2',
        title: 'iOS will auto-zoom form fields',
        detail:
          zoomed.length +
          ' form control(s) use font-size below 16px. iOS Safari zooms the page when the field is focused.',
        evidence: zoomed.slice(0, 6),
      });
    }

    if (profile && profile.notch && viewportFitCover && cssFacts && !cssFacts.usesSafeArea) {
      const edgeElements = [];
      for (const el of body.querySelectorAll('*')) {
        if (edgeElements.length >= 5) break;
        if (!isVisible(el) || isIgnored(el)) continue;
        const cs = styleOf(el);
        if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
        const rect = rawRectOf(el);
        if (rect.right <= 0 || rect.left >= vw || rect.bottom <= 0) continue;
        const touchesTop = rect.top <= 2 || cs.top !== 'auto';
        const touchesBottom = rect.bottom >= vh - 2 || cs.bottom !== 'auto';
        if (!touchesTop && !touchesBottom) continue;
        edgeElements.push({
          selector: uniqueSelector(el),
          tag: el.tagName.toLowerCase(),
          text: textOf(el, 40),
          rect: rectOf(el),
        });
      }
      if (edgeElements.length) {
        issues.push({
          id: 'safe-area-inset',
          severity: 'P2',
          title: 'No safe-area inset handling',
          detail:
            'The page uses viewport-fit=cover and fixed elements touch a screen edge, but no env(safe-area-inset-*) was found in CSS. On notched iPhones this can collide with the notch or home indicator.',
          evidence: edgeElements,
        });
      }
    }
  }

  const mobileLike =
    ios || group === 'phone' || group === 'tablet' || group === 'foldable' || (!profile && vw <= 600);
  if (
    cssFacts &&
    cssFacts.vhCount > 0 &&
    !cssFacts.usesModernViewportUnits &&
    mobileLike
  ) {
    issues.push({
      id: 'viewport-height-units',
      severity: 'P3',
      title: 'Viewport-height units without dynamic units',
      detail:
        'CSS uses ' +
        cssFacts.vhCount +
        ' viewport-height unit(s) with no svh/lvh/dvh fallback. Mobile browser chrome can hide content or cause jumps.',
      evidence: [
        {
          selector: 'html',
          tag: 'html',
          text: cssFacts.vhCount + ' viewport-height unit usages',
          rect: null,
        },
      ],
    });
  }

  if (tv) {
    const overscan = [];
    const smallText = [];
    const smallTargets = [];
    for (const el of body.querySelectorAll('*')) {
      if (!isVisible(el) || isIgnored(el)) continue;
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute('role') || '';
      const interactive =
        ['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(tag) ||
        ['button', 'link', 'menuitem', 'tab'].includes(role);
      const media = tag === 'img' || tag === 'video';
      const direct = directText(el);
      if (!direct && !interactive && !media) continue;
      const rect = rawRectOf(el);
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (rect.right <= 0 || rect.left >= vw || rect.bottom <= 0) continue;
      const safeX = vw * 0.05;
      const safeY = vh * 0.05;
      const outside =
        rect.left < safeX ||
        rect.right > vw - safeX ||
        rect.top < safeY ||
        rect.bottom > vh - safeY;
      if (outside && overscan.length < 8) {
        overscan.push({
          selector: uniqueSelector(el),
          tag,
          text: direct ? direct.slice(0, 50) : textOf(el, 50),
          detail: 'Crosses the 5% overscan safe area',
          rect: rectOf(el),
        });
      }
      if (direct) {
        const fontSize = Number.parseFloat(styleOf(el).fontSize);
        if (Number.isFinite(fontSize) && fontSize < 12 && smallText.length < 8) {
          smallText.push({
            selector: uniqueSelector(el),
            tag,
            text: direct.slice(0, 50),
            detail: fontSize + 'px text',
            rect: rectOf(el),
          });
        }
      }
      if (interactive && (rect.width < 48 || rect.height < 48) && smallTargets.length < 8) {
        smallTargets.push({
          selector: uniqueSelector(el),
          tag,
          text: textOf(el, 40),
          detail: Math.round(rect.width) + 'x' + Math.round(rect.height),
          rect: rectOf(el),
        });
      }
    }

    if (cssFacts && !cssFacts.hasFocusRules) {
      issues.push({
        id: 'tv-focus',
        severity: 'P1',
        title: 'No visible focus styling for D-pad navigation',
        detail:
          'No :focus or :focus-visible rules were found. TV navigation moves focus with a remote; without a visible ring users cannot see where they are.',
        evidence: [],
      });
    }
    if (overscan.length) {
      issues.push({
        id: 'tv-overscan',
        severity: 'P2',
        title: 'Content enters the TV overscan area',
        detail:
          overscan.length +
          ' content element(s) sit within 5% of a viewport edge, where TVs may crop them. Keep critical content inside the safe area.',
        evidence: overscan,
      });
    }
    if (smallText.length) {
      issues.push({
        id: 'tv-font-size',
        severity: 'P2',
        title: 'Text is too small for TV viewing distance',
        detail: smallText.length + ' text element(s) render below 12px.',
        evidence: smallText,
      });
    }
    if (smallTargets.length) {
      issues.push({
        id: 'tv-target-size',
        severity: 'P2',
        title: 'Focus targets are too small for a remote',
        detail:
          smallTargets.length +
          ' interactive element(s) are below 48x48, making D-pad navigation error-prone.',
        evidence: smallTargets,
      });
    }

    const documentHeight = Math.max(root.scrollHeight, body ? body.scrollHeight : 0);
    if (documentHeight > vh * 2) {
      issues.push({
        id: 'tv-scroll',
        severity: 'P3',
        title: 'Long page requires remote scrolling',
        detail:
          'Page is ' +
          Math.round(documentHeight / vh) +
          ' viewport heights tall. TV interfaces are easier to navigate with paged or horizontal layouts.',
        evidence: [
          {
            selector: 'body',
            tag: 'body',
            text: 'document height ' + documentHeight + 'px',
            rect: null,
          },
        ],
      });
    }
  }

  let evidenceTotal = 0;
  let evidenceResolved = 0;
  for (const issue of issues) {
    for (const item of issue.evidence || []) {
      if (!item.selector) continue;
      evidenceTotal += 1;
      try {
        item.resolved = document.querySelectorAll(item.selector).length > 0;
      } catch {
        item.resolved = false;
      }
      if (item.resolved) evidenceResolved += 1;
    }
  }

  const documentHeight = Math.max(root.scrollHeight, body ? body.scrollHeight : 0);

  return {
    metrics: {
      requestedWidth: width,
      viewportWidth: vw,
      layoutViewportWidth: window.innerWidth,
      visualViewportWidth,
      viewportHeight: vh,
      scrollWidth,
      overflow,
      documentHeight,
      evidenceTotal,
      evidenceResolved,
      profile: profile ? profile.name : null,
    },
    issues,
  };
};

export async function measureViewport(
  page,
  { width, height, settle = 350, profile = null, cssFacts = null, resize = true } = {}
) {
  if (resize) {
    const current = page.viewportSize();
    if (!current || current.width !== width || current.height !== height) {
      await page.setViewportSize({ width, height });
    }
  }

  await page.waitForTimeout(settle);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );

  return page.evaluate(MEASURE, { width, height, profile, cssFacts });
}
