# Presentation HTML Style Reference

Quick reference for maintaining visual consistency across exhibit and slide pages.

## External dependency

```html
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
```

Inter for body text, JetBrains Mono for labels, code, and session IDs.

## Color palette

| Role | Hex | Usage |
|------|-----|-------|
| Background | `#0f1117` | Page body |
| Panel background | `#161922` | All prompt/doc/closing panels |
| Divider lines | `#1e2130` | `<hr>`, panel borders, header bottom |
| Dim text | `#4a5060` | `.dim` spans inside panels — visible but doesn't pull the eye |
| Ellipsis dots | `#2d3348` | `· · ·` between sections |
| Commentary text | `#8b93a5` | Prose below panels |
| Commentary emphasis | `#a5b0c4` | `<em>` inside commentary |
| Panel body text | `#d1d5de` | Primary readable text inside panels |
| Bright headings | `#e8ebf0` | h1, h2, closing `<strong>` |
| Muted code | `#8b93a5` | `<code>` inside panels, on `#1e2130` background |

## Panel border colors (left border, 3px)

| Color | Hex | Meaning |
|-------|-----|---------|
| Blue | `#3b82f6` | User prompt (`prompt-panel`) |
| Red | `#ef4444` | Repeated/bad prompt (`prompt-panel.repeated`) |
| Green | `#22c55e` | Orchestrator / document excerpt (`doc-panel`) |
| Amber | `#f59e0b` | Stage 2 — Triage |
| Blue | `#3b82f6` | Stage 3 — Paper Read |
| Purple | `#a855f7` | Stage 4 — Audit |

## Panel anatomy

Every panel has:
- `background: #161922`
- `border-left: 3px solid <color>`
- `border-radius: 0 8px 8px 0`
- `padding: 1.8rem 2rem`
- A floating label above the top-left corner via `::before` pseudo-element

User prompts use `content: 'USER'` hardcoded. Doc panels use `content: attr(data-label)` so the label is set per-element in the HTML.

## Dim text rule

Wrap de-emphasized portions of a prompt or doc excerpt in `<span class="dim">`. Always pull punctuation (periods, commas) inside the span so bright punctuation doesn't orphan at the end of a dimmed phrase.

```html
<!-- correct -->
<span class="dim">some detail that isn't the point.</span> The part that matters.

<!-- wrong — orphaned period -->
<span class="dim">some detail that isn't the point</span>. The part that matters.
```

## Page layouts

**Exhibit** (scrolling, multi-segment): `max-width: 720px`, centered with `margin: 0 auto`, padded `6vh` top / `12vh` bottom. Segments separated by `margin-bottom: 7vh`. Dividers (`<hr class="divider">`) and ellipses (`· · ·`) break major sections.

**Single slide** (viewport-centered): Body uses `display: flex; align-items: center; justify-content: center; min-height: 100vh`. Content in a `.slide` div, `max-width: 720px`.

## Typography

- Body: `1.15rem`, line-height `1.7`
- Panel text: `1.08rem`, line-height `1.75`
- Commentary: `1.05rem`, line-height `1.75`
- h1: `2.2–2.4rem`, weight `600`
- Labels (USER, file paths): JetBrains Mono, `0.65rem`, `letter-spacing: 0.12em`, uppercase
- Session IDs / file paths in headers: JetBrains Mono, `0.85rem`

## Structural conventions

- Commentary never goes inside a panel — always a separate `<div class="commentary">` below
- Stacked prompts with no commentary between them use `.prompt-stack` (tight `0.35rem` gap)
- Closing panels use a full border (`border: 1px solid #1e2130`) instead of a left-border accent, with `border-radius: 8px` all around
- Stage labels (in the stages exhibit) are small pill-shaped tags with a tinted background matching the stage color at ~8% opacity
