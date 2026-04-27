# Session log pipeline

Imports raw Claude Code session logs, filters them through a zod
allowlist, and renders them at `/log/<slug>`. Filtered sessions also
feed the curate tool (session → trace → composition).

Goal: display a full conversation faithfully, with every assistant turn,
tool call, tool result, and subagent invocation, without requiring hand
curation.

## Pipeline at a glance

```
~/.claude/projects/<proj>/<sessionId>.jsonl          ← raw, untouched
  + <sessionId>/subagents/agent-*.jsonl/.meta.json
        │
        │  scripts/import-session.ts (or the /edit dashboard)
        │  (zod schema acts as allowlist — drops PII, noise, encrypted fields)
        ▼
src/sessions/<slug>/<sessionId>.jsonl                ← filtered, committed
  + <sessionId>/subagents/agent-*.jsonl/.meta.json
        │
        │  src/lib/session/loader.ts   (Vite glob + zod revalidate)
        │  src/lib/session/viewmodel.ts (→ flat DisplayNode[])
        ▼
/log/<slug>  (src/routes/log/[slug]/+page.svelte)
    or
/curate/<slug>  (for producing a trace.json)
```

`src/sessions/<slug>/` is the canonical storage. The loader also reads
the legacy path `src/tutorials/<slug>/session/` for backward
compatibility with tutorials imported before the migration; both appear
in the dashboard.

The filtered file is **still Claude Code JSONL** — same `type`
discriminator, same `message.content` block shapes, just slimmer. A reader
opening the committed file sees a familiar format; no custom
intermediate.

## Layout

```
src/lib/session/
├── schema.ts         zod schema — the allowlist (acts as filter + validator)
├── loader.ts         Vite-glob loader → LoadedSession (typed)
└── viewmodel.ts      pure fn LoadedSession → SessionView (flat nodes)

scripts/
└── import-session.ts CLI — raw JSONL → filtered JSONL copy

src/routes/log/[slug]/
├── +page.ts          entries() + load()
└── +page.svelte      timeline render (flat list, subagents inline)

src/sessions/<slug>/             ← storage (committed)
├── <sessionId>.jsonl
└── <sessionId>/subagents/agent-<agentId>.jsonl(+.meta.json)

src/tutorials/<slug>/session/    ← legacy storage, still read by loader
```

## Schema as filter

`schema.ts` is the single source of truth. It serves three jobs:

1. **Filter** — `SessionEvent.safeParse(raw)` during import drops every
   field not declared in the schema (zod strips unknowns by default). No
   separate sanitization pass.
2. **Validator** — the loader runs the same schema again when reading
   the committed files, catching any drift or hand-edits.
3. **Type** — `SessionEvent` is exported as the TS type that viewer code
   consumes.

Explicitly dropped for PII / noise: `cwd`, `gitBranch`, `userType`,
`entrypoint`, `version`, `requestId`, `sessionId`-on-events, `slug`,
`caller`, `usage`, `stop_reason`, and the thinking `signature`.

Entry types explicitly dropped wholesale (tracked in
`KNOWN_DROPPED_TYPES` / `KNOWN_DROPPED_SYSTEM_SUBTYPES`): `attachment`,
`file-history-snapshot`, `permission-mode`, `last-prompt`,
`queue-operation`, `agent-name`, and most `system` subtypes except
`compact_boundary`.

Unknown types / subtypes **warn** during import — they don't silently
disappear. This is the format-drift tripwire.

## Import script

```bash
npx tsx scripts/import-session.ts \
  --session ~/.claude/projects/<proj>/<sessionId>.jsonl \
  --out     src/sessions/<slug> \
  [--dry-run]
```

The `/edit` dashboard exposes the same import behaviour as a form
(recommended for normal use; the CLI is handy for batch/scripted imports).

- Auto-discovers sibling `<sessionId>/subagents/` folder and mirrors it
  into the output. Each subagent file is filtered through the same
  schema.
- Reports kept / dropped counts per type. **Dropped (expected)** means
  the type is in the known-noise list. **Dropped (UNEXPECTED)** means
  zod rejected an entry matching a known `type` — investigate.
- `--dry-run` prints the report without writing files.

Verified against all 29 sessions in this project: ~50% size reduction,
0 unexpected drops, round-trip-clean through the same schema.

## Loader + viewmodel

