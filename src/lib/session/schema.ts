/**
 * Zod schema for Claude Code session logs.
 *
 * Acts as an allowlist: anything not declared here is dropped by `.parse()`.
 * The same schema is used twice:
 *   1. At import time — filters raw `~/.claude/projects/...jsonl` into a
 *      slimmed, committable copy (drops PII fields like `cwd`, `gitBranch`,
 *      and noise like `file-history-snapshot`, `attachment`).
 *   2. At load time — validates the committed JSONL before handing it to
 *      the viewer, so the Svelte code consumes typed data.
 *
 * Filtered output keeps the original Claude Code JSONL shape (same `type`
 * discriminator, same `message.content` block structure) so a filtered file
 * is still recognizable as a Claude session log.
 */
import { z } from 'zod';

/* ─── Content blocks (inside message.content) ──────────────────────────── */

export const TextBlock = z.object({
	type: z.literal('text'),
	text: z.string()
});

export const ThinkingBlock = z.object({
	type: z.literal('thinking'),
	// NOTE: Claude Code's extended thinking is server-side-encrypted. In every
	// session observed to date, `thinking` is the empty string and the actual
	// reasoning is only recoverable from the opaque `signature` via Anthropic's
	// API replay. We keep the field (forward-compatible in case this changes)
	// but the viewer renders empty thinking as a compact marker rather than
	// a collapsible with "(0 chars)". `signature` is dropped — useless to us.
	thinking: z.string()
});

export const ToolUseBlock = z.object({
	type: z.literal('tool_use'),
	id: z.string(),
	name: z.string(),
	input: z.record(z.string(), z.unknown())
	// `caller` dropped.
});

const ToolResultTextPart = z.object({
	type: z.literal('text'),
	text: z.string()
});

const ToolResultImagePart = z.object({
	type: z.literal('image'),
	source: z.object({
		type: z.literal('base64'),
		media_type: z.string(),
		data: z.string()
	})
});

/** Appears inside ToolSearch results — `{type:'tool_reference', tool_name}`. */
const ToolResultReferencePart = z.object({
	type: z.literal('tool_reference'),
	tool_name: z.string()
});

const ToolResultContent = z.union([
	z.string(),
	z.array(
		z.discriminatedUnion('type', [
			ToolResultTextPart,
			ToolResultImagePart,
			ToolResultReferencePart
		])
	)
]);

export const ToolResultBlock = z.object({
	type: z.literal('tool_result'),
	tool_use_id: z.string(),
	content: ToolResultContent,
	is_error: z.boolean().optional()
});

export const AssistantContentBlock = z.discriminatedUnion('type', [
	TextBlock,
	ThinkingBlock,
	ToolUseBlock
]);

/* ─── Common event header fields ───────────────────────────────────────── */

const EventHeader = {
	uuid: z.string(),
	parentUuid: z.string().nullable().optional(),
	timestamp: z.string().optional(),
	isSidechain: z.boolean().optional(),
	promptId: z.string().optional()
	// Dropped (PII or bookkeeping): cwd, gitBranch, userType, entrypoint,
	// version, requestId, sessionId, slug.
};

/* ─── Event variants ───────────────────────────────────────────────────── */

/**
 * Blocks that can appear inside an array-shaped user message.
 *   - `tool_result` — the normal case (tool output flowing back)
 *   - `text` — interrupts ("[Request interrupted by user]") and some
 *      skill-related markers ("Base directory for this skill: ...")
 */
const UserContentBlock = z.discriminatedUnion('type', [ToolResultBlock, TextBlock]);

/**
 * User message — one of three observed shapes:
 *   1. `content: string`                         — a prompt
 *   2. `content: ToolResultBlock[]`              — tool-result flow
 *   3. `content: TextBlock[]`                    — interrupts, skill markers
 *
 * Not split into discriminated variants because all three share
 * `type: "user"` at the top level. Downstream code switches on the content
 * shape (typeof content === 'string' vs. first-block type).
 */
