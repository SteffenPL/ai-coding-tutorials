# Folder-Based Tutorial System

## Problem

Tutorials are currently hand-authored as large TypeScript objects (~400 lines each). This makes it hard to:
- Derive tutorials from real Claude Code session traces
- Let agents help curate and annotate tutorials
- Navigate or edit individual rounds without scrolling through one huge file
- Keep raw session data alongside the curated output

## Solution

Replace TypeScript tutorial objects with self-contained tutorial folders. Each folder holds raw session data, machine-generated full logs (YAML, one file per round), agent-curated tutorial rounds (YAML, same format), and shared assets.

A three-stage pipeline produces tutorials:

1. **Merge script** (one-time CLI) — parses JSONL session + MCP traces into per-round YAML files and extracts assets
2. **Curation** (interactive) — user edits YAML directly and/or writes informal notes for an agent to produce the simplified tutorial
3. **Build** (Vite, automatic) — reads YAML files via `import.meta.glob`, assembles `Tutorial` objects, serves assets

---

## Folder Structure

Each tutorial lives in `src/tutorials/<slug>/`:

```
src/tutorials/nuclei-segmentation/
├── meta.yaml                     # title, tags, thumbnail, welcome
├── session/                      # raw Claude Code JSONL (archived, not parsed at build)
│   └── 01c5db56-87a6-4b2f.jsonl
├── traces/                       # extra collected data (Fiji MCP logs, images, etc.)
│   └── fiji-events.json
├── full-log/                     # machine-generated from merge script
│   ├── round-01.yaml
│   ├── round-02.yaml
│   └── round-03.yaml
├── tutorial/                     # curated simplified tutorial
│   ├── round-01.yaml
│   └── round-02.yaml
└── notes.md                      # informal user notes for agent curation

static/tutorials/nuclei-segmentation/
└── assets/                       # images, videos — extracted by merge script
    ├── step_001_nuclei.png
    ├── step_002_nuclei-mask.png
    └── step_003_nuclei.png
```

**Assets** live in `static/tutorials/<slug>/assets/` — separate from `src/tutorials/` because Vite serves `static/` as-is with no processing. The merge script writes extracted images there directly. YAML files reference assets by filename only (e.g. `step_001_nuclei.png`); the build-time loader prepends the public path `/tutorials/<slug>/assets/`.

**`session/` and `traces/`** are input-only. They are not read at build time and do not ship in the production bundle. They stay in the repo for reproducibility. Note: `traces/` may contain images that duplicate what's in `assets/` — this is intentional for simplicity.

---

## YAML Format

### `meta.yaml`

```yaml
slug: nuclei-segmentation
title:
  en: "Nuclei Segmentation with Fiji"
  ja: "Fijiによる細胞核セグメンテーション"
tags: [fiji, segmentation, bioimage]
thumbnail: step_001_nuclei.png    # filename in assets/

welcome:
  heading:
    en: "Nuclei Segmentation with Fiji"
    ja: "Fijiによる細胞核セグメンテーション"
  description:
    en: >
      Watch Claude Code drive Fiji through a complete nuclei segmentation
      pipeline — from opening an image to counting cells and overlaying outlines.
    ja: >
      Claude CodeがFijiを操作して核セグメンテーションパイプライン全体を
      実行する様子をご覧ください。
  learnings:
    - en: "How AI agents interact with desktop applications via MCP"
      ja: "AIエージェントがMCPを介してデスクトップアプリと対話する方法"
    - en: "A classic threshold → watershed → particle analysis pipeline"
    - en: "Using ImageJ macro language from an AI coding assistant"
```

### Round files (`full-log/round-NN.yaml` and `tutorial/round-NN.yaml`)

Both use the same schema. Tutorial rounds add `comment` fields and trim uninteresting steps.