`loader.ts` globs both `src/sessions/*/*.jsonl` (canonical) and
`src/tutorials/*/session/*.jsonl` (legacy), plus the parallel
`subagents/` globs, eagerly via `import.meta.glob('?raw')` — matches the
existing `tutorial-loader.ts` pattern. Output per slug:

```ts
LoadedSession { slug, sessionId, customTitle?, events, subagents }
```

`viewmodel.ts` transforms that into a flat `DisplayNode[]`. An assistant
message with 3 content blocks becomes 3 nodes; a user message with tool
results becomes N nodes. Subagents get **attached inline** to their
invoking `Agent` tool_use via the linkage:

```
Agent.tool_use.id
  → paired tool_result.tool_use_id
  → parent-event.toolUseResult.agentId
  → session.subagents[agentId]
```

`visitedAgents: Set<string>` prevents double-rendering; any subagent not
reached from the main timeline lands in `orphanSubagents` instead of
being silently dropped.

## Display nodes

| `kind`             | rendered as                                                   |
|--------------------|---------------------------------------------------------------|
| `prompt`           | orange `›` gutter, user message text                          |
| `user-text`        | mauve gutter, interrupts / skill-base-dir markers             |
| `user-tool-result` | blue gutter (red if `is_error`), text/image/tool-ref blocks   |
| `assistant-text`   | teal gutter, plain text                                       |
| `thinking`         | compact italic marker when empty; collapsible with text       |
| `tool-use`         | peach gutter, primary-input `code` pane, optional subagent    |
| `compact`          | dashed hr "— context compacted —"                             |

Empty-thinking case (see "Known characteristics" below) renders as a
one-line `⋯ extended thinking` marker, not a collapsible with `(0 chars)`.

## Known characteristics

- **Thinking text is always empty.** Across 351 thinking blocks in 29
  sessions, every `thinking` field is `""`. Claude Code stores extended
  reasoning as an encrypted `signature` only. Schema field is kept for
  forward compatibility; viewer renders a compact marker.
- **Subagent filenames** can be non-hex: e.g., `agent-acompact-...jsonl`
  when the subagent was a compaction agent. Regex handles this.
- **Orphan subagents** are rare but possible (aborted Agent runs, partial
  imports). Rendered in a separate section rather than dropped.
- **Images are inline base64.** Filtered JSONL keeps them as-is; viewer
  renders via data URL. Fine for current log sizes (largest session ~800 KB).
  Extract to sidecar assets if this grows.

## Relationship to the tutorial pipeline

- **Storage is separated**: sessions in `src/sessions/<slug>/`, curated
  traces in `src/traces/<slug>/trace.json`, tutorial output under
  `src/tutorials/<slug>/`.
- **Logic is disjoint**: `tutorial-loader.ts` and `session/loader.ts` do
  not reference each other. A slug can have either or both — tutorial
  without a session, a session without curation, or both.
- **Routes are separate**: `/tutorials/<slug>` renders curated content;
  `/log/<slug>` renders the raw session. Different loaders, different
  pages, different URL prefixes.
- **`merge-session.ts` is deprecated** — still checked in for the
  existing tutorials that used it (`install-claude-code`,
  `test-showcase`), produces `full-log/round-*.yaml`. New work should
  use the session → trace → composition flow instead.

## What's deliberately not done yet

- `/log/` index page listing available slugs.
- Detail-level filter (everything vs. rounds vs. curated).
- Pairing `tool_use` with its `tool_result` visually (currently rendered
  sequentially, not linked as a pair).
- Image sidecar extraction (still inline base64).
- Nested `Agent`-within-`Agent`: supported by `visitedAgents` but no
  fixture in current data to exercise it.
- Wiring the new loader into the existing tutorial viewer as a "full
  log" mode — will eventually replace `merge-session.ts`.

## Adding a session

Use the `/edit` dashboard during `npm run dev` (recommended). It runs
the same import logic as the CLI script. From the dashboard, create a
trace from a session at `/curate/<slug>`, then compose a tutorial at
`/compose/<slug>`.

## Deleting sessions and other resources

The `/edit` dashboard provides delete buttons on all resource types. Deletion
moves items to `.trash/` (restorable). The trash section at the bottom of
`/edit` supports per-item restore, per-item permanent delete, and "Empty All".
Deleting a session warns if any trace references it; deleting a trace warns
if any tutorial composition uses it as a source.