export const UserEvent = z.object({
	type: z.literal('user'),
	...EventHeader,
	isMeta: z.boolean().optional(),
	// `agentId` appears on subagent-internal user events.
	agentId: z.string().optional(),
	message: z.object({
		role: z.literal('user'),
		content: z.union([z.string(), z.array(UserContentBlock)])
	}),
	// Sibling to `message` — contains rich tool-result metadata. We only
	// care about the link to a subagent session file (`agentId`). The raw
	// field has several observed shapes (object with agentId, plain error
	// string, unrelated objects from other tools). `z.preprocess` normalizes
	// anything that's not an agent-shaped object to `undefined`, which then
	// gets stripped from the filtered output.
	toolUseResult: z
		.preprocess(
			(v) =>
				v && typeof v === 'object' && !Array.isArray(v) && 'agentId' in v ? v : undefined,
			z
				.object({
					agentId: z.string().optional(),
					agentType: z.string().optional(),
					status: z.string().optional()
				})
				.optional()
		)
		.optional()
});

export const AssistantEvent = z.object({
	type: z.literal('assistant'),
	...EventHeader,
	agentId: z.string().optional(),
	message: z.object({
		role: z.literal('assistant'),
		model: z.string().optional(),
		content: z.array(AssistantContentBlock)
		// Dropped: id, stop_reason, stop_sequence, stop_details, usage.
	})
});

/**
 * Compaction boundary — marks where Claude Code auto-compacted the context
 * window. Useful to surface to the viewer as a visible marker. All other
 * `system` subtypes (turn_duration, stop_hook_summary, local_command,
 * bridge_status, away_summary) are dropped.
 */
export const SystemCompactEvent = z.object({
	type: z.literal('system'),
	subtype: z.literal('compact_boundary'),
	uuid: z.string(),
	timestamp: z.string().optional(),
	content: z.string().optional(),
	compactMetadata: z
		.object({
			trigger: z.string().optional(),
			preTokens: z.number().optional()
		})
		.optional()
});

export const CustomTitleEvent = z.object({
	type: z.literal('custom-title'),
	customTitle: z.string()
});

/* ─── Session header (first line of versioned JSONL) ──────────────────── */

export const HeaderEvent = z.object({
	type: z.literal('header'),
	formatVersion: z.string(),
	importDate: z.string(),
	sourceSessionId: z.string().optional()
});

/* ─── Top-level union ──────────────────────────────────────────────────── */

export const SessionEvent = z.discriminatedUnion('type', [
	UserEvent,
	AssistantEvent,
	SystemCompactEvent,
	CustomTitleEvent,
	HeaderEvent
]);

export type SessionEvent = z.infer<typeof SessionEvent>;
export type UserEvent = z.infer<typeof UserEvent>;
export type AssistantEvent = z.infer<typeof AssistantEvent>;
export type SystemCompactEvent = z.infer<typeof SystemCompactEvent>;
export type CustomTitleEvent = z.infer<typeof CustomTitleEvent>;
export type HeaderEvent = z.infer<typeof HeaderEvent>;
export type ToolUseBlockT = z.infer<typeof ToolUseBlock>;
export type ToolResultBlockT = z.infer<typeof ToolResultBlock>;

/* ─── Subagent sidecar ─────────────────────────────────────────────────── */

/**
 * `<sessionId>/subagents/agent-<agentId>.meta.json` — one JSON object per file.
 */
export const SubagentMeta = z.object({
	agentType: z.string(),
	description: z.string()
});

export type SubagentMeta = z.infer<typeof SubagentMeta>;

/* ─── Known-noise classifications ──────────────────────────────────────── */

/**
 * Top-level `type` values we intentionally drop without a warning. Anything
 * outside this list AND not matched by SessionEvent produces an "unknown
 * type" warning so format drift gets noticed.
 */
export const KNOWN_DROPPED_TYPES = new Set([
	'attachment',
	'file-history-snapshot',
	'permission-mode',
	'last-prompt',
	'queue-operation',
	'agent-name'
]);

/**
 * `system` subtypes we intentionally drop. Anything outside this list AND
 * not `compact_boundary` produces a warning.
 */
export const KNOWN_DROPPED_SYSTEM_SUBTYPES = new Set([
	'turn_duration',
	'stop_hook_summary',
	'local_command',
	'bridge_status',
	'away_summary'
]);
