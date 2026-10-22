import { deviceWidths } from './devices.mjs';

const MIN_WIDTH = 280;
const MAX_WIDTH = 3840;
const ANCHOR_WIDTHS = [
  320, 360, 375, 390, 412, 430, 768, 820, 1024, 1280, 1366, 1440, 1920, 2560, 3440,
];

function toPx(value, unit) {
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return null;
  if (!unit || unit === 'px') return number;
  if (unit === 'em' || unit === 'rem') return number * 16;
  return null;
}

function stripNonWidthConditions(text) {
  let cleaned = text;
  for (let pass = 0; pass < 8; pass += 1) {
    const next = cleaned.replace(/\(([^()]*)\)/g, (match, inner) =>
      /\bwidth\b/i.test(inner) ? match : ' '
    );
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

export function parseBreakpointsFromText(text, { min = MIN_WIDTH, max = MAX_WIDTH } = {}) {
  if (!text || !/\bwidth\b/i.test(text)) return [];

  const cleaned = stripNonWidthConditions(text);
  const found = new Set();
  const re = /(-?[\d.]+)\s*(px|em|rem)\b/gi;
  let match;

  while ((match = re.exec(cleaned))) {
    const px = toPx(match[1], match[2].toLowerCase());
    if (px === null) continue;
    const rounded = Math.round(px);
    if (rounded >= min && rounded <= max) found.add(rounded);
  }

  return [...found].sort((a, b) => a - b);
}

export async function discoverBreakpointsDetailed(page) {
  const scan = await page.evaluate(() => {
    const texts = [];
    let sheets = 0;
    let unreadable = 0;

    const collect = (list) => {
      for (const rule of Array.from(list || [])) {
        try {
          if (rule.media && rule.media.mediaText) texts.push(rule.media.mediaText);
          if (rule.conditionText) texts.push(rule.conditionText);
          if (rule.styleSheet) collect(rule.styleSheet.cssRules);
          if (rule.cssRules && !rule.styleSheet) collect(rule.cssRules);
        } catch {
          // opaque or cross-origin rule
        }
      }
    };

    const handle = (sheet) => {
      sheets += 1;
      try {
        collect(sheet.cssRules);
      } catch {
        unreadable += 1;
      }
    };

    for (const sheet of Array.from(document.styleSheets)) handle(sheet);
    for (const sheet of Array.from(document.adoptedStyleSheets || [])) handle(sheet);

    return { texts, sheets, unreadable };
  });

  const breakpoints = new Set();
  for (const text of scan.texts) {
    for (const width of parseBreakpointsFromText(text)) breakpoints.add(width);
  }

  return {
    breakpoints: [...breakpoints].sort((a, b) => a - b),
    sheets: scan.sheets,
    unreadableSheets: scan.unreadable,
  };
}

export async function discoverBreakpoints(page) {
  const detailed = await discoverBreakpointsDetailed(page);
  return detailed.breakpoints;
}

function sampleEvenly(values, count) {
  if (count <= 0) return [];
  if (values.length <= count) return values.slice();
  if (count === 1) return [values[Math.floor(values.length / 2)]];
  const out = [];
  const last = values.length - 1;
  for (let index = 0; index < count; index += 1) {
    out.push(values[Math.round((index * last) / (count - 1))]);
  }
  return [...new Set(out)];
}

export function buildWidths(breakpoints = [], { max = 28, extra = [] } = {}) {
  const cap = Math.max(1, Math.floor(Number(max) || 28));
  const inRange = (width) => width >= MIN_WIDTH && width <= MAX_WIDTH;

  const sortedBreakpoints = [
    ...new Set(
      breakpoints
        .map((value) => Math.round(Number(value)))
        .filter((value) => Number.isFinite(value) && inRange(value))
    ),
  ].sort((a, b) => a - b);

  const edges = new Set();
  for (const breakpoint of sortedBreakpoints) {
    for (const width of [breakpoint - 1, breakpoint, breakpoint + 1]) {
      if (inRange(width)) edges.add(width);
    }
  }

  const all = [
    ...new Set(
      [...edges, ...extra, ...deviceWidths()]
        .map((value) => Math.round(Number(value)))
        .filter((value) => Number.isFinite(value) && inRange(value))
    ),
  ].sort((a, b) => a - b);

  if (all.length <= cap) return all;

  const priority = [...edges].sort((a, b) => a - b);
  let chosen;

  if (priority.length >= cap) {
    chosen = sampleEvenly(priority, cap);
  } else {
    const room = cap - priority.length;
    const anchors = ANCHOR_WIDTHS.filter(
      (width) => all.includes(width) && !edges.has(width)
    );
    const anchorPicks = anchors.length > room ? sampleEvenly(anchors, room) : anchors;
    const rest = all.filter(
      (width) => !edges.has(width) && !anchorPicks.includes(width)
    );
    chosen = [
      ...priority,
      ...anchorPicks,
      ...sampleEvenly(rest, Math.max(0, room - anchorPicks.length)),
    ];
  }

  if (chosen.length < cap) {
    const have = new Set(chosen);
    for (const width of all) {
      if (have.has(width)) continue;
      chosen.push(width);
      have.add(width);
      if (chosen.length >= cap) break;
    }
  }

  return [...new Set(chosen)].sort((a, b) => a - b).slice(0, cap);
}
