# AI Coding Tutorials

Interactive tutorial site for AI-assisted research workflows. Renders curated Claude Code + MCP sessions as explorable, step-by-step webpages with a virtual desktop experience.

Live site: https://steffenpl.github.io/ai-coding-tutorials/

## Tech stack

- **SvelteKit 2** + Svelte 5 (runes mode) + TypeScript
- **Static adapter** — builds to `build/` as pure HTML/JS/CSS
- **No markdown** — tutorial content is structured YAML data (`src/tutorials/<slug>/`)
- **Single dark theme** — aubergine + orange palette, no light/dark toggle

## Tutorial data system

Each tutorial is a YAML folder in `src/tutorials/<slug>/`. Tutorials are organized into **rounds** (one per user prompt), each containing an ordered list of steps:

```ts
export const myTutorial: Tutorial = {
  meta: { slug, title: { en, ja? }, tags, thumbnail? },
  welcome?: { heading, description, learnings },
  rounds: [
    {
      kind?: 'claude' | 'terminal',  // default: 'claude'
      prompt: "User message (claude) or shell command (terminal)",
      steps: [ /* ... */ ]
    }
  ]
};
```

### Round kinds

- **`'claude'`** (default) — AI session. Prompt styled with `›` chevron + orange bar. Steps: assistant, thinking, question, tool_call, tool_result, permission, etc.
- **`'terminal'`** — Shell session. Prompt styled with `$` + green chevron + monospace. Steps: output, status, window, etc.

### Terminal-side step types

| type | fields | renders as |
|------|--------|------------|
| `assistant` | `html`, `final?` | Claude message (teal bar when final) |
| `thinking` | `text`, `duration?` | Collapsible reasoning block (mauve) |
| `question` | `html`, `answer` | Q&A: Claude asks, pre-selected answer |
| `tool_call` | `toolName`, `code` | Tool invocation with code block |
| `tool_result` | `text` | Tool output text |
| `permission` | `tool`, `description`, `granted` | Permission dialog with response |
| `output` | `text`, `stream?` | Terminal output (stderr = red) |
| `status` | `text`, `variant?` | Compact badge (success/info/warning/error) |
| `table` | `columns`, `rows`, `moreRows?` | Data table |
| `divider` | `label` | Visual separator (optional — window steps already render their own separator-like marker) |

All step types inherit `comment?` (tutorial stop annotation), `compact?` (render as one-line summary instead of full content), and `hidden?` (collapsed "N steps hidden" placeholder in simplified view, shown normally in full log) from `StepBase`.

### Window content types (`WindowContentData`)

Each `type: 'window'` step wraps a `content` discriminated union (`content.kind`):

| kind | fields | renders as |
|------|--------|------------|
| `fiji-image` | `src`, `statusBar?` | Image + Fiji status bar |
| `image` | `src` | Plain image |
| `markdown` | `text` | Rendered markdown with scroll |
| `source` | `text`, `language?` | Source code with line numbers |
| `folder` | `entries: FolderEntry[]` | Tree view of files/folders |
| `video` | `src`, `poster?` | Looping muted video |
| `window-collection` | `rows`, `cols`, `windows: {title, subtitle?, content}[]` | Chromeless grid of sub-windows with own title bars |

View components live in `src/lib/components/windows/`. The dispatcher is `WindowContent.svelte`. To add a new window type: add a content interface to `tutorials.ts`, create a `*View.svelte` component, add a branch in `WindowContent.svelte`.

Shared window infrastructure:
- **`WindowChrome.svelte`** — single source of truth for the title bar (icon, title, subtitle, traffic-light dots). Close + minimize are always decorative (grayed). Maximize is the only live dot — passing `onMaximize`/`onRestore` activates it.
- **`ZoomableView.svelte`** — wraps media (image/video/Fiji) with Ctrl/Cmd+wheel zoom, click-drag pan when zoomed, and floating `− % +` controls (always visible on mobile). No pinch-zoom.

### Simplified vs Full Log

Each tutorial has `rounds` (simplified/curated, shown by default) and optionally `fullRounds` (the unabridged real trace). Both are independent `TutorialRound[]` arrays — they share assets (images) but can have completely different step structures.

When `fullRounds` is present:
- **Welcome overlay** shows two buttons: "Start Tutorial" (simplified) + "Full Log"
- **Settings popover** gets a "Log" toggle above the "Detail Level" pills
- Switching modes resets the timeline to the beginning

Steps with a `comment` field are **tutorial stops** — the curated waypoints used for the "Tutorial" detail level and the hierarchical counter. Register new tutorials in `src/lib/data/tutorials.ts`.

## Trace viewer

