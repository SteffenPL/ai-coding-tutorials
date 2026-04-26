---
title: "feat: Add cinematic promo view for tutorial recordings"
type: feat
status: active
date: 2026-04-26
origin: docs/brainstorms/promo-view-requirements.md
---

# feat: Add cinematic promo view for tutorial recordings

## Overview

Add a dev-only `/promo/[slug]` route that renders any tutorial as a timed, auto-playing cinematic sequence. Content builds up progressively in a single centered column with fade/slide entrance animations, cinematic typography, and per-step timing control. Designed for screen-recording promotional videos of AI research workflows.

---

## Problem Frame

The current tutorial viewer is optimized for interactive exploration — scroll-driven timeline, navigation controls, tutorial comments, taskbar. These elements are noise when recording promotional material. There is no clean way to produce a cinematic, auto-advancing playback of a workflow. (see origin: `docs/brainstorms/promo-view-requirements.md`)

---

## Requirements Trace

- R1. Dev-only cinematic playback mode that auto-advances through steps with timed delays
- R2. Per-step timing control via optional `duration` field on `StepBase`, with a global default
- R3. Cinematic visual treatment for prompts and final answers (larger text, entrance animations)
- R4. Reuse existing tutorial data and rendering components — no new content format
- R5. No tutorial chrome (nav, controls, taskbar, comments)
- R6. Spacebar pause/resume for dev convenience

---

## Scope Boundaries

- No programmatic video/GIF export — user records screen manually
- No custom promo styling for every step type — tool calls etc. render as-is
- No production deployment — route excluded from static build
- No modifications to the existing TutorialViewer

---

## Context & Research

### Relevant Code and Patterns

- `src/routes/preview/[slug]/+page.ts` — dev-only route pattern: `prerender = false`, loads tutorial, passes to viewer component
- `src/lib/components/tutorial/StepRenderer.svelte` — pure presentational step renderer, directly reusable
- `src/lib/components/windows/WindowContent.svelte` — window content dispatcher, directly reusable
- `src/lib/components/windows/WindowChrome.svelte` — window title bar chrome, reusable for inline window display
- `src/lib/components/Wallpaper.svelte` — gradient mesh background, directly reusable
- `src/lib/components/tutorial/step-colors.ts` — step category system (`primary`/`supporting`/`structural`) with `getCategory()` — useful for intelligent default durations
- `src/lib/data/tutorial-loader.ts` — `getTutorialBySlug()` for build-time tutorial loading
- `src/lib/data/tutorials.ts` — `StepBase`, `Tutorial`, `TutorialRound`, all step types

### Institutional Learnings

- **Inline styles for animation** (`docs/solutions/ui-bugs/window-transition-scroll-jank-2026-04-24.md`): CSS custom properties are not animatable — use inline `style` for `opacity`, `transform`, `filter` on animated elements
- **Component reuse pattern** (`docs/solutions/design-patterns/wysiwyg-trace-editing-via-component-reuse-2026-04-23.md`): Wrap `StepRenderer` and window components with mode-specific affordances rather than forking
- **Step category pacing** (`docs/solutions/design-patterns/step-display-category-system-2026-04-23.md`): Use `getCategory()` from `step-colors.ts` for category-aware default durations (linger on primary, brief on supporting)
- **`$effect` circularity** — keep timer state in plain variables, not `$state`, when it feeds back into effects that read the same state

---

## Key Technical Decisions

- **Standalone PromoPlayer, not a TutorialViewer mode**: The existing viewer's scroll-driven architecture (spacers, sticky prompts, viewport intersection) is fundamentally incompatible with time-driven playback. Bolting on a `promoMode` flag would require conditionally disabling most core logic. A new component that reuses leaf renderers (`StepRenderer`, `WindowContent`, `Wallpaper`) is cleaner and lower-risk.
- **Category-aware default durations**: Instead of a single flat default, use the existing step category system — primary steps (assistant, question) get longer defaults (~3000ms), supporting steps (tool_call, tool_result, thinking) get shorter (~1200ms), structural steps (window, table) get medium (~2500ms). Per-step `duration` override always wins.
- **Progressive build-up layout**: Content accumulates on screen (no slide replacement). Each step fades/slides in below the previous one. Auto-scroll keeps the newest content visible.
- **`prerender = false` for dev gating**: Follows the established pattern used by `/preview/[slug]`, `/edit`, `/curate/[slug]`. The static adapter strips non-prerendered routes from production builds.

