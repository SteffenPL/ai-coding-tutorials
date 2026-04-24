---
title: "feat: Add tutorial pipeline subagents for automated tutorial creation"
type: feat
status: active
date: 2026-04-24
origin: docs/brainstorms/tutorial-pipeline-agents-requirements.md
---

# feat: Add tutorial pipeline subagents for automated tutorial creation

## Overview

Create four Claude Code subagent `.md` files that automate the tutorial creation pipeline: a session creator that runs real Claude Code sessions, a tutorial producer that imports/curates/writes compositions, a translator for EN→JA, and an orchestrator that chains them end-to-end. Each agent is independently invocable and follows convention-based file paths for inter-agent coordination.

---

## Problem Frame

Creating tutorials is a multi-step manual process requiring prompt design expertise, editorial judgment, and bilingual writing ability. Each step must respect the repo's three-layer data pipeline (Session JSONL → Trace JSON → Composition JSON) and its directory conventions. Automating with specialized subagents lets a single orchestrator command produce a published tutorial, while each agent remains useful standalone. (see origin: `docs/brainstorms/tutorial-pipeline-agents-requirements.md`)

---

## Requirements Trace

- R1. Session-creator runs real Claude Code CLI sessions (not synthetic)
- R2. Session-creator designs progressive prompt sequences with model/tool selection
- R3. Session-creator imports JSONL to `src/sessions/<slug>/` and reports the path
- R4. Tutorial-producer handles trace → composition pipeline (assumes session already imported)
- R5. Editorial focus: key learning points, prompt design, outcomes — not intermediate steps
- R6. Include links to relevant external resources in comments
- R7. Tutorial-producer has scope authority (split/combine sessions)
- R8. Translator adds `ja` fields to all translatable content
- R9. Context-appropriate academic Japanese, not literal translation
- R10. Orchestrator chains agents via convention-based slug paths
- R11. Orchestrator verifies output compiles and is previewable
- R12. Each agent independently invocable
- R13. All agents in `.claude/agents/` with standard frontmatter
- R14. Agents reference pipeline documentation for current format knowledge

**Origin actors:** A1 (Session Creator), A2 (Tutorial Producer), A3 (Translator), A4 (Orchestrator), A5 (Human author)
**Origin flows:** F1 (Full pipeline), F2 (Standalone session creation), F3 (Standalone tutorial production)
**Origin acceptance examples:** AE1 (covers R1, R3, R10), AE2 (covers R5, R6), AE3 (covers R7), AE4 (covers R8, R9)

---

## Scope Boundaries

- No changes to existing data pipeline types, scripts, or build system — agents consume them as-is
- No web UI for agent management — CLI invocation only
- No automatic deployment — orchestrator verifies but does not run `deploy.sh`
- No multi-language beyond EN/JA
- Agent files are pure markdown — no new TypeScript code in this plan

---

## Context & Research

### Relevant Code and Patterns

- `.claude/agents/fiji-processing.md` — established agent file format (frontmatter: `name`, `description` with examples, `model: inherit`, `memory: project`; body: role, responsibilities, guidelines, conventions)
- `scripts/import-session.ts` — session import script (`tsx scripts/import-session.ts --session <path> --out src/sessions/<slug>`)
- `scripts/session-to-tutorial.ts` — inspect mode for session structure analysis (`tsx scripts/session-to-tutorial.ts inspect --session <path>`)
- `src/lib/trace/types.ts` — `TraceState`, `TraceRound`, `TraceStep` (the trace JSON schema agents must produce)
- `src/lib/compose/types.ts` — `TutorialComposition`, `TraceBlock`, `FORMAT_VERSION = '1.0.0'`
- `src/lib/data/tutorials.ts` — `TutorialMeta`, `StepBase.comment` (the `{ en: string; ja?: string }` pattern)
- `src/tutorials/nuclei-segmentation/composition.json` — example composition referencing a trace
- `src/traces/nuclei-segmentation/trace.json` — example trace with rounds, steps, displayMode, overrides

