# Promo View — Requirements

**Date:** 2026-04-26
**Status:** Draft
**Scope:** Standard

## Problem

Creating promotional videos for AI research tutorials requires recording the tutorial viewer, but the current viewer is optimized for interactive exploration — scroll-driven timeline, navigation controls, tutorial comments, taskbar. These elements are noise in a promo context. There's no way to produce a clean, cinematic playback of a workflow that auto-advances through steps with controlled timing.

## Goals

1. Provide a dev-only cinematic playback mode that renders a tutorial as a timed, auto-playing sequence
2. Support per-step timing control with minimal authoring overhead
3. Make prompts and final answers visually striking for promotional use
4. Reuse existing tutorial data and step rendering — no new content format

## Non-Goals

- Programmatic video/GIF export (user records screen manually)
- Supporting every step type with custom promo styling (tool calls etc. render as-is)
- Production deployment — dev-only route
- Replacing or modifying the existing tutorial viewer

## User Experience

### Route

`/promo/[slug]` — dev-only, gated by `import.meta.env.DEV`. Loads from the same tutorial registry as `/tutorials/[slug]`.

### Playback

Content builds up progressively in a single column. Each step fades/slides in after the previous step's duration elapses. The sequence auto-plays from the first step on page load (or on click to start).

**Per round:**
1. Prompt appears — large, prominent, cinematic styling
2. Non-hidden intermediate steps appear one-by-one (assistant messages, tool calls in existing style)
3. Window content (images, code, video) appears inline as a prominent element
4. Final answer (`final: true`) appears with distinctive treatment

Steps with `hidden: true` are skipped entirely. Steps with `compact: true` render in their compact form.

### Timing

- Global default duration: configurable, starting at ~2000ms
- Per-step override: optional `duration` field on `StepBase` (in milliseconds)
- Prompts and final answers likely get longer durations; tool results shorter
- Pause/resume via spacebar (dev convenience, not shown in UI)

### Visual Treatment

**Layout:** Single centered column, no side panels. Full viewport with the aubergine wallpaper background. No nav bar, no taskbar, no controls panel, no tutorial comments.

**Prompts:** Larger text, generous padding, fade-in entrance animation. Keep the orange accent identity but make it more dramatic.

**Assistant messages:** Clean, readable, slide-up entrance. Final answers get a distinct teal accent treatment at larger scale.

**Window content:** Images/code/video render at generous size within the column. May optionally expand to near-full-width for visual impact.

**Transitions:** CSS fade + slide-up for text steps. Smooth scale-in for window content. All entrance-only (content stays visible after appearing).

## Data Changes

Add one optional field to `StepBase` in `src/lib/data/tutorials.ts`:

```ts
duration?: number  // milliseconds before auto-advancing to next step
```

No other data format changes. No new composition format.

## Architecture

### New component: `PromoPlayer.svelte`

A standalone playback component that consumes a `Tutorial` and renders it cinematically. Not a mode on `TutorialViewer` — the existing viewer's scroll-driven architecture is fundamentally different from time-driven playback.

**Reuses from existing codebase:**
- `Tutorial` type and data loading
- `StepRenderer` for rendering individual step content
- `WindowContent` for window step rendering
- Wallpaper background styles

**New logic:**
- Time-driven playback engine (step queue + setTimeout/interval chain)
- Cinematic CSS (larger type, entrance animations, promo layout)
- Spacebar pause/resume

### New route: `src/routes/promo/[slug]/`

Dev-only page that loads a tutorial and passes it to `PromoPlayer`. Gated by `import.meta.env.DEV` the same way other admin routes are.

## Success Criteria

- [ ] `/promo/[slug]` renders any existing tutorial as a timed cinematic sequence
- [ ] Steps appear progressively with fade/slide animations
- [ ] Per-step `duration` overrides work alongside the global default
- [ ] Prompts and final answers have visually striking cinematic treatment
- [ ] No tutorial chrome visible (no nav, controls, taskbar, comments)
- [ ] Route is dev-only, not included in production builds
- [ ] Spacebar pauses/resumes playback

## Open Questions

1. Should there be a brief "title card" at the start showing tutorial title/description before playback begins?
2. Should window content (especially images) get a special framing treatment (e.g., subtle drop shadow, slight zoom-in animation)?
3. Should there be a visual indicator of playback progress (e.g., thin progress bar at top)?
