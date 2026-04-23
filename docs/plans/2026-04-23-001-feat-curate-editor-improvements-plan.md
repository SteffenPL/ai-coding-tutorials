---
title: "feat: Improve tutorial trace editor with visual upgrades, inline editing, comment blocks, and Claude output styling"
type: feat
status: active
date: 2026-04-23
---

# Improve Tutorial Trace Editor

## Overview

Enhance the `/curate/<slug>` trace editor with five improvements: (1) migrate visual styling improvements from the log view, (2) multi-column compact step layout with radio-select expand, (3) inline editing for more step content with larger controls, (4) comment blocks as first-class visual elements in the trace with inline edit, and (5) backtick rendering in Claude output text to match Claude Code styling.

---

## Problem Frame

The curate editor is functional but visually sparse compared to the log view. Compact steps stack vertically wasting space, editing requires opening a full-screen modal for every change, comments are hidden behind a toolbar badge, and Claude output renders backticks as literal characters instead of styled inline code.

---

## Requirements Trace

- R1. Migrate log view visual improvements (thinking block styling, tool call status icons, assistant final-answer highlight) to the curate step rendering
- R2. Compact steps render in a multi-column flow layout; clicking one expands it (radio-select: only one expanded at a time)
- R3. Inline editing for text content (assistant HTML, tool code, tool result text) directly in the trace panel without opening the modal
- R4. Larger edit controls (toolbar buttons, inline edit areas)
- R5. Comments rendered as distinct visual blocks in the trace (not hidden behind a badge), with inline editing
- R6. Backtick (`\`...\``) text in assistant output rendered with styled inline code, matching Claude Code's visual style

---

## Scope Boundaries

