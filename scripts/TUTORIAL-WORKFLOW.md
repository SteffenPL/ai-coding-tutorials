# Agent Tutorial-Creation Workflow

CLI-based pipeline for creating tutorials from Claude Code session logs.
Designed for both human and agent use.

## Pipeline overview

```
Raw session JSONL (Claude Code)
    │
    ▼  scripts/import-session.ts
src/sessions/<slug>/<uuid>.jsonl         (filtered copy)
    │
    ▼  scripts/session-to-tutorial.ts inspect
stdout: JSON session structure            (round/step map for planning)
    │
    ▼  author a spec YAML
specs/<slug>.yaml                         (curation decisions)
    │
    ▼  scripts/session-to-tutorial.ts generate
src/tutorials/<slug>/meta.yaml
src/tutorials/<slug>/tutorial/round-NN.yaml   (curated)
src/tutorials/<slug>/full-log/round-NN.yaml   (unabridged)
static/tutorials/<slug>/assets/step_NNN.png   (extracted images)
```

## Step 1 — Import the session

```bash
tsx scripts/import-session.ts \
  --session ~/.claude/projects/<proj>/<uuid>.jsonl \
  --out src/sessions/<slug>
```

Filters PII and noise, writes a clean JSONL.

## Step 2 — Inspect the session

```bash
tsx scripts/session-to-tutorial.ts inspect \
  --session src/sessions/<slug>/<uuid>.jsonl
```

Prints JSON: each round with its prompt and a list of steps (index,
type, one-line summary). Use this to decide which steps to include.

Output shape:
```json
[
  {
    "index": 0,
    "prompt": "Open the image with Fiji",
    "stepCount": 13,
    "steps": [
      { "index": 0, "type": "assistant", "summary": "[FINAL] I'll open..." },
      { "index": 1, "type": "tool_call", "summary": "fiji — run_ij_macro: ..." },
      { "index": 2, "type": "window", "summary": "Window: Image 1", "hasImage": true }
    ]
  }
]
```

## Step 3 — Write a spec YAML

The spec declares metadata + which steps make the curated tutorial.
Place it in `specs/<slug>.yaml`.

### Spec format

```yaml
slug: my-tutorial
title:
  en: "My Tutorial Title"
  ja: "日本語タイトル"           # optional
tags: [fiji, segmentation]
thumbnail: step_001.png          # filename from extracted assets
author: Name

welcome:                         # optional welcome overlay
  heading: { en: "...", ja: "..." }
  description: { en: "...", ja: "..." }
  learnings:
    - { en: "...", ja: "..." }

truncateLines: 60                # max lines for tool_result text

# Which session rounds to include and how
rounds:
  - round: 0                     # session round index (0-based)
    include: commented           # 'all' | 'commented' | [0, 2, 5]
    # include: all               — every step from this round
    # include: commented         — only steps listed in `steps:` below
    # include: [0, 2, 5, 11]    — specific step indices

  - round: 1
    include: commented
    promptOverride: "Custom prompt text"  # optional
    kind: terminal                        # optional, default: claude

# Per-step annotations and overrides
steps:
  - round: 0
    step: 0
    comment:
      en: "English tutorial note for this step."
      ja: "日本語の注釈。"

  - round: 0
    step: 3
    compact: true                # render as one-line summary

  - round: 0
    step: 5
    hidden: true                 # collapsed in simplified view

  - round: 1
    step: 11
    override:                    # replace any step fields
      windowTitle: "Better Title"
      subtitle: "descriptive subtitle"
      content:
        kind: fiji-image
        src: step_003.png
        statusBar: "1376×1104 pixels"
```

### Key concepts

- **`include: commented`** includes only steps that appear in the
  `steps:` array (the most common mode for curated tutorials)
- **`comment`** makes a step a "tutorial stop" — the waypoint shown in
  Tutorial detail level and the R.T counter
- **`compact: true`** renders tool results and short messages as a
  single line instead of full content
- **`hidden: true`** collapses the step into an "N steps hidden"
  placeholder in simplified view (useful for debugging detours)
- **`override`** replaces fields on the generated step (useful for
  cleaning up window titles, adding status bars, shortening code)

## Step 4 — Generate the tutorial

```bash
tsx scripts/session-to-tutorial.ts generate \
  --session src/sessions/<slug>/<uuid>.jsonl \
  --spec specs/<slug>.yaml
```

Writes `meta.yaml`, `tutorial/round-NN.yaml`, `full-log/round-NN.yaml`,
and extracts images to `static/tutorials/<slug>/assets/`.

## Step 5 — Verify

```bash
npx svelte-check --threshold error    # type check
npm run dev                           # preview at localhost:5173
```

The tutorial should appear on the home page and be viewable at
`/tutorials/<slug>`.

## Tips for agents

1. **Inspect first.** Run `inspect` and study the output before writing
   a spec. Identify the narrative arc: setup, action, results.

2. **Start with `include: commented`.** Only include steps you write
   comments for. This naturally produces a tight curated view.

3. **Use `hidden: true` for debugging detours.** Real sessions have
   trial-and-error; hide the noise but keep it accessible via the
   "Full Log" toggle.

4. **Override window titles.** Auto-generated titles like "Image 3" are
   meaningless. Replace them with descriptive names via `override`.

5. **Keep `full-log/` unmodified.** The generate step writes both layers
   — the full log is the unabridged record, the curated tutorial is
   your editorial selection.

6. **Asset naming.** Images are extracted as `step_001.png`,
   `step_002.png`, etc. in order of appearance. Reference them by
   bare filename in the spec (asset path rewriting handles the rest).

7. **Iterate.** Re-run `generate` after editing the spec — it
   overwrites all output files. The spec is the source of truth for
   the curated layer.