### Institutional Learnings

- **Format unification** (`docs/solutions/architecture-patterns/format-unification-jsonl-json-pipeline-2026-04-24.md`): Pipeline is JSONL + JSON only. Compositions are canonical — no YAML export step. All layers carry `formatVersion: "1.0.0"`.
- **Step display categories** (`docs/solutions/design-patterns/step-display-category-system-2026-04-23.md`): Step types have sensible displayMode defaults (tool_call/tool_result → compact, assistant → full, window → normal). Agents should only override when pedagogically needed.
- **WYSIWYG trace editing** (`docs/solutions/design-patterns/wysiwyg-trace-editing-via-component-reuse-2026-04-23.md`): `TraceStep` converts to `Step` via `traceStepToTutorialStep()`. Agents produce `TraceState` objects, not `Step` objects directly.

---

## Key Technical Decisions

- **Session JSONL discovery**: Before running `claude` CLI, the session-creator snapshots existing JSONL files (`find ~/.claude/projects -name '*.jsonl'`). After the session completes, it diffs against the snapshot to identify the new file. This avoids the self-referential problem (the agent's own session produces JSONL in the same directory). Falls back to newest-file heuristic with content verification if the diff approach fails.
- **Model selection heuristics**: Embed in session-creator instructions: Opus for complex multi-step reasoning showcases, Sonnet for quick/focused demos. Default to Sonnet unless the topic requires extended reasoning.
- **Shared assets when splitting**: When tutorial-producer splits a session into multiple tutorials, assets are copied to each tutorial's `static/tutorials/<slug>/assets/` directory. Only assets referenced by that tutorial's trace are copied.
- **Embed vs reference pipeline knowledge**: Hybrid approach — embed critical conventions (file paths, format version, key type shapes, displayMode defaults) directly in each agent file, and add a "read `scripts/TUTORIAL-WORKFLOW.md` and `CLAUDE.md` before starting" instruction for full pipeline context. This ensures agents work even if they can't read referenced files, but can deepen their knowledge when they can.
- **Tutorial-producer bootstraps trace via existing conversion pipeline**: The agent uses the dev-server API endpoints (or `session-to-tutorial.ts inspect`) to bootstrap an initial `TraceState` from the session, then edits it to apply editorial decisions (inclusion, displayMode, comments). This avoids hand-writing `sourceRef` mappings and HTML escaping. The agent then writes a minimal `composition.json` referencing that trace. This follows the UI pipeline path (not the legacy YAML spec path).

---

## Open Questions

### Resolved During Planning

- **How to locate JSONL after `claude` CLI**: Snapshot existing JSONL files before invocation, diff after to find the new file. Avoids picking agent's own session JSONL.
- **Model selection**: Default Sonnet, use Opus for complex reasoning topics. Embedded as heuristic in agent instructions.
- **Asset handling on split**: Copy relevant assets to each tutorial's asset directory.
- **Embed vs reference**: Hybrid — embed critical conventions, reference docs for depth.

### Deferred to Implementation

- **Exact `claude` CLI flags**: The session-creator will need to test which flags work best for generating tutorial-quality sessions (e.g., `--allowedTools`, `--model`, project directory setup). The agent instructions should be iteratively refined based on real use.
- **Session quality validation**: How the session-creator determines whether a generated session is "good enough" to proceed vs. needs re-running. Start with a simple completeness check (session has multiple rounds, no error exits).

---

## Output Structure

```
.claude/agents/
├── session-creator.md          # U1: Creates real Claude Code sessions
├── tutorial-producer.md        # U2: Imports, curates, writes compositions
├── translator.md               # U3: EN→JA translation
└── tutorial-orchestrator.md    # U4: Full pipeline coordination
```

---

## Implementation Units

- [ ] U1. **Session Creator agent**

**Goal:** Create the agent file that designs prompts, runs real Claude Code sessions, and imports the resulting JSONL to `src/sessions/<slug>/`.

**Requirements:** R1, R2, R3, R12, R13, R14

**Dependencies:** None

**Files:**
- Create: `.claude/agents/session-creator.md`

**Approach:**
- Frontmatter follows fiji-processing.md pattern: `name: session-creator`, description with 2-3 example triggers, `model: inherit`, `memory: project`
- Body sections: role definition, prompt design guidelines (progressive teaching, model selection heuristics), session execution procedure (run `claude` CLI, locate JSONL, import via `scripts/import-session.ts`), output verification checklist
- Embed the JSONL discovery procedure: snapshot existing files before `claude` invocation, diff after completion to find the new JSONL. Fallback: `ls -t ~/.claude/projects/*/*.jsonl | head -1` with content verification
- Include model selection heuristics: Sonnet default, Opus for complex reasoning
- Include MCP tool selection guidance: reference available MCP servers, match tools to topic
- Instruct agent to read `scripts/TUTORIAL-WORKFLOW.md` and `CLAUDE.md` for full pipeline context before starting

**Patterns to follow:**
- `.claude/agents/fiji-processing.md` for file structure and frontmatter format

**Test scenarios:**
- Test expectation: none — agent files are markdown instructions, not executable code. Verification is via manual invocation.

**Verification:**
- Agent file parses as valid frontmatter + markdown
- Claude Code recognizes the agent (appears in agent list)
- Invoking the agent with a test topic produces a session JSONL imported to the correct path

---

- [ ] U2. **Tutorial Producer agent**

**Goal:** Create the agent file that takes an imported session and produces a curated trace + composition, making all editorial decisions about what to include, how to comment, and whether to split into multiple tutorials.

**Requirements:** R4, R5, R6, R7, R12, R13, R14

**Dependencies:** None (can be written in parallel with U1, though it will consume U1's output at runtime)

**Files:**
- Create: `.claude/agents/tutorial-producer.md`

**Approach:**
- Frontmatter: `name: tutorial-producer`, description with examples (e.g., "Create a tutorial from the nuclei-segmentation session"), `model: inherit`, `memory: project`
- Body sections:
  1. **Role**: Editorial agent for the tutorial pipeline. Understands the three-layer data model.
  2. **Editorial philosophy**: Learner's time is the primary constraint. Focus on prompt design rationale and outcomes. Include intermediate steps only when they teach something. Link to external resources. Comments should help the reader learn *how to prompt effectively*.
  3. **Pipeline procedure**:
     - Inspect the session structure using `tsx scripts/session-to-tutorial.ts inspect --session src/sessions/<slug>/<uuid>.jsonl`
     - Analyze round structure: identify the narrative arc (setup → action → results)
     - Make scope decisions: if session covers >1 distinct topic, split into separate tutorials
     - Bootstrap initial `TraceState` via dev-server API (`POST /api/traces/<slug>`) or by running the existing conversion pipeline — do NOT hand-write TraceState JSON from raw JSONL (sourceRef mappings and HTML escaping require the existing conversion functions)
     - Edit the bootstrapped trace: set `included`, `displayMode`, `hidden`, `comment` for each step
     - Write to `src/traces/<slug>/trace.json`
     - Create `TutorialComposition` JSON with `formatVersion: "1.0.0"`, meta, and blocks referencing the trace (only `kind: 'trace'` blocks — `round` blocks are not supported in the current type system)
     - Write to `src/tutorials/<slug>/composition.json` (auto-discovered by build system, no manual registration needed)
     - Extract/copy image assets to `static/tutorials/<slug>/assets/`
     - If splitting: output all created slugs so orchestrator can discover them
  4. **TraceState conventions**: Embed the `TraceStep` shape, `DisplayMode` values, and category defaults (tool_call→compact, assistant→full, window→normal). Only override displayMode for pedagogical reasons.
  5. **Comment writing guidelines**: Use `{ en: "..." }` format (translator adds `ja` later). Focus on: why this prompt works, what the outcome teaches, links to docs. Avoid narrating what's visible.
  6. **Scope splitting procedure**: When splitting, create separate slugs, separate trace.json files, separate composition.json files. Copy only relevant assets to each.

**Patterns to follow:**
- `.claude/agents/fiji-processing.md` for structure
- `src/traces/nuclei-segmentation/trace.json` for trace format
- `src/tutorials/nuclei-segmentation/composition.json` for composition format
- `scripts/TUTORIAL-WORKFLOW.md` "Tips for agents" section for editorial heuristics

**Test scenarios:**
- Test expectation: none — agent files are markdown instructions. Verification is via manual invocation.

**Verification:**
- Agent file parses as valid frontmatter + markdown
- Invoking with an existing session produces valid `trace.json` and `composition.json`
- The produced tutorial appears on the site when `npm run dev` is running
- Comments focus on prompt design and outcomes, not step narration

---

- [ ] U3. **Translator agent**

**Goal:** Create the agent file that adds context-appropriate Japanese translations to tutorial compositions.

**Requirements:** R8, R9, R12, R13, R14

**Dependencies:** None (can be written in parallel)

**Files:**
- Create: `.claude/agents/translator.md`

**Approach:**
- Frontmatter: `name: translator`, description with examples (e.g., "Translate the nuclei-segmentation tutorial to Japanese"), `model: inherit`, `memory: project`
- Body sections:
  1. **Role**: Academic/research Japanese translator specializing in technical content.
  2. **Translation scope**: Only translatable fields — `meta.title.ja`, `welcome.heading.ja`, `welcome.description.ja`, `welcome.learnings[].ja`, and all `step.comment` fields in the trace. Terminal content (prompts, code, tool output) stays in English.
  3. **Translation guidelines**:
     - Natural Japanese phrasing, not literal word-by-word translation
     - Academic register appropriate for researchers (です/ます form for explanatory text)
     - Technical terms: use established Japanese equivalents when they exist (セグメンテーション, 閾値処理), keep English for terms with no standard Japanese equivalent (Claude Code, MCP)
     - Context matters: translate the intent, not just the words. A comment explaining prompt design should read naturally to a Japanese researcher.
  4. **Procedure**:
     - Read the composition.json to find which trace(s) it references
     - Read each trace.json and update `comment` fields from `string` to `{ en: "...", ja: "..." }` (or add `ja` to existing objects)
     - Update `meta.title` in composition.json to add `ja`
     - Update `welcome` fields if present
     - Write updated files back in place
  5. **Quality checklist**: Re-read all `ja` fields together as a native reader would experience them. Check for consistency in terminology and register.

**Patterns to follow:**
- `.claude/agents/fiji-processing.md` for structure
- `src/tutorials/nuclei-segmentation/composition.json` for example of bilingual `meta.title`
- `src/lib/stores/lang.svelte.ts` for the `{ en, ja? }` pattern

**Test scenarios:**
- Test expectation: none — markdown instruction file. Verification is via manual invocation.

**Verification:**
- Agent file parses as valid frontmatter + markdown
- Invoking on a composition produces `ja` fields on all translatable content
- Switching to Japanese in the site UI shows translated content
- Translations read naturally to a native speaker (manual review)

---

- [ ] U4. **Tutorial Orchestrator agent**

**Goal:** Create the agent file that coordinates the full pipeline: topic → session → trace → composition → translation → verification.

**Requirements:** R10, R11, R12, R13, R14

**Dependencies:** U1, U2, U3 (the orchestrator's instructions reference the other agents by name)

**Files:**
- Create: `.claude/agents/tutorial-orchestrator.md`

**Approach:**
- Frontmatter: `name: tutorial-orchestrator`, description with examples (e.g., "Create a complete tutorial about cell segmentation with Fiji"), `model: inherit`, `memory: project`
- Body sections:
  1. **Role**: Pipeline orchestrator. Coordinates session-creator → tutorial-producer → translator to produce a complete bilingual tutorial.
  2. **Pipeline steps**:
     - Receive topic description + learning goals from user
     - Determine slug (kebab-case from topic), validate it's not already taken
     - Invoke session-creator agent (via `Agent` tool with `subagent_type: "session-creator"`) with topic + slug + any constraints
     - Verify session was created at `src/sessions/<slug>/`
     - Invoke tutorial-producer agent with session slug
     - Discover produced slugs: scan `src/tutorials/` for recently modified `composition.json` files (tutorial-producer may have split into multiple tutorials with different slugs)
     - Verify trace and composition exist for each discovered slug
     - Invoke translator agent for each composition
     - Verify translations present
     - Run `npx svelte-check --threshold error` to verify compilation
     - Present editorial summary to user: what was included/excluded, what was commented, any splits — flag as **"ready for review"**, not "complete"
     - Report tutorial URL(s) for human review in dev server
  3. **Coordination conventions**: All handoff is slug-based. No file paths passed between agents — each agent knows the directory conventions. The orchestrator only passes the slug.
  4. **Error handling**: If any stage fails, report which stage failed and what was produced. Do not clean up partial output — the user may want to resume from the last successful stage.
  5. **Verification checklist**: Type-check passes, tutorial appears in dev server, both EN and JA content present.

**Patterns to follow:**
- `.claude/agents/fiji-processing.md` for structure
- The `Agent` tool's `subagent_type` parameter for invoking other agents

**Test scenarios:**
- Test expectation: none — markdown instruction file. Verification is via manual invocation.

**Verification:**
- Agent file parses as valid frontmatter + markdown
- Covers AE1. Invoking with a topic produces a complete tutorial at the expected paths
- All three sub-agents are invoked in sequence
- Final output passes `svelte-check` and is visible in dev server

---

## System-Wide Impact

- **No code changes**: All deliverables are `.claude/agents/*.md` files — no production code, types, or build system changes
- **Agent discovery**: Claude Code auto-discovers agents in `.claude/agents/`. Adding four files makes them available immediately.
- **Pipeline consumption**: Agents consume existing scripts and data formats. If the pipeline changes (e.g., format unification plan lands), agent instructions may need updating, but the agents themselves don't block or interfere with pipeline evolution.
- **Unchanged invariants**: The data pipeline types (`TraceState`, `TutorialComposition`), build system, asset rewriting, and i18n system are all unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `claude` CLI session JSONL discovery is fragile (newest file heuristic) | Agent verifies content matches topic; instructions note this is best-effort and may need manual correction |
| Generated sessions may be low quality (hallucinations, wrong tools) | Tutorial-producer curates regardless; orchestrator can re-run session-creator |
| Agent instructions may drift as pipeline evolves | R14 requires agents to read current docs; embed only conventions unlikely to change |
| Translation quality hard to verify programmatically | Translator includes a self-review checklist; final quality is a manual check |

---

## Sources & References

- **Origin document:** [docs/brainstorms/tutorial-pipeline-agents-requirements.md](docs/brainstorms/tutorial-pipeline-agents-requirements.md)
- Agent format reference: `.claude/agents/fiji-processing.md`
- Pipeline docs: `scripts/TUTORIAL-WORKFLOW.md`
- Trace types: `src/lib/trace/types.ts`
- Composition types: `src/lib/compose/types.ts`
- Example trace: `src/traces/nuclei-segmentation/trace.json`
- Example composition: `src/tutorials/nuclei-segmentation/composition.json`
- Format unification learning: `docs/solutions/architecture-patterns/format-unification-jsonl-json-pipeline-2026-04-24.md`
- Step categories learning: `docs/solutions/design-patterns/step-display-category-system-2026-04-23.md`