```yaml
kind: claude                  # or "terminal" — default: claude
prompt: "Open the nuclei.tif image in Fiji and tell me about it."
cwd: ~/workspace/demo         # optional, shown for terminal rounds

steps:
  - type: thinking
    text: |
      The user wants me to open nuclei.tif in Fiji. I should use the
      fiji-mcp bridge to run an ImageJ macro that opens the file.
    duration: "3s"

  - type: assistant
    html: "<p>I'll open the image in Fiji and take a look at it for you.</p>"
    comment: >
      Claude starts by opening the requested image. The <strong>fiji-mcp</strong>
      bridge auto-launches Fiji on the first tool call.

  - type: permission
    tool: "fiji — run_ij_macro"
    description: 'open("/Users/steffen/demo/nuclei.tif")'
    granted: true

  - type: tool_call
    toolName: "fiji — run_ij_macro"
    code: |
      open("/Users/steffen/demo/nuclei.tif");
    comment: >
      The first Fiji macro call simply opens the image file.

  - type: tool_result
    text: "✓ completed in 83ms — active image: nuclei.tif"

  - type: window
    windowTitle: "nuclei.tif"
    subtitle: "512×512 8-bit"
    content:
      kind: fiji-image
      src: step_001_nuclei.png
      statusBar: "512×512 pixels; 8-bit; 256K"

  - type: assistant
    final: true
    html: >
      <p>The image is loaded. It's a <strong>512×512 pixel, 8-bit
      grayscale</strong> fluorescence microscopy image.</p>

  - type: table
    columns: ["#", "Area", "X", "Y", "Circ."]
    rows:
      - ["1", "243", "216.0", "54.1", "0.88"]
      - ["2", "1360", "237.3", "72.0", "0.86"]
    moreRows: 20

  - type: status
    text: "✓ fiji-mcp bridge ready"
    variant: success

  - type: output
    text: |
      ┌  Claude Code v1.0.25
      │  ✧ Model: claude-opus-4-6
      └  Type your prompt or /help
    stream: stdout

  - type: divider
    label: "Phase 2"
```

### Step type reference

All step types map 1:1 to the existing TypeScript interfaces:

| YAML type | fields | maps to |
|-----------|--------|---------|
| `assistant` | `html`, `final?` | `AssistantStep` |
| `thinking` | `text`, `duration?` | `ThinkingStep` |
| `question` | `html`, `answer` | `QuestionStep` |
| `tool_call` | `toolName`, `code` | `ToolCallStep` |
| `tool_result` | `text` | `ToolResultStep` |
| `permission` | `tool`, `description`, `granted` | `PermissionStep` |
| `output` | `text`, `stream?` | `OutputStep` |
| `window` | `windowTitle`, `subtitle?`, `icon?`, `content` | `WindowStep` |
| `table` | `columns`, `rows`, `moreRows?` | `TableStep` |
| `status` | `text`, `variant?` | `StatusStep` |
| `divider` | `label` | `DividerStep` |

Window `content` kinds: `fiji-image`, `image`, `markdown`, `source`, `folder`, `video` — unchanged from current types.

Every step can optionally carry a `comment` field (HTML string shown in the tutorial comment panel).

---

## Pipeline

### Stage 1: Merge Script

A TypeScript CLI at `scripts/merge-session.ts`, invoked as:

```bash
npx tsx scripts/merge-session.ts \
  --session src/tutorials/nuclei-segmentation/session/01c5db56.jsonl \
  --traces src/tutorials/nuclei-segmentation/traces/ \
  --out src/tutorials/nuclei-segmentation/
```

**What it does:**

1. Parses the JSONL line by line
2. Groups messages into rounds — each `user` message with `isMeta=false` starts a new round
3. For each round, walks the assistant's `content[]` blocks:
   - `thinking` block → `thinking` step
   - `text` block → `assistant` step (last text in round gets `final: true`)
   - `tool_use` block → `tool_call` step; if the tool is permission-gated, also emits a `permission` step before it
   - Subsequent `tool_result` in the next user message → `tool_result` step
4. Detects MCP tool calls (`mcp__fiji-mcp__*`) — checks for base64 image content in tool results, decodes and saves to `static/tutorials/<slug>/assets/`, creates `window` steps
5. Handles long tool results — if a result exceeds a threshold (~100 lines), the step `text` is truncated and the full content is written to a sidecar file (`full-log/round-NN-detail-MMM.txt`), referenced via a `details` field on the step
6. The first round (launching Claude) becomes `kind: terminal`
7. Writes `full-log/round-NN.yaml` for each round

**Trace enrichment:** If `traces/` contains Fiji event logs (e.g. image metadata, ROI data), the script annotates `window` steps with `statusBar`, dimensions, etc.

**Idempotent:** Running the script again overwrites `full-log/` and extracted assets. It never touches `tutorial/` or `notes.md`.

### Stage 2: Curation

Two workflows, both producing `tutorial/round-*.yaml`:

**Direct editing (A):** User copies round files from `full-log/` to `tutorial/`, removes steps, adds `comment` fields. With the Vite dev server running, edits are reflected live.

**Agent-assisted (B):** User writes `notes.md` with informal curation instructions:

