# Platform behavior and fixes

Emulation catches layout math. It does not reproduce every platform behavior. Use this file to interpret findings and to brief a real-device pass.

## iOS Safari

| Behavior | Symptom | Fix |
|----------|---------|-----|
| Layout viewport changes with browser chrome | `100vh` sections are too tall or jump when the URL bar collapses | use `100dvh` with a `100vh` fallback, or `min-height: 100svh` for stable framing |
| Safe-area insets | fixed headers/footers collide with the notch or home indicator | add `viewport-fit=cover` and pad with `env(safe-area-inset-*)` |
| Input auto-zoom | focusing an input with font-size below 16px zooms the page | set form control font-size to at least 16px |
| Text autosizing | text inside wide blocks grows unexpectedly in landscape | set a explicit text size or `-webkit-text-size-adjust: 100%` |
| Rubber-band scrolling | fixed elements detach or background scrolls behind overlays | lock body scroll while modal overlays are open |
| Hover-only affordances | menus that open on hover are unreachable | pair hover styles with `:focus-within` and touch-friendly controls |

Safe-area pattern:

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

.site-header { padding-top: var(--safe-top); }
.bottom-bar { padding-bottom: calc(16px + var(--safe-bottom)); }
```

## Android Chrome

| Behavior | Symptom | Fix |
|----------|---------|-----|
| 360px logical width is common | desktop-only spacing crowds or overflows | design from 320-360 up, not from 390 |
| Toolbar consumes visual height | full-height heroes are clipped | use `dvh` or `svh` instead of `vh` |
| Large font scaling | fixed-height text containers clip | use `min-height` and allow wrapping |
| Address-bar hiding | layout shifts during scroll | avoid fixed heights tied to the visual viewport |
| Touch exploration | small controls are hard to hit | keep 24x24 minimum, 44x44 preferred |

Use `@media (hover: hover) and (pointer: fine)` for hover-only enhancements. Do not hide core actions behind hover.

## TV browsers

There is no single Android TV web browser. Verify against the platform you ship on:

- **Fire TV:** Silk browser or a WebView
- **Samsung:** Tizen Web Engine
- **LG:** webOS Web Engine
- **Generic:** Chromium-based WebView or browser

TV checklist:

1. Design for a 10-foot viewing distance, not a desktop monitor.
2. Use a 960x540 design base and scale to 1920x1080 output.
3. Keep text, controls, and critical imagery inside a 5% overscan inset.
4. Provide visible `:focus-visible` styling and a logical D-pad order.
5. Use at least 12px text and 48x48 focus targets.
6. Prefer paged or horizontal navigation over multi-screen vertical scroll.
7. Test with a real remote or keyboard, not a mouse.

Focus pattern:

```css
:focus-visible {
  outline: 3px solid #ffd166;
  outline-offset: 3px;
}
```

## Foldables

- The cover screen is narrow and tall; the inner screen is close to a small tablet.
- Do not assume a single aspect ratio or a permanent orientation.
- Avoid fixed-position layouts tied to one screen; use max-width constraints and fluid grids.
- Test both `foldable-cover` and `foldable-open`, and both orientations for critical flows.
- Hinge posture and app continuity are platform APIs, not CSS. Emulation cannot verify them.

## Responsive fixes that scale

Prefer layout primitives over adding breakpoints:

```css
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.row { display: flex; flex-wrap: wrap; gap: 12px; }
.panel { min-width: 0; max-width: 100%; }
.media { width: 100%; height: auto; object-fit: cover; }
```

Common causes of measured failures:

- `grid-template-columns: repeat(3, 320px)` instead of a fluid track
- fixed `width` or `min-width` larger than the viewport
- `white-space: nowrap` with a fixed-width badge
- `height` fixed alongside `object-fit: fill`
- flex children without `min-width: 0`
- overlays sized in `vh` on mobile browsers
- absolute-positioned banners anchored outside the content box