- No changes to the log view itself — only migrating its visual patterns to curate
- No changes to the tutorial viewer (StepRenderer) compact rendering — the multi-column layout is curate-editor-only
- No markdown rendering beyond backtick inline code — full markdown (bold, lists, headers) is out of scope
- No changes to the data model (TraceStep, TraceState) — comment blocks are a UI-only enhancement using the existing `comment` field

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/curate/components/UnifiedTracePanel.svelte` — main trace editor surface
- `src/lib/curate/components/StepEditorModal.svelte` — full-screen modal editor
- `src/lib/curate/components/step-helpers.ts` — step label/icon/preview utilities
- `src/lib/components/tutorial/StepRenderer.svelte` — shared step renderer (WYSIWYG)
- `src/routes/log/[slug]/+page.svelte` — log view with superior visual styling for tool calls, thinking blocks, final answers
- `src/lib/trace/convert.ts` — conversion pipeline (escapes HTML, wraps in `<p>`)

### Institutional Learnings

- WYSIWYG trace editing pattern: use `StepRenderer` identically in editor and viewer; new display flags render in editor for free. Per-step visual concerns belong in `StepRenderer`; structural/grouping concerns belong in the parent panel.

---

## Key Technical Decisions

- **Backtick styling via HTML transformation**: Process backtick-delimited text in `convert.ts` during the `escapeHtml → <p>` wrapping step, converting `` `text` `` to `<code class="inline-code">text</code>`. This ensures both the curate editor and tutorial viewer benefit. The alternative (runtime regex in StepRenderer) would require unsafe `{@html}` on text fields that are currently plain text.
- **Comment blocks as UI-only feature**: Comments are rendered as visible blocks between steps in UnifiedTracePanel using the existing `step.comment` field. No data model changes needed.
- **Inline edit via click-to-edit pattern**: Double-click on a step's text content switches it to an editable textarea in-place. This supplements (not replaces) the modal editor, which remains for complex fields like window steps and file uploads.
- **Multi-column compact via CSS flexbox wrap**: Compact steps in a round get wrapped in a flex container that allows multiple items per row. Expanding one (click) collapses the previously expanded one (radio-select state tracked per round).

---

## Implementation Units

- [ ] U1. **Backtick inline code styling**

**Goal:** Render backtick-delimited text in assistant output as styled inline `<code>` elements matching Claude Code's visual style.

**Requirements:** R6

**Dependencies:** None

**Files:**
- Modify: `src/lib/trace/convert.ts`
- Modify: `src/lib/components/tutorial/StepRenderer.svelte`
- Modify: `src/lib/curate/components/StepEditorModal.svelte`

**Approach:**
- Add a `renderInlineCode(text: string): string` utility that converts `` `text` `` to `<code class="inline-code">text</code>` after HTML escaping but before `<p>` wrapping
- Apply it in `traceStepToTutorialStep()` for assistant HTML content and in the initial `sessionViewToTraceState()` conversion
- Also apply when building preview steps from inserted assistant steps
- Add `.inline-code` CSS in StepRenderer: light background, monospace font, slight padding, distinct color — matching Claude Code's backtick rendering (warm gray background, slightly brighter text)
- Ensure the modal editor's "HTML Content" textarea shows the raw HTML with `<code>` tags so curators can see/edit them

**Patterns to follow:**
- Existing `escapeHtml()` usage in `convert.ts`
- CSS variable usage in StepRenderer for consistent theming

**Test scenarios:**
- Happy path: Assistant text with `` `code` `` renders with styled inline code element
- Happy path: Multiple backticks in one message all render correctly
- Edge case: Nested or escaped backticks (`` \` ``) are handled gracefully
- Edge case: Empty backticks (` `` `) render as empty code element or are left as-is
- Edge case: Multi-line content between backticks (should not match — single backtick is inline only)

**Verification:**
- Assistant text with backtick content shows visually distinct inline code in both the curate preview and the tutorial viewer

---

- [ ] U2. **Migrate log view visual improvements to StepRenderer**

**Goal:** Bring the log view's superior visual treatment of thinking blocks, tool calls, and final answers into StepRenderer so both the curate editor and tutorial viewer benefit.

**Requirements:** R1

**Dependencies:** U1 (inline code CSS must exist)

**Files:**
- Modify: `src/lib/components/tutorial/StepRenderer.svelte`

**Approach:**
- **Thinking blocks**: Add subtle purple background wash (`rgba(122, 69, 104, 0.1)`) matching log view's thinking styling. Already has mauve border — enhance with background.
- **Tool calls**: Add status-suggestive left border color (use `--peach` or similar warm accent instead of current `--border-subtle`). Add subtle background on hover.
- **Final assistant answer**: Strengthen the teal highlight — the log view uses 4px border vs current 3px, and a slightly richer background. Adopt these values.
- **Tool results**: Add very subtle background tint to distinguish from surrounding content.
- Keep changes conservative — these are shared components used by the tutorial viewer too.

**Patterns to follow:**
- Log view's CSS color values for thinking, tool, and final-answer blocks
- Existing StepRenderer CSS architecture (component-scoped styles, CSS variables)

**Test scenarios:**
- Happy path: Thinking blocks show purple-tinted background in curate and tutorial views
- Happy path: Final assistant messages show enhanced teal styling
- Happy path: Tool calls have warm accent border color

**Verification:**
- Visual inspection: curate editor step rendering looks closer to log view quality while maintaining dark terminal aesthetic

---

- [ ] U3. **Multi-column compact step layout with radio-select expand**

**Goal:** Compact steps flow in multiple columns per row. Clicking a compact step expands it to full view (one at a time, radio-select behavior).

**Requirements:** R2

**Dependencies:** U2

**Files:**
- Modify: `src/lib/curate/components/UnifiedTracePanel.svelte`

**Approach:**
- Track `expandedCompactId: string | null` state per the panel (radio-select: only one expanded)
- Group consecutive compact+included steps into a `.compact-flow` flex container with `flex-wrap: wrap`
- Each compact step becomes a clickable chip (~200px min-width, flex-grow) showing icon + summary
- Clicking a compact chip sets `expandedCompactId` to that step's ID (or null if already expanded — toggle)
- The expanded step renders full content below the flow row (breaks out of the flex flow)
- Non-compact steps break the flow container (each gets its own block)
- Style compact chips: small rounded pill, icon + truncated text, hover highlight, selected state with orange accent

**Patterns to follow:**
- Existing `compactSummary()` and `compactIcon()` from StepRenderer
- Step toolbar pattern for hover controls

**Test scenarios:**
- Happy path: Three consecutive compact steps render in a single row as chips
- Happy path: Clicking a compact chip expands it inline, collapsing any previously expanded one
- Happy path: Clicking the expanded chip collapses it back to compact
- Edge case: Single compact step in a sequence still renders as a chip (no visual break)
- Edge case: Mix of compact and full steps creates separate flow groups
- Integration: Expanded compact step shows full StepRenderer output with toolbar

**Verification:**
- Compact steps visually tile in rows, expanding on click with radio-select behavior

---

- [ ] U4. **Comment blocks as first-class visual elements**

**Goal:** Comments appear as distinct, visually prominent blocks in the trace timeline — not hidden behind a toolbar badge. Each comment block is inline-editable.

**Requirements:** R5

**Dependencies:** U2

**Files:**
- Modify: `src/lib/curate/components/UnifiedTracePanel.svelte`

**Approach:**
- After each step that has a `comment`, render a `.comment-block` div below the step render area
- Comment block styling: left border in a distinct color (golden/amber), subtle warm background, slightly smaller font, italic or regular with a small "📝 Comment" label
- Click-to-edit: clicking the comment text switches to a textarea for inline editing. Blur or Enter saves. Escape cancels.
- Empty comment prompt: if a step has no comment, the toolbar's comment button (💬) adds one and immediately opens it for inline editing
- Remove the comment badge from the toolbar; replace with an "add comment" button that only shows when no comment exists
- Comment blocks should be visually distinct from step content — they are tutorial annotations, not Claude output

**Patterns to follow:**
- Existing `step.comment` field and extraction logic in StepEditorModal
- Inline edit pattern: `contenteditable` or bound textarea toggle

**Test scenarios:**
- Happy path: Step with comment shows a visible golden-bordered block below the step
- Happy path: Clicking the comment text opens inline textarea editor
- Happy path: Pressing Escape cancels edit, blur saves
- Happy path: "Add comment" button on toolbar creates empty comment block and focuses it
- Edge case: Bilingual comment (`{ en, ja }`) — inline edit handles EN field, preserves JA

**Verification:**
- Comments are immediately visible when scrolling through the trace, without hovering over any step

---

- [ ] U5. **Inline editing for step content**

**Goal:** Enable click-to-edit for text-heavy step fields directly in the trace panel, reducing reliance on the full-screen modal.

**Requirements:** R3, R4

**Dependencies:** U4 (comment inline edit pattern established)

**Files:**
- Modify: `src/lib/curate/components/UnifiedTracePanel.svelte`
- Modify: `src/lib/curate/components/StepEditorModal.svelte`

**Approach:**
- Track `inlineEditingStep: string | null` state — the ID of the step currently being inline-edited
- Double-click on a step's text content area toggles inline edit mode for that step
- In inline edit mode, replace the StepRenderer output with appropriate edit fields:
  - **Assistant**: textarea for HTML content + final checkbox
  - **Tool call**: tool name input + code textarea
  - **Tool result**: textarea for result text
  - **Output**: textarea for terminal output
  - **Thinking**: textarea for thinking text
- For complex step types (window, permission, question, table), keep the modal as the only edit path
- Inline edit area styling: dark background matching modal edit pane, orange focus border, generous padding
- Save on blur or Ctrl+Enter. Cancel on Escape.
- **Larger controls (R4)**: Increase toolbar button sizes from 0.72rem to 0.85rem, increase padding, increase touch targets to minimum 28px. Inline edit textareas get min-height 100px with comfortable line-height.

**Patterns to follow:**
- Modal's field layout (labels, textarea sizing, bind patterns)
- `bumpPreview` / `previewTick` pattern for forcing re-render after edits

**Test scenarios:**
- Happy path: Double-clicking assistant text opens inline textarea with current content
- Happy path: Editing inline and blurring saves the change, StepRenderer re-renders with new content
- Happy path: Escape cancels without saving
- Happy path: Ctrl+Enter saves and exits inline edit
- Happy path: Modal edit (✎ button) still works for all step types
- Edge case: Double-clicking a window step does NOT open inline edit (opens modal instead)
- Edge case: Source-derived steps save to `shortenedText`, inserted steps save to `inserted` fields directly

**Verification:**
- Text content in assistant, tool_call, tool_result, output, and thinking steps can be edited inline without opening the modal

---

## System-Wide Impact

- **Interaction graph:** StepRenderer changes (U1, U2) affect both the curate editor preview and the tutorial viewer at `/tutorials/<slug>`. Changes must be conservative to avoid visual regressions in the published tutorials.
- **Unchanged invariants:** The `TraceState` data model, `traceStepToTutorialStep()` conversion contract, and server API routes are not modified. The compose pipeline and tutorial export remain unchanged.
- **Integration coverage:** Inline code rendering (U1) must be verified in both the curate preview and a published tutorial page.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| StepRenderer visual changes affect published tutorials | Keep changes additive (backgrounds, border colors) not structural. Visual-test before/after on existing tutorials. |
| Inline edit state complexity with radio-select expand | Keep state simple: one `expandedCompactId` and one `inlineEditingStep` per panel, both nullable. |
| Backtick regex edge cases (code blocks, escaped backticks) | Use a conservative regex that only matches single backticks with no newlines inside. Skip content already inside HTML tags. |

---

## Sources & References

- Related code: `src/routes/log/[slug]/+page.svelte` (visual reference for styling)
- Related code: `src/lib/curate/components/UnifiedTracePanel.svelte` (primary modification target)
- Related learning: `docs/solutions/design-patterns/wysiwyg-trace-editing-via-component-reuse-2026-04-23.md`
