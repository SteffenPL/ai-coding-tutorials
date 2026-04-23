# Session → Trace → Tutorial Pipeline

**Date:** 2026-04-22
**Status:** Approved

## Problem

The curation tool conflates two concerns: cleaning up a raw session log (curation) and composing a tutorial from multiple sources with metadata (authoring). Tutorials don't always originate from a single session — some combine content from multiple sessions or include entirely hand-authored steps.

## Design decisions

| Decision | Choice |
|----------|--------|
| Pipeline | session → trace → tutorial |
| Trace artifact | `trace.json` (TraceState), no intermediate YAML |
| Tutorial artifact | `composition.json` (TutorialComposition), resolved at preview/export |
| Reference model | Live references — traces resolved at build time |
| Block granularity | Whole traces (chapter-level), not step-level interleaving |
| Hand-authored content | First-class blocks in the composition |
| Directory layout | `src/sessions/`, `src/traces/`, `src/tutorials/` |
| Dev UI | Unified `/edit` dashboard with import/create actions |
| Export | Triggered from `/compose`, writes same `round-NN.yaml` + `meta.yaml` |
| Migration | Script converts existing tutorials to compositions, moves session files |

## Directory structure

```
src/
├── sessions/
│   └── <slug>/
│       └── <uuid>.jsonl           # raw imported session JSONL
│
├── traces/
│   └── <slug>/
│       └── trace.json             # TraceState (the curated artifact)
│
├── tutorials/
│   └── <slug>/
│       ├── composition.json       # TutorialComposition (authoring state)
│       ├── tutorial/
│       │   └── round-NN.yaml      # exported flat YAML (production)
│       ├── meta.yaml              # exported meta (production)
│       └── assets/                # images, videos
```

## Data model

### TraceState (replaces CurationState)

Lives at `src/traces/<slug>/trace.json`. Purely about log curation — no tutorial metadata.

```ts
// src/lib/trace/types.ts

interface TraceState {
  sessionSlug: string;
  title?: string;          // human label for the dashboard
  rounds: TraceRound[];
}

interface TraceRound {
  id: string;
  kind: 'claude' | 'terminal';
  prompt: string;
  sourceRoundIndex?: number;
  steps: TraceStep[];
}

interface TraceStep {
  id: string;
  sourceRef?: TraceStepRef;
  included: boolean;
  displayMode: DisplayMode;
  shortenedText?: string;
  comment?: string | { en: string; ja?: string };
  overrides?: Record<string, unknown>;
  inserted?: Step;
}

interface TraceStepRef {
  roundIndex: number;
  nodeIndex: number;
}

type DisplayMode = 'compact' | 'full';
```

### TutorialComposition

Lives at `src/tutorials/<slug>/composition.json`. The authoring state for a tutorial.

```ts
// src/lib/compose/types.ts

interface TutorialComposition {
  slug: string;
  meta: TutorialMeta;
  welcome?: TutorialWelcome;
  briefing?: { en: string; ja?: string };
  blocks: CompositionBlock[];
}

type CompositionBlock =
  | TraceBlock
  | HandAuthoredBlock;

interface TraceBlock {
  kind: 'trace';
  sourceSlug: string;        // references src/traces/<slug>/
  rounds?: number[];         // optional subset (0-based), omit = all
}

interface HandAuthoredBlock {
  kind: 'round';
  round: TutorialRound;
}
```

### Rename summary

| Old | New |
|-----|-----|
| `CurationState` | `TraceState` |
| `CurationStep` | `TraceStep` |
| `CurationStepRef` | `TraceStepRef` |
| `CurationRound` | `TraceRound` |
| `CurationMeta` | removed (meta lives in TutorialComposition) |
| `CurationWelcome` | removed (welcome lives in TutorialComposition) |
| `DisplayMode` | `DisplayMode` (unchanged) |
| `curation.json` | `trace.json` |
| `src/lib/curate/` | `src/lib/trace/` |
| `sessionViewToCurationState()` | `sessionViewToTraceState()` |
| `curationStepToTutorialStep()` | `traceStepToTutorialStep()` |
| `curationStateToTutorialRounds()` | `traceStateToTutorialRounds()` |
| `curationStateToMeta()` | removed (meta comes from composition) |
| `curationStateToWelcome()` | removed (welcome comes from composition) |

## Resolution pipeline

When previewing or exporting a tutorial, `composition.json` is resolved into a `Tutorial` object:

```
composition.json
  │
  │  For each block:
  │    'trace'  → load src/traces/<slug>/trace.json
  │             → traceStateToTutorialRounds()
  │             → optionally filter by rounds[]
  │    'round'  → use TutorialRound directly
  │
  ▼
Tutorial { meta, welcome, briefing, rounds: [...all resolved rounds] }
```

Resolution logic lives in `src/lib/compose/resolve.ts` as a pure function: `(TutorialComposition, traceLoader) → Tutorial`.