The trace viewer at `/tutorials/[slug]` renders as a virtual desktop. The rendering logic lives in `TutorialViewer.svelte` (shared by both the tutorial page and the preview page):

### Layout
- **Nav bar**: reuses the site `<Nav>` with back arrow, logo, and tutorial title
- **Left: Terminal window** — scrollable chat. Each round is wrapped in a `.round-block`; its prompt is `position: sticky; top: 0` **within its own round-block**, so prompt *N* releases when round *N* scrolls out (prevents shorter prompts overlapping taller ones).
  - For `type: 'window'` steps, the terminal shows a compact text marker (title + subtitle, tool_call-styled). Clicking it maximizes that window. Gives consecutive window steps individual scroll footprints.
- **Right: Desktop windows** — cascade stack (`stack-0` through `stack-3`), renders any window content type. Clicking the maximize dot (or the terminal marker) expands the window to fill the workspace with a 60% dim backdrop; Esc or clicking the backdrop restores. Terminal is intentionally not maximizable (keeps scroll-driven timeline stable).
- **Below right: Tutorial + Controls** — comment panel + playback controls
- **Bottom taskbar**: clickable window indicators (jump to that step)
- **Welcome overlay**: optional intro shown before playback, dismissed on click/wheel

### Scroll-driven timeline
- **All content visible from the start** — no reveal/hide mechanism. A top spacer (sized to `viewportHeight − firstPromptHeight − margin`) pushes the first prompt to the bottom of the viewport initially; a matching bottom spacer allows the last step to scroll to the viewport bottom.
- **`currentStep` = last step whose bottom edge is at or above the viewport bottom** — pure native scroll, no wheel interception or accumulator.
- **`showUpTo(step)`** scrolls so the target step's bottom edge aligns with the viewport bottom.

### Navigation
- **Three detail levels** (via settings gear icon):
  - **Steps**: every individual step
  - **Tutorial** (default): jump between comment-bearing steps
  - **Round**: jump between user prompts
- **Counter**: shows `R.T` (round.tutorial-stop-within-round)
- **Keyboard**: Arrow keys for prev/next, `p` for play/pause, `Esc` to restore a maximized window
- **Level switching**: snaps to the nearest completed boundary at the new granularity

### Mobile (<=900px)
- Page-level scrolling (spacers hidden via CSS)
- Sticky tutorial panel (comment + controls) floats at the bottom — `position: sticky; bottom: 0`
- Inline windows with full window chrome (title bar, close/min/max dots, content-specific rendering)
- Round prompts shown inline in regular document flow

## Visual design

- **Palette**: aubergine `#2C001E` + orange `#E95420`, CSS variables in `global.css`
- **Wallpaper**: 8-layer radial gradient mesh with `blur(40px) saturate(1.35)`
- **Window chrome**: warm grey-purple title bars. Close + minimize dots are decorative (gray); the green maximize dot is the only live affordance (see `WindowChrome.svelte`).
- **Typography**: JetBrains Mono (terminal/code), Cantarell (UI chrome)
- **Panels**: frosted glass (`backdrop-filter: blur`) for nav, taskbar, controls
- **Prompt style**: Claude Code-style `›` chevron, orange right-bar + warm background tint
- **Chat hierarchy**: prompts (orange right-bar), final answers (`final: true`, teal left-bar), regular assistant messages (plain), tool calls/results (subtle left-bar, uniform text color throughout)

## Edit dashboard

Dev-only hub at `/edit` for managing the full pipeline. Four panels + trash:

- **Sessions** — imported Claude Code session logs. Import from JSONL path, view at `/log/<slug>`, create traces.
- **Traces** — curated trace states. Edit at `/curate/<slug>`.
- **Tutorials** — compositions. Compose at `/compose/<slug>`, preview at `/preview/<slug>`.
- **Assets** — browsable inventory of all assets (shared + per-tutorial). Thumbnails in a flex grid, click-to-copy YAML reference. Upload shared assets directly.
- **Trash** — collapsible section. Delete moves items to `.trash/` instead of removing. Per-item restore or permanent delete, plus "Empty All".

Deleting a session or trace shows a warning if referenced by downstream resources (traces reference sessions, tutorials reference traces via composition blocks).

### Server routes (dev-only)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/edit/dashboard` | GET | List sessions, traces, tutorials |
| `/api/edit/delete` | POST | Move item to `.trash/` |
| `/api/edit/trash` | GET | List trashed items |
| `/api/edit/trash` | POST | Restore or permanently delete one item |
| `/api/edit/trash` | DELETE | Empty all trash |

## Asset system

### Storage

| Location | Scope | Served at |
|----------|-------|-----------|
| `static/assets/<file>` | Shared across all tutorials | `/assets/<file>` |
| `static/tutorials/<slug>/assets/<file>` | Per-tutorial | `/tutorials/<slug>/assets/<file>` |