---

## Open Questions

### Resolved During Planning

- **Title card at start?** Yes — show tutorial title briefly before playback begins. Low cost, high polish for promo recordings. Implementation: a simple fade-in/fade-out title overlay before the first step.
- **Progress indicator?** Yes — a thin progress bar at the top of the viewport. Subtle enough for recordings but useful during authoring to gauge pacing.

### Deferred to Implementation

- **Exact animation timing curves**: Fine-tune ease functions and durations visually during implementation
- **Window content sizing**: How large window images/code render inline — may need visual iteration

---

## Output Structure

```
src/routes/promo/[slug]/
  +page.ts                    # dev-only loader (prerender: false)
  +page.svelte                # mounts PromoPlayer
src/lib/components/promo/
  PromoPlayer.svelte          # main orchestrator (timer-driven playback)
  PromoStep.svelte            # per-step wrapper with entrance animation
  PromoPrompt.svelte          # cinematic prompt rendering
  PromoProgress.svelte        # thin top progress bar
```

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Playback engine (PromoPlayer):

  flatSteps = flatten(tutorial.rounds)  // round prompts become pseudo-steps
    → filter out hidden steps

  currentIndex = -1  (title card phase)
  visibleSteps = []  (accumulates as playback advances)

  on advance():
    currentIndex++
    visibleSteps.push(flatSteps[currentIndex])
    auto-scroll to bottom
    schedule next advance after step.duration ?? categoryDefault(step.type)

  on spacebar:
    toggle pause/resume (clear/restart timer)

Layout:
  ┌─────────────────────────────────┐
  │ ▓▓▓▓▓░░░░░░░░░░ progress bar   │  ← thin, top-fixed
  │                                 │
  │     ┌─────────────────────┐     │
  │     │ Tutorial Title      │     │  ← title card (fades out)
  │     └─────────────────────┘     │
  │                                 │
  │     ┌─────────────────────┐     │
  │     │ › User prompt       │     │  ← cinematic prompt
  │     └─────────────────────┘     │
  │     ┌─────────────────────┐     │
  │     │ Assistant response   │     │  ← fade-in, slide-up
  │     └─────────────────────┘     │
  │     ┌─────────────────────┐     │
  │     │ ┌─ Window ────────┐ │     │  ← inline window with chrome
  │     │ │  [image/code]   │ │     │
  │     │ └─────────────────┘ │     │
  │     └─────────────────────┘     │
  │     ┌─────────────────────┐     │
  │     │ Final answer (teal) │     │  ← cinematic final answer
  │     └─────────────────────┘     │
  │                                 │
  │         [Wallpaper BG]          │
  └─────────────────────────────────┘
