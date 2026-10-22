import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBreakpointsFromText, buildWidths } from '../scripts/discover.mjs';

test('parses min-width and max-width', () => {
  assert.deepEqual(parseBreakpointsFromText('(min-width: 768px) and (max-width: 900px)'), [
    768, 900,
  ]);
});

test('parses range syntax with width', () => {
  assert.deepEqual(parseBreakpointsFromText('(width >= 400px)'), [400]);
  assert.deepEqual(parseBreakpointsFromText('(400px <= width <= 700px)'), [400, 700]);
  assert.deepEqual(parseBreakpointsFromText('(width > 600px)'), [600]);
});

test('converts em and rem to pixels', () => {
  assert.deepEqual(parseBreakpointsFromText('(min-width: 48em)'), [768]);
  assert.deepEqual(parseBreakpointsFromText('(max-width: 40rem)'), [640]);
});

test('ignores conditions that are not width based', () => {
  assert.deepEqual(parseBreakpointsFromText('screen and (orientation: landscape)'), []);
  assert.deepEqual(parseBreakpointsFromText('(prefers-color-scheme: dark)'), []);
  assert.deepEqual(parseBreakpointsFromText('768px'), []);
});

test('ignores height, resolution, and pixel-ratio values', () => {
  assert.deepEqual(parseBreakpointsFromText('(min-width: 768px) and (max-height: 500px)'), [768]);
  assert.deepEqual(parseBreakpointsFromText('(min-resolution: 2dppx) and (width >= 400px)'), [
    400,
  ]);
});

test('supports comma-separated media query lists', () => {
  assert.deepEqual(parseBreakpointsFromText('(min-width: 600px), (min-width: 900px)'), [
    600, 900,
  ]);
});

test('clamps parsed breakpoints to the supported range', () => {
  assert.deepEqual(parseBreakpointsFromText('(min-width: 200px)'), []);
  assert.deepEqual(parseBreakpointsFromText('(min-width: 5000px)'), []);
});

test('buildWidths always respects the cap', () => {
  const widths = buildWidths([320, 480, 640, 768, 900, 1024, 1280], { max: 6 });
  assert.ok(widths.length <= 6);
  assert.deepEqual(widths, [...new Set(widths)].sort((a, b) => a - b));
  assert.ok(widths.every((width) => width >= 280 && width <= 3840));
});

test('buildWidths prioritizes anchor devices before sampling the rest', () => {
  const widths = buildWidths([480, 640, 768, 900, 1024], { max: 28 });
  assert.equal(widths.length, 28);
  assert.ok(widths.includes(320));
  assert.ok(widths.includes(375));
  assert.ok(widths.includes(390));
  assert.ok(widths.includes(1440));
  assert.ok(widths.includes(3440));
});

test('buildWidths keeps every edge when under the cap', () => {
  const widths = buildWidths([768], { max: 28 });
  assert.ok(widths.includes(767));
  assert.ok(widths.includes(768));
  assert.ok(widths.includes(769));
});

test('buildWidths includes representative device widths', () => {
  const widths = buildWidths([], { max: 28 });
  assert.ok(widths.includes(320));
  assert.ok(widths.includes(390));
  assert.ok(widths.includes(1440));
  assert.ok(widths.includes(3440));
});

test('buildWidths handles a cap of one', () => {
  const widths = buildWidths([320, 480, 640, 768], { max: 1 });
  assert.equal(widths.length, 1);
});

test('buildWidths survives more breakpoints than the cap', () => {
  const breakpoints = Array.from({ length: 100 }, (_, index) => 320 + index * 8);
  const widths = buildWidths(breakpoints, { max: 10 });
  assert.ok(widths.length <= 10);
  assert.ok(widths.length > 1);
});

test('buildWidths deduplicates edges outside the range', () => {
  const widths = buildWidths([280, 3840], { max: 28 });
  assert.ok(widths.includes(279) === false);
  assert.ok(widths.includes(3841) === false);
  assert.ok(widths.includes(280));
  assert.ok(widths.includes(3840));
});
