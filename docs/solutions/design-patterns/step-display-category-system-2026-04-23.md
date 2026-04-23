---
title: Step Display Category System — Three Modes with Type-Based Defaults
date: 2026-04-23
category: design-patterns
module: tutorial-rendering
problem_type: design_pattern
component: frontend_stimulus
severity: medium
applies_when:
  - Adding new step types to the tutorial system
  - Changing default display behavior for existing step types
  - Building new views that render Step data (trace editor, tutorial viewer, log viewer)
  - Curating traces and choosing which steps to show/hide/compact
tags:
  - step-rendering
  - compact-chips
  - display-modes
  - trace-editor
  - tutorial-viewer
  - step-categories
  - component-sharing
---

# Step Display Category System — Three Modes with Type-Based Defaults

## Context

The tutorial viewer renders AI coding sessions as interactive walkthroughs. Each session contains dozens of steps (tool calls, tool results, thinking blocks, assistant messages, windows, etc.). Without a principled default system, every step rendered at full size — making traces overwhelming. Curators had to manually toggle each step's display mode, which was tedious for 50+ step traces.

The core tension: tool machinery (ToolSearch, get_thumbnail, run_ij_macro calls and their results) is important for the full log but noise in the curated tutorial. Readers care about what Claude *said* and the visual *results*, not every intermediate invocation.

## Guidance

### The Category System

Every step type belongs to one of three categories, each with a default display mode. The mapping lives in `src/lib/components/tutorial/step-colors.ts` as a single source of truth:

```typescript
// step-colors.ts — each entry has category + defaultMode
export const stepTypeColors: Record<StepType, StepTypeStyle> = {
  // Primary — the conversation itself (default: full)
  assistant:   { ..., category: 'primary',    defaultMode: 'full' },
  question:    { ..., category: 'primary',    defaultMode: 'full' },
  output:      { ..., category: 'primary',    defaultMode: 'full' },
  // Supporting — tool machinery (default: compact)
  tool_call:   { ..., category: 'supporting', defaultMode: 'compact' },
  tool_result: { ..., category: 'supporting', defaultMode: 'compact' },
  thinking:    { ..., category: 'supporting', defaultMode: 'compact' },
  status:      { ..., category: 'supporting', defaultMode: 'compact' },
  permission:  { ..., category: 'supporting', defaultMode: 'compact' },
  // Structural — visual structure and data (default: normal)
  window:      { ..., category: 'structural', defaultMode: 'normal' },
  table:       { ..., category: 'structural', defaultMode: 'normal' },
  divider:     { ..., category: 'structural', defaultMode: 'normal' },
};
```

### Three Display Modes

| Mode | Rendering | Use case |
|------|-----------|----------|
| **compact** | Type-colored chip/badge in `CompactChipFlow` | Machinery steps — acknowledge but don't show |
| **normal** | Content visible but long blocks folded at 5 lines | Structural content, or promoted tool steps |
| **full** | Everything expanded, no truncation | Primary conversation content |

### Key Components

- **`step-colors.ts`** — single source of truth for type → accent color, icon, label, category, default mode
- **`CompactChipFlow.svelte`** — groups consecutive compact steps as type-colored pills; collapses runs >5 into "N actions" summary
- **`StepRenderer.svelte`** — renders individual steps; handles compact badge, normal (folded), and full modes; JSON-aware tool call/result rendering
- **`TerminalTranscript.svelte`** — groups steps into compact/hidden/regular flows for the tutorial viewer
- **`UnifiedTracePanel.svelte`** — trace editor with "Combine" toggle, category labels, and 3-mode cycling

### Trace Editor Features

- **Category labels** on each step toolbar: "Primary" (teal), "Tools" (peach), "Windows" (green)
- **Override indicator**: mode button turns orange when step differs from its category default
- **3-mode cycle**: compact → normal → full → compact
- **"Combine" toggle** (off by default): when off, compact steps render as individual rows with edit toolbars; when on, they group into chip flows
- Grouping respects "Show excluded" toggle — excluded steps are filtered before grouping, so `[Compact, Compact, Excluded, Compact]` becomes one combined group of 3 when excluded steps are hidden

### Tool Call/Result JSON Rendering

Tool calls with JSON code are parsed and rendered structurally:
- First key's value becomes a subtitle next to the tool name
- Short values render as inline key-value pairs
- Long/multiline string values render as monospace code blocks, auto-folded at 5 lines
- Tool results filter out null/empty JSON values for cleaner display

### Assistant Message Rich Text

The `renderInlineCode` function in `convert.ts` processes raw session text:
- Backtick code → `<code class="inline-code">` (pill-styled)
- Decorative separators (lines with `★` or `─────`) → `<code class="decorative-rule">` (block-level, mauve)
- `\n\n` → paragraph breaks, `\n` → `<br>`

The `formatAssistantHtml` function in `StepRenderer.svelte` applies the same newline processing at render time for existing content that wasn't processed during import.

## Why This Matters

Without category defaults, curators spend time manually toggling 30+ tool calls to compact in every trace. With the system, new traces arrive pre-configured — tool machinery compacted, conversation content visible, structural elements in normal mode. The curator only overrides the few steps that are pedagogically interesting.

The "N actions" collapse in the tutorial viewer prevents walls of 30 tool-call chips that obscure the actual content. Readers see "8 actions (3 tool calls, 3 results, 2 Read)" and can expand if curious.

## When to Apply

- **Adding a new step type**: Add one entry to `stepTypeColors` with the appropriate category and default mode. No other changes needed — the rendering, grouping, and trace creation all derive from this map.
- **Changing default behavior**: Modify the `defaultMode` in `stepTypeColors`. Existing traces keep their saved `displayMode` values; only new traces get the updated default.
- **Building a new view**: Import `getStepStyle`, `getCategory`, `getDefaultMode` from `step-colors.ts`. The `CompactChipFlow` component can be reused for any view that needs chip rendering.

## Examples

### Adding a new step type

```typescript
// In step-colors.ts — one entry handles everything
export const stepTypeColors = {
  // ...existing types...
  annotation: { accent: 'var(--teal)', icon: '📝', label: 'annotation',
                category: 'structural', defaultMode: 'normal' },
};
```

### Overriding a step's default in the trace editor

The curator clicks the mode button (▪/▨/▣) to cycle through compact → normal → full. The button turns orange to indicate the step differs from its category default. The override is stored in `TraceStep.displayMode` in `trace.json`.

## Related

- Requirements doc: `docs/brainstorms/step-display-categories-requirements.md`
- Previous requirements: `docs/brainstorms/shared-step-rendering-requirements.md`
- Step types defined in: `src/lib/data/tutorials.ts`
- Trace types defined in: `src/lib/trace/types.ts`