```

---

## Implementation Units

- [ ] U1. **Add `duration` field to StepBase**

**Goal:** Extend the step type system with an optional per-step duration override for promo playback.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `src/lib/data/tutorials.ts`

**Approach:**
- Add `promoDuration?: number` to the `StepBase` interface (named `promoDuration` to avoid collision with `ThinkingStep.duration` which is a display string)
- This is a purely additive, optional field — no existing code is affected
- No composition format version bump needed (optional fields are backwards-compatible)

**Patterns to follow:**
- Existing optional fields on `StepBase` (`comment?`, `compact?`, `hidden?`)

**Test expectation:** none — pure type addition with no runtime behavior change

**Verification:**
- TypeScript compiles with no errors
- Existing tutorials continue to load without issues

---

- [ ] U2. **Create the `/promo/[slug]` route**

**Goal:** Add a dev-only route that loads a tutorial and passes it to the PromoPlayer component.

**Requirements:** R1, R4, R5

**Dependencies:** None (can run in parallel with U1)

**Files:**
- Create: `src/routes/promo/[slug]/+page.ts`
- Create: `src/routes/promo/[slug]/+page.svelte`

**Approach:**
- `+page.ts`: `prerender = false`, use `getTutorialBySlug(slug)` from `tutorial-loader.ts`. Return 404 if not found.
- `+page.svelte`: import and render `PromoPlayer` (created in U3), passing the tutorial as a prop
- No nav bar, no layout chrome — just the player component filling the viewport

**Patterns to follow:**
- `src/routes/preview/[slug]/+page.ts` — same `prerender = false` + load pattern
- `src/routes/preview/[slug]/+page.svelte` — same minimal page structure

**Test expectation:** none — route scaffolding, verified manually in dev server

**Verification:**
- `/promo/install-claude-code` (or any existing slug) loads without error in dev
- Route does not appear in `npm run build` output

---

- [ ] U3. **Build PromoPlayer orchestrator with timer-driven playback**

**Goal:** Create the main promo component that flattens tutorial rounds into a step sequence and auto-advances through them with configurable timing.

**Requirements:** R1, R2, R4, R6

**Dependencies:** U1 (for `duration` field), U2 (for route to mount it)

**Files:**
- Create: `src/lib/components/promo/PromoPlayer.svelte`

**Approach:**
- Accept `tutorial: Tutorial` prop
- Flatten rounds into a linear step list, inserting "prompt" pseudo-entries at round boundaries. Filter out `hidden: true` steps.
- Playback engine: `currentIndex` state drives which steps are visible. `visibleSteps` accumulates (progressive build-up). Timer advances via `setTimeout` chained per-step (not `setInterval`) to respect per-step durations.
- Duration resolution: `step.duration ?? categoryDefault(step.type)`. Category defaults from `getCategory()` in `step-colors.ts`: primary ~3000ms, supporting ~1200ms, structural ~2500ms. Prompts ~3500ms.
- Title card: show tutorial title for ~3000ms before first step, then fade out
- Auto-scroll: after each step appears, smooth-scroll the container so the new step is visible
- Spacebar handler: toggle pause (clear timeout) / resume (schedule next advance)
- Progress bar: pass `currentIndex / totalSteps` to a PromoProgress child
- Use plain variables (not `$state`) for timer IDs to avoid `$effect` circularity
- Cleanup: `onDestroy` clears any pending timeout

**Patterns to follow:**
- `TutorialViewer.svelte` `startPlay()` for the general auto-advance concept (but use `setTimeout` chain, not `setInterval`)
- Step flattening logic from `TutorialViewer.svelte` (`allSteps` computation)

**Test expectation:** none — interactive component, verified visually in dev server

**Verification:**
- Tutorial auto-plays from title card through all steps
- Spacebar pauses and resumes playback
- Per-step `duration` overrides are respected
- Supporting steps advance faster than primary steps

---

- [ ] U4. **Build PromoStep entrance animation wrapper**

**Goal:** Create a wrapper component that applies fade + slide-up entrance animation to each step as it appears.

**Requirements:** R3

**Dependencies:** U3 (mounted inside PromoPlayer)

**Files:**
- Create: `src/lib/components/promo/PromoStep.svelte`

**Approach:**
- Wrapper `<div>` that applies a CSS entrance animation when mounted (Svelte `in:` transition or CSS `animation` on mount)
- Text steps: fade + translateY slide-up (similar to existing `fadeUp` keyframe in `global.css`)
- Window steps: fade + subtle scale-in
- Accept a `kind` prop (`'prompt'` | `'step'` | `'window'` | `'final'`) to vary the animation style
- Use inline styles for animated properties (per institutional learning — CSS custom properties are not animatable)
- All entrance-only — content stays visible after appearing

**Patterns to follow:**
- `fadeUp` keyframe in `src/lib/styles/global.css`
- `welcomeIn` animation in `DesktopStack`

**Test expectation:** none — CSS animation, verified visually

**Verification:**
- Steps fade/slide in smoothly when they appear
- No layout jank during animation
- Content remains visible after animation completes

---

- [ ] U5. **Build cinematic prompt and final-answer styling**

**Goal:** Create the cinematic visual treatment for prompts and final answers that makes them visually striking for promo use.

**Requirements:** R3, R5

**Dependencies:** U3, U4

**Files:**
- Create: `src/lib/components/promo/PromoPrompt.svelte`
- Modify: `src/lib/components/promo/PromoPlayer.svelte` (integrate prompt component)

**Approach:**
- **PromoPrompt**: renders the round prompt text with cinematic styling — larger font size (~1.4rem), generous padding, orange accent bar (wider than tutorial viewer's), warm background tint. The `›` chevron identity is preserved but scaled up.
- **Final answer treatment**: in PromoPlayer, detect `final: true` on assistant steps and wrap with a cinematic variant — teal accent, slightly larger text, more breathing room. This can be a CSS class on `PromoStep` rather than a separate component.
- **Round kind styling**: `'claude'` rounds get `›` chevron; `'terminal'` rounds get `$` prefix with green accent
- No tutorial comments rendered — `comment` field is ignored entirely

**Patterns to follow:**
- Prompt styling in `src/lib/components/tutorial/TerminalTranscript.svelte` (orange bar, chevron) — scale up for cinematic feel
- Final answer teal bar in `StepRenderer.svelte`

**Test expectation:** none — CSS styling, verified visually

**Verification:**
- Prompts are visually prominent with orange accent at larger scale
- Final answers have distinct teal treatment
- Terminal round prompts show `$` with green accent
- No tutorial comments or navigation chrome visible

---

- [ ] U6. **Build PromoProgress bar**

**Goal:** Add a thin progress bar at the top of the viewport showing playback position.

**Requirements:** R1 (part of the playback experience)

**Dependencies:** U3

**Files:**
- Create: `src/lib/components/promo/PromoProgress.svelte`

**Approach:**
- Fixed-position thin bar (3-4px) at top of viewport
- Accepts `progress: number` (0-1) prop from PromoPlayer
- Filled portion uses the orange accent color with subtle glow
- CSS transition on width for smooth advancement
- Semi-transparent so it doesn't dominate the recording

**Patterns to follow:**
- Keep it minimal — this is a dev convenience that should be subtle enough for recordings

**Test expectation:** none — pure visual component

**Verification:**
- Bar advances smoothly as steps play
- Bar reaches 100% at the end of playback
- Visually subtle, doesn't distract from content

---

- [ ] U7. **Inline window rendering in promo column**

**Goal:** Render window steps inline within the promo column using existing WindowChrome and WindowContent components.

**Requirements:** R4

**Dependencies:** U3, U4

**Files:**
- Modify: `src/lib/components/promo/PromoPlayer.svelte`

**Approach:**
- When a window step appears in the sequence, render it inline in the column wrapped in `WindowChrome` + `WindowContent`
- Size: generous width (up to ~90% of column width for images/video, narrower for source code)
- Window chrome is decorative (all dots gray, no maximize behavior)
- Images and videos get subtle drop shadow for depth against the wallpaper
- Scale-in entrance animation via `PromoStep` with `kind='window'`

**Patterns to follow:**
- `src/lib/components/tutorial/DesktopStack.svelte` — how it composes WindowChrome + WindowContent
- Mobile inline window rendering in `TutorialViewer.svelte` (windows rendered inline in the flow)

**Test expectation:** none — visual rendering, verified in dev server

**Verification:**
- Window steps render inline with title bar chrome
- Images display at generous size
- Windows have subtle shadow and scale-in animation

---

## System-Wide Impact

- **Interaction graph:** Purely additive. PromoPlayer consumes `Tutorial` read-only and imports existing leaf components. No callbacks, no middleware, no shared mutable state.
- **Error propagation:** Route returns 404 for unknown slugs, same as preview route. No new error modes.
- **State lifecycle risks:** Timer cleanup on `onDestroy` prevents leaked timeouts. No persistent state.
- **API surface parity:** No API changes. The `duration` field on `StepBase` is optional and ignored by all existing consumers.
- **Unchanged invariants:** TutorialViewer behavior, composition format, tutorial loading pipeline, production build output — all unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Auto-scroll conflicts with entrance animations | Use `scrollIntoView({ behavior: 'smooth' })` with a brief delay after animation starts, not before |
| Timer leaks on rapid navigation or page unmount | Chain `setTimeout` (not `setInterval`), clear on pause/unmount via `onDestroy` |
| `$effect` circularity with timer + visible steps state | Keep timer IDs in plain variables, not `$state` (per institutional learning) |
| Cinematic CSS clashing with global styles | Scope all promo styles within component or use unique class prefixes |

---

## Sources & References

- **Origin document:** [docs/brainstorms/promo-view-requirements.md](docs/brainstorms/promo-view-requirements.md)
- Related pattern: `src/routes/preview/[slug]/` (dev-only route structure)
- Related learning: `docs/solutions/ui-bugs/window-transition-scroll-jank-2026-04-24.md`
- Related learning: `docs/solutions/design-patterns/wysiwyg-trace-editing-via-component-reuse-2026-04-23.md`
- Related learning: `docs/solutions/design-patterns/step-display-category-system-2026-04-23.md`
