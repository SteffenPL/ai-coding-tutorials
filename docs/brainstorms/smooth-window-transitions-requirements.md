# Smooth Window Transitions

**Date:** 2026-04-24
**Status:** Ready for planning
**Scope:** Lightweight

## Problem

When scrolling through a tutorial, windows, tutorial comments, and taskbar highlights all update simultaneously. Fast scrolling causes multiple windows to materialize at once, creating a visually jarring "burst" effect. The existing 80ms stagger between windows is too tight to feel intentional.

## Goal

Make window appearances feel deliberate and sequenced rather than instantaneous, even when scrolling advances multiple steps at once. Slowness is acceptable — 500ms per window is fine.

## Requirements

### Window stagger

- Increase stagger between newly-visible windows from 80ms to **~250-300ms**
- Each window gets a minimum **200ms delay** before it appears (a "gestation" period), regardless of how fast the scroll moved
- **Cap**: if more than 3 windows become visible at once, only the last 3 stagger individually. Earlier windows appear together with the first of those 3. This keeps total animation time bounded (~900ms max)

### Comment panel

- Tutorial comment content (the panel below the desktop) should transition in with a **fade + slight upward slide** (opacity 0→1, translateY ~8px→0)
- Delayed ~200ms after the most recent window finishes appearing
- Crossfade when comment text changes (old fades out, new fades in)

### Taskbar

- Taskbar highlight changes should use a **~150ms opacity transition** instead of instant class toggle
- Active indicator should slide or fade rather than snap

### Non-goals

- No changes to scroll detection logic or `currentStep` derivation
- No animation queue / `displayStep` decoupling (Approach B — deferred)
- No per-element choreographed keyframes (Approach C — deferred)
- No changes to window exit animations

## Key files

- `src/lib/components/tutorial/TutorialViewer.svelte` — stagger logic (lines 283-311), `windowEnterDelays` map
- `src/lib/components/tutorial/DesktopStack.svelte` — CSS transitions (line ~298), `--enter-delay` CSS var
- `src/lib/components/tutorial/Taskbar.svelte` — active/visible class toggling
- Tutorial comment panel component (wherever comment text is rendered below the desktop)

## Success criteria

- Scrolling past 5 window steps at normal speed should feel like a deliberate cascade, not a burst
- No perceptible lag for single-step advancement (the 200ms minimum delay should feel snappy for 1 window)
- Fast scrolling past 10+ windows should complete within ~1.5s and not feel chaotic