Export writes the resolved Tutorial as `round-NN.yaml` + `meta.yaml` to `src/tutorials/<slug>/tutorial/` — same format as today.

### Staleness detection

The compose UI compares `mtime` of each referenced `trace.json` against the tutorial's `round-01.yaml`. If any trace is newer, a subtle "Export outdated" indicator is shown. No automatic re-export.

## Routes

### Pages

| Route | Purpose | Status |
|-------|---------|--------|
| `/edit` | Dashboard — lists sessions, traces, tutorials | New |
| `/edit/import` | Import session dialog | New |
| `/log/<slug>` | View raw session log (read-only) | Unchanged |
| `/curate/<slug>` | Curate a session into a trace | Modified (loses metadata section) |
| `/compose/<slug>` | Tutorial composition editor | New |
| `/preview/<slug>` | Preview rendered tutorial | Unchanged |

Nav: the dev-only "Logs" link becomes "Edit", pointing to `/edit`.

### API routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/traces/[slug]` | GET/POST | Load/save trace.json |
| `/api/traces/[slug]/preview` | GET/POST | Preview trace as tutorial |
| `/api/compose/[slug]` | GET/POST | Load/save composition.json |
| `/api/compose/[slug]/export` | POST | Resolve + write round-NN.yaml + meta.yaml |
| `/api/compose/[slug]/preview` | POST/GET | Resolve + store preview Tutorial |
| `/api/compose/[slug]/upload` | POST | Upload asset to static/tutorials/<slug>/assets/ |
| `/api/sessions/import` | POST | Import raw session JSONL |
| `/api/edit/dashboard` | GET | List all sessions, traces, tutorials |

Existing `/api/curate/` routes renamed to `/api/traces/`. Export endpoint moves to `/api/compose/`. Assets are uploaded via compose (they belong to the tutorial, not the trace).

## Dev UI

### `/edit` dashboard

Three stacked sections:

**Sessions** (header: "Import Session" button)
- Lists all `src/sessions/<slug>/` directories
- Actions: View (→ `/log/<slug>`), Create Trace (initializes trace.json, opens `/curate/<slug>`)

**Traces** (lists all `src/traces/<slug>/trace.json`)
- Shows: slug, title, source session, round count
- Actions: Edit (→ `/curate/<slug>`), Preview

**Tutorials** (header: "New Tutorial" button)
- Shows: slug, title, block count, export date
- Actions: Compose (→ `/compose/<slug>`), Preview

### `/compose/<slug>` page

- **Metadata section** (top) — title, tags, thumbnail, welcome, briefing
- **Blocks list** (main) — ordered composition blocks:
  - Trace blocks: slug, round count, link to edit trace, expandable round preview
  - Hand-authored blocks: inline round editor (prompt + steps)
- **Block actions**: reorder, remove, insert between
- **Add block**: "Add Trace" (pick from available traces) + "Add Round" (new hand-authored)
- **Toolbar**: Save, Export YAML, Preview

### `/curate/<slug>` page (modified)

- Loses metadata section (title, tags, welcome, briefing — now in compose)
- Gains a simple title field (human label for the trace)
- Saves to `src/traces/<slug>/trace.json`
- No export button (export is on the compose side)
- Preview button stays (previews the trace as a standalone tutorial)

## What stays unchanged

- **Static site loader** — reads `round-NN.yaml` + `meta.yaml` from `src/tutorials/<slug>/`
- **TutorialViewer.svelte** — renders a `Tutorial` object regardless of source
- **Tutorial type system** (`Tutorial`, `TutorialRound`, `Step`, all step types)
- **`/log/<slug>` page** — read-only session viewer
- **Step editing UI** — EditDrawer and step manipulation reused in both curate and compose

## Migration

### Existing state

| Slug | Has session? | Has curation.json? | Has tutorial YAML? |
|------|-------------|--------------------|--------------------|
| `nuclei-segmentation` | No | No | Yes (3 rounds + full-log) |
| `blob-segmentation` | No | No | Yes (1 round) |
| `install-claude-code` | Yes | No | No |
| `update-claude-md-docs` | Yes | No | No |
| `scroll-bug-demo` | Yes | No | No |
| `test-showcase` | ? | No | ? |

### Strategy

**Tutorials with YAML but no session** (nuclei-segmentation, blob-segmentation):
- Parse existing `round-NN.yaml` files into `HandAuthoredBlock`s
- Move meta/welcome/briefing from `meta.yaml` into `composition.json`
- Keep `round-NN.yaml` + `meta.yaml` as production export (unchanged on disk)

**Tutorials with sessions but no YAML** (install-claude-code, etc.):
- Move `session/` to `src/sessions/<slug>/`
- No trace or composition created — appear in dashboard under Sessions

**Migration script** (`scripts/migrate-to-traces.ts`):
- Automates file moves and composition.json creation
- Run once, verify, commit, delete
