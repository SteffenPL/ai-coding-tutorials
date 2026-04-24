---
title: Jumpy window transitions during scroll in tutorial viewer
date: 2026-04-24
category: ui-bugs
module: tutorial-viewer
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - Multiple desktop windows appear simultaneously in a burst when scrolling
  - Window-collection (chromeless) content vanishes at high stack depths
  - Tutorial comment panel height shifts causing layout instability
root_cause: async_timing
resolution_type: code_fix
severity: medium
tags:
  - svelte
  - css-transitions
  - scroll
  - animation
  - window-management
  - reveal-queue
---

# Jumpy window transitions during scroll in tutorial viewer

## Problem

The tutorial viewer's virtual desktop renders cascading windows that update as the user scrolls through steps. Two related bugs made the experience jarring:

1. **Burst window appearance**: When scrolling quickly, `currentStep` would jump multiple steps, causing all newly-eligible windows to appear simultaneously rather than sequentially.
2. **Vanishing window-collections**: Chromeless `window-collection` containers (transparent wrappers holding sub-windows in a grid) would completely disappear when pushed back in the stack.

## Symptoms

- Scrolling past several window steps at normal speed produces a visual "burst" of windows materializing at once
- Window-collection grids vanish entirely when a regular window appears on top of them
- Comment panel resizes unpredictably as content changes

## What Didn't Work

- **Increased CSS stagger delay (80ms → 250ms → 500ms)**: Still caused burst appearance because multiple windows became eligible simultaneously when `currentStep` jumped during fast scrolling. The delay affected individual transitions but not sequencing between them. (session history)

- **CSS custom property-driven transitions**: Windows used `--stack-opacity`, `--stack-tx`, etc. set via `{@const}` inside `{#each}` blocks. Two problems: (1) CSS custom properties are not natively animatable, so `transition` declarations depending on them silently failed; (2) `{@const}` in Svelte 5 `{#each}` blocks does not re-evaluate when reactive state (`currentStep`) changes — only when the array reference changes. This meant depth/style values were computed once and frozen. (session history)

- **Exempting chromeless windows from dimming**: First fix attempt set chromeless opacity/brightness/scale to 1 at all depths. Wrong direction — the actual problem was positional: chromeless windows had `tx:0, ty:0` at all depths (no translate offset), so they were fully occluded by windows on top AND dimmed to near-invisible opacity.

- **Vista-style two-phase CSS delay**: All new windows shared a 150ms `--enter-delay` so the stack would shift back first, then windows appear together. Still didn't enforce sequential ordering when multiple elements changed state in the same frame.

- **Circular `$effect` dependency**: When implementing the reveal queue, the `$effect` both read and wrote `revealedWindows` ($state), causing infinite reactive cycles. Fixed by tracking `prevShouldBeVisible` as a plain non-reactive variable. (session history)

## Solution

### 1. JavaScript Reveal Queue

**File:** `src/lib/components/tutorial/TutorialViewer.svelte`

Replaced the CSS `--enter-delay` stagger with a timer-based reveal queue:

```typescript
let revealedWindows = $state<Set<number>>(new Set());
let revealQueue: number[] = [];
let revealTimer: ReturnType<typeof setTimeout> | null = null;
const REVEAL_INTERVAL_MS = 800;

function processRevealQueue() {
    if (revealQueue.length === 0) { revealTimer = null; return; }
    const next = revealQueue.shift()!;
    revealedWindows = new Set([...revealedWindows, next]);
    if (revealQueue.length > 0) {
        revealTimer = setTimeout(processRevealQueue, REVEAL_INTERVAL_MS);
    } else { revealTimer = null; }
}
```

- **Forward scroll**: windows are queued and revealed one at a time, 800ms apart
- **Backward scroll**: windows are instantly removed from `revealedWindows` — no queue, no delay
- `getStackDepth()` and `hasVisibleWindows` both use `revealedWindows` instead of `currentStep` for visibility gating

### 2. Inline Styles Replacing CSS Custom Properties

**File:** `src/lib/components/tutorial/DesktopStack.svelte`

All depth-based styling moved from CSS custom properties + `.visible` class toggle to direct inline styles via `stackStyle()`:

```typescript
// Before: CSS custom properties + class toggle
.fiji-window { --stack-opacity: 0; opacity: 0; }
.fiji-window.visible { opacity: var(--stack-opacity); }

// After: direct inline style
function stackStyle(depth, chromeless) {
    if (depth < 0)
        return 'opacity:0;transform:translateY(6px) scale(0.98);pointer-events:none';
    const opacity = Math.max(0.1, 1 - depth * 0.18);
    // ... compute all values
    return `opacity:${opacity};transform:translate(${tx}px,${ty}px) scale(${scale});...`;
}
```

This guarantees transitions work because the actual CSS properties (`opacity`, `transform`, `filter`) change value, not just custom properties.

### 3. Chromeless Window Stacking Fix

Window-collections now receive the same translate, scale, opacity, and brightness depth treatment as regular windows. They move, dim, and scale back in the stack identically:

```typescript
if (chromeless) {
    const tx = depth * 50;
    const ty = depth * -22;
    const scale = Math.max(0.7, 1 - depth * 0.04);
    // ... same formulas as regular windows
}
```

### 4. Comment Panel Fixed Height

**File:** `src/lib/components/tutorial/ControlsPanel.svelte`

- Removed `{#if currentStep >= 0}` guard — panel always visible with header showing "Tutorial (1 / N)"
- `.bottom-panel` changed from `overflow-y: auto` to `overflow: hidden` (fixed container)
- Added `.comment-scroll` wrapper with `overflow-y: auto` for content only
- Header stays pinned, only text area scrolls

## Why This Works

The root cause was twofold:

1. **CSS cannot enforce sequential ordering** when multiple elements change state in the same animation frame. `transition-delay` only delays an individual element's transition start — it cannot sequence transitions across elements relative to each other. A JavaScript queue with `setTimeout` provides explicit, direction-aware control.

2. **CSS custom properties are not animatable**. Setting `opacity: var(--stack-opacity)` and changing `--stack-opacity` does not trigger a CSS transition on `opacity` in all browsers. Direct inline style changes (`opacity: 0.82` → `opacity: 0.64`) reliably trigger transitions.

The chromeless fix was a simple logic correction: transparent containers need the same positional offset as opaque windows to avoid being fully occluded by windows stacked on top.

## Prevention

- **Prefer inline styles over CSS custom properties when animation reliability matters.** CSS custom properties are not in the set of animatable properties; transitions depending on them silently fail.
- **Use JavaScript queues for sequential multi-element choreography.** CSS `transition-delay` cannot enforce ordering when multiple elements change state in the same frame. A timer queue gives explicit control over reveal sequencing and direction-dependent behavior.
- **Transparent containers need the same stacking behavior as opaque windows.** Do not exempt chromeless/transparent elements from translate offsets — without offset, they are fully occluded by any opaque window on top.
- **Avoid `{@const}` for values that must react to external state in Svelte 5.** Use `$derived` or compute values inline in the template when they depend on reactive state outside the `{#each}` array.
- **Break circular `$effect` dependencies** by tracking comparison state in plain (non-`$state`) variables that don't trigger re-evaluation.

## Related Issues

- `docs/solutions/design-patterns/step-display-category-system-2026-04-23.md` — upstream step rendering pipeline in the same tutorial viewer