```markdown
# Curation notes

## Round 2 (open image)
- Keep the tool_call and window step, skip the thinking
- Comment on how fiji-mcp auto-launches Fiji
- Mention this is ImageJ macro language, not Python

## Round 3 (segmentation)
- The core pipeline macro is the star — give it a detailed comment
- Include the results table, note that nucleus #4 has low roundness
- Skip the error where Claude forgot Select None (it retried)
```

The user then asks Claude Code to read `full-log/` + `notes.md` and produce the tutorial round files. The agent works one round at a time (keeps context manageable).

### Stage 3: Build Integration

YAML files are loaded at build/dev time using Vite's `import.meta.glob` with a YAML plugin.

**Tutorial loader** (`src/lib/data/tutorial-loader.ts`):

```ts
import yaml from 'js-yaml';

// Vite globs — discovered automatically, HMR-capable
const metaFiles = import.meta.glob('/src/tutorials/*/meta.yaml',
  { eager: true, query: '?raw', import: 'default' });
const tutorialRounds = import.meta.glob('/src/tutorials/*/tutorial/round-*.yaml',
  { eager: true, query: '?raw', import: 'default' });
const fullLogRounds = import.meta.glob('/src/tutorials/*/full-log/round-*.yaml',
  { eager: true, query: '?raw', import: 'default' });

function parseTutorials(): Tutorial[] {
  // 1. For each meta.yaml, extract slug
  // 2. Collect and sort round files by numeric suffix
  // 3. Parse YAML, resolve asset paths (filename → /tutorials/<slug>/assets/filename)
  // 4. Assemble Tutorial objects
}
```

**Asset serving:** Assets live in `static/tutorials/<slug>/assets/`. Vite serves `static/` as-is. No copy step needed — the merge script writes directly there.

**Page loader** (`+page.ts`) changes minimally:

```ts
// Before
import { getTutorialBySlug } from '$lib/data/tutorials';
// After
import { getTutorialBySlug } from '$lib/data/tutorial-loader';
```

**No component changes.** The `Tutorial` type is unchanged. `TraceViewer`, window components, and all rendering code continue to work as-is.

---

## Migration

The existing `nuclei-segmentation.ts` (407 lines) gets converted to the new folder structure. This is a one-time mechanical transformation:

1. Create `src/tutorials/nuclei-segmentation/meta.yaml` from the `meta` and `welcome` fields
2. Split `rounds` into `tutorial/round-01.yaml`, `tutorial/round-02.yaml`, etc.
3. Split `fullRounds` into `full-log/round-01.yaml`, `full-log/round-02.yaml`, etc.
4. Move images from `static/img/` to `static/tutorials/nuclei-segmentation/assets/`
5. Update asset references in YAML to use filenames only
6. Delete `src/lib/content/nuclei-segmentation.ts`
7. Update or delete the manual registry in `src/lib/data/tutorials.ts` (replaced by glob-based loader)

The `test-showcase.ts` follows the same process. To keep it dev-only, add `devOnly: true` to its `meta.yaml` — the loader filters these out when `import.meta.env.DEV` is false.

---

## What Changes, What Doesn't

| Component | Status |
|-----------|--------|
| `Tutorial`, `Step`, etc. type definitions | **Unchanged** — same interfaces in `tutorials.ts` |
| `TraceViewer`, all window components | **Unchanged** — same props |
| `+page.svelte` | **Unchanged** |
| `+page.ts` | **Minimal** — different import path |
| `tutorials.ts` types file | **Kept** — types stay, registry removed |
| `content/*.ts` tutorial data | **Replaced** by `src/tutorials/*/` YAML folders |
| `static/img/` | **Moved** to `static/tutorials/<slug>/assets/` |
| New: `scripts/merge-session.ts` | Merge script CLI |
| New: `src/lib/data/tutorial-loader.ts` | YAML glob loader |
| New: `src/tutorials/*/` | Tutorial folder structure |

---

## Dependencies

- `js-yaml` — YAML parsing at build time (lightweight, well-maintained)
- No Vite plugin needed — `import.meta.glob` with `?raw` query imports YAML as strings, parsed by `js-yaml` in the loader

---

## Out of Scope

- **Automated curation** — the agent workflow is conversational, not a formal tool
- **YAML schema validation** — could be added later with JSON Schema / Ajv, but not needed initially
- **i18n for comments** — comments are currently EN-only HTML; bilingual comments can be added later by making `comment` accept `{ en, ja? }` like other fields
- **Live trace recording** — the merge script works on completed sessions, not live streams
