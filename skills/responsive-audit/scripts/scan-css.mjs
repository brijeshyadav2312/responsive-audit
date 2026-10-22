export async function scanCss(page) {
  return page.evaluate(() => {
    const facts = {
      sheets: 0,
      unreadableSheets: 0,
      ruleCount: 0,
      mediaRuleCount: 0,
      cssBytes: 0,
      vhCount: 0,
      usesModernViewportUnits: false,
      usesSafeArea: false,
      hasFocusRules: false,
      hasFocusVisible: false,
      hasHoverMedia: false,
      usesTextSizeAdjust: false,
      hasContainerQueries: false,
      viewportMeta: null,
      viewportFit: null,
    };

    const inspectText = (text) => {
      if (!text) return;
      facts.cssBytes += text.length;
      const vh = text.match(/\b\d*\.?\d+(?:svh|lvh|dvh|vh)\b/g);
      if (vh) facts.vhCount += vh.length;
      if (/\b(?:svh|lvh|dvh)\b/.test(text)) facts.usesModernViewportUnits = true;
      if (/env\(\s*safe-area-inset/i.test(text)) facts.usesSafeArea = true;
      if (/:focus-visible/.test(text)) facts.hasFocusVisible = true;
      if (/:focus(?!-visible)/.test(text)) facts.hasFocusRules = true;
      if (/text-size-adjust/i.test(text)) facts.usesTextSizeAdjust = true;
      if (/container-type\s*:|@container/i.test(text)) facts.hasContainerQueries = true;
    };

    const walk = (list) => {
      for (const rule of Array.from(list || [])) {
        try {
          facts.ruleCount += 1;
          if (rule.selectorText && /:focus/.test(rule.selectorText)) {
            facts.hasFocusRules = true;
            if (/:focus-visible/.test(rule.selectorText)) facts.hasFocusVisible = true;
          }
          if (rule.media) {
            facts.mediaRuleCount += 1;
            if (/hover/i.test(rule.media.mediaText || '')) facts.hasHoverMedia = true;
            inspectText(rule.media.mediaText);
          }
          if (rule.conditionText) inspectText(rule.conditionText);
          if (rule.cssText && !rule.media && !rule.conditionText) inspectText(rule.cssText);
          if (rule.styleSheet) walk(rule.styleSheet.cssRules);
          if (rule.cssRules && !rule.styleSheet) walk(rule.cssRules);
        } catch {
          // opaque or cross-origin rule
        }
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      facts.sheets += 1;
      try {
        walk(sheet.cssRules);
      } catch {
        facts.unreadableSheets += 1;
      }
    }

    for (const sheet of Array.from(document.adoptedStyleSheets || [])) {
      facts.sheets += 1;
      try {
        walk(sheet.cssRules);
      } catch {
        facts.unreadableSheets += 1;
      }
    }

    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      facts.viewportMeta = meta.getAttribute('content') || '';
      const fit = facts.viewportMeta.match(/viewport-fit\s*=\s*([^,\s]+)/i);
      facts.viewportFit = fit ? fit[1] : null;
    }

    return facts;
  });
}