### Reference convention in YAML

- **Bare filename** (`step_001.png`) → per-tutorial, rewritten to `tutorials/<slug>/assets/step_001.png`
- **`shared/` prefix** (`shared/fiji-logo.png`) → shared, rewritten to `assets/fiji-logo.png`
- **Path with `/`** (not `shared/`) or URL → passed through unchanged

Asset path rewriting is handled by `rewriteAssetPath()` in `src/lib/compose/resolve.ts`, imported by both the compose and trace preview endpoints.

### Upload endpoints (dev-only)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/assets` | GET | List all shared + per-tutorial assets |
| `/api/assets/upload` | POST | Upload to `static/assets/` (shared) |
| `/api/compose/[slug]/upload` | POST | Upload to per-tutorial or shared (via `target` field) |

## Composition pipeline

The composition tool at `/compose/<slug>` assembles tutorials from trace blocks and hand-authored rounds.

### Pipeline

```
Traces (src/traces/<slug>/trace.json)
    → /compose/<slug> UI → TutorialComposition (composition.json)
    → Preview (in-memory) or Export (round-NN.yaml + meta.yaml)
```

### Key files

- `src/lib/compose/types.ts` — TutorialComposition, TraceBlock, HandAuthoredBlock
- `src/lib/compose/resolve.ts` — resolves composition → Tutorial (asset rewriting, trace loading)
- `src/lib/compose/preview-store.ts` — in-memory preview store
- `src/routes/compose/[slug]/+page.svelte` — composition editor
- `src/routes/api/compose/[slug]/` — dev-only server routes

## Curation tool

Interactive dev-only UI at `/curate/<slug>` for producing traces from session logs. Requires the session to be imported first (see session log pipeline).

### Pipeline

```
Session JSONL → import (via /edit or script) → filtered JSONL in src/sessions/
    → /curate/<slug> UI → TraceState (src/traces/<slug>/trace.json)
    → consumed as a source in compositions (/compose/<slug>)
```

Tutorial YAML (`round-NN.yaml` + `meta.yaml`) is written by the compose step, not by curate.

### Server routes (dev-only, stripped by static adapter)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/traces/[slug]` | GET | Load TraceState from `src/traces/<slug>/trace.json` |
| `/api/traces/[slug]` | POST | Save TraceState to `trace.json` |
| `/api/traces/[slug]` | DELETE | Remove the trace file |
| `/api/traces/[slug]/preview` | POST | Convert TraceState → Tutorial in-memory for preview |
| `/api/traces/[slug]/preview` | GET | Retrieve stored preview Tutorial |
| `/api/compose/[slug]/upload` | POST | Save asset to `static/tutorials/<slug>/assets/` |

### Key files

- `src/lib/trace/types.ts` — TraceState, TraceStep, TraceRound (persisted as `trace.json`)
- `src/lib/trace/convert.ts` — SessionView ↔ TraceState ↔ TutorialRound[]
- `src/lib/trace/preview-store.ts` — in-memory preview Tutorial store (server-side Map)
- `src/lib/curate/components/` — UnifiedTracePanel, StepEditorModal, step-helpers (curate UI)
- `src/routes/curate/[slug]/+page.svelte` — curation UI entry
- `src/routes/preview/[slug]/` — preview route (reuses TutorialViewer)
- `src/routes/api/traces/[slug]/` — trace persistence + preview endpoints

## i18n

Bilingual EN/JA with English fallback. Use `t({ en: '...', ja?: '...' })` from `$lib/stores/lang.svelte`.

## Documented solutions

`docs/solutions/` — documented solutions to past problems and design decisions (bugs, patterns, conventions, workflow learnings), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas.

## Tutorial creation (CLI workflow for agents)

```
Session JSONL → inspect → spec YAML → generate → tutorial folder
```

| Script | Purpose |
|--------|---------|
| `scripts/import-session.ts` | Filter raw Claude Code JSONL → `src/sessions/<slug>/` |
| `scripts/session-to-tutorial.ts inspect` | Print session structure as JSON (rounds, steps, types) |
| `scripts/session-to-tutorial.ts generate` | Spec YAML → `meta.yaml` + `tutorial/` + `full-log/` + assets |

Spec files live in `specs/<slug>.yaml`. Full format and workflow documented in `scripts/TUTORIAL-WORKFLOW.md`.

## Development & deployment

```bash
npm install
npm run dev          # dev server at localhost:5173
npm run build        # production build to build/
./deploy.sh          # build + push to gh-pages branch
```

Target repo: `steffenpl/ai-coding-tutorials` (GitHub Pages from `gh-pages` branch).
