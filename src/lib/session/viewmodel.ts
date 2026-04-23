/**
 * Pure transformation: LoadedSession → SessionView.
 *
 * Structure the viewer consumes:
 *   SessionView
 *     ├─ preamble: DisplayNode[]        (events before the first round)
 *     ├─ rounds:   Round[]              (one per user string-prompt)
 *     │    ├─ prompt
 *     │    └─ nodes: DisplayNode[]      (assistant turns, tools, ... )
 *     ├─ orphanSubagents: SubagentView[]
 *     └─ stats
 *
 * Tool pairing: assistant `tool_use` blocks and their paired user
 * `tool_result` blocks merge into a single `ToolInvocation` node. Subagents
 * (when the tool was `Agent`) attach to the same node. Unpaired tool
 * results become `user-text`-like orphan nodes so nothing disappears.
 *
 * Indentation depth is not computed here — the render walk threads a
 * `depth` prop through snippets, starting at 0 for round prompts.
 */

import type { LoadedSession, LoadedSubagent } from './loader';
import type { SessionEvent, ToolResultBlockT, UserEvent } from './schema';

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface ToolInvocationResult {
	content: ToolResultBlockT['content'];
	isError: boolean;
}

export type DisplayNode =
	| { kind: 'user-text'; uuid: string; text: string }
	| {
			kind: 'tool-invocation';
			uuid: string;
			toolUseId: string;
			name: string;
			input: Record<string, unknown>;
			result?: ToolInvocationResult;
			subagent?: SubagentView;
	  }
	| { kind: 'assistant-text'; uuid: string; text: string; model?: string; isFinal?: boolean }
	| { kind: 'thinking'; uuid: string; text: string }
	| { kind: 'compact'; uuid: string; trigger?: string; preTokens?: number };

export interface SubagentView {
	agentId: string;
	agentType: string;
	description: string;
	nodes: DisplayNode[];
}

/**
 * User prompts fall into several kinds. Only `normal` is a real human
 * turn — the rest are synthetic/injected content that the viewer should
 * render compactly by default.
 *
 * - `normal`              — a real prompt the user typed
 * - `slash`               — wrapped in <command-name>/foo</command-name>
 * - `command-output`      — <local-command-stdout>…</local-command-stdout>
 *                           (output of a slash command, e.g. /context)
 * - `compaction-summary`  — post-/compact resume message ("This session
 *                           is being continued from a previous …")
 * - `skill-injection`     — skill payload injected as a user message
 *                           (looks like `<skill>` or `<SUPERPOWERS>` …);
 *                           future-proofing — not observed in this project
 *                           yet but known from superpowers-style skills
 * - `meta`                — isMeta: true OR <local-command-caveat>…
 */
export type PromptKind =
	| 'normal'
	| 'slash'
	| 'command-output'
	| 'compaction-summary'
	| 'skill-injection'
	| 'meta';

export interface RoundPrompt {
	uuid: string;
	text: string;
	kind: PromptKind;
	/** Back-compat convenience flags derived from `kind`. */
	isMeta: boolean;
	slashCommand: boolean;
}

function classifyPromptKind(text: string, rawIsMeta: boolean): PromptKind {
	if (rawIsMeta) return 'meta';
	if (text.startsWith('<command-name>')) return 'slash';
	if (text.startsWith('<local-command-caveat>')) return 'meta';
	if (text.startsWith('<local-command-stdout>')) return 'command-output';
	if (text.startsWith('This session is being continued from a previous conversation'))
		return 'compaction-summary';
	// Skill injections — defensive pattern set covering known wrappers.
	if (/^<(skill|SKILL|superpowers|SUPERPOWERS|SKILL_INJECTION)\b/.test(text))
		return 'skill-injection';
	return 'normal';
}

export interface Round {
	anchor: string; // "r1", "r2", ... — for scroll-to
	index: number; // 1-based
	prompt: RoundPrompt;
	nodes: DisplayNode[];
}

export interface SessionStats {
	rounds: number;
	assistantMessages: number;
	toolInvocations: number;
	thinkingBlocks: number;
	subagents: number;
	compactions: number;
}

export interface SessionView {
	slug: string;
	sessionId: string;
	customTitle?: string;
	preamble: DisplayNode[];
	rounds: Round[];
	orphanSubagents: SubagentView[];
	stats: SessionStats;
}

/* ─── Tool pairing map ──────────────────────────────────────────────────── */

interface ToolResultIndex {
	/** tool_use_id → result content (paired from subsequent user event). */
	byId: Map<string, ToolInvocationResult>;
	/** tool_use_id → agentId (for Agent calls). */
	agentByToolId: Map<string, string>;
}

function indexToolResults(allEventStreams: SessionEvent[][]): ToolResultIndex {
	const byId = new Map<string, ToolInvocationResult>();
	const agentByToolId = new Map<string, string>();
	for (const stream of allEventStreams) {
		for (const e of stream) {
			if (e.type !== 'user') continue;
			if (!Array.isArray(e.message.content)) continue;
			const agentId = e.toolUseResult?.agentId;
			for (const block of e.message.content) {
				if (block.type !== 'tool_result') continue;
				byId.set(block.tool_use_id, {
					content: block.content,
					isError: block.is_error ?? false
				});
				if (agentId) agentByToolId.set(block.tool_use_id, agentId);
			}
		}
	}
	return { byId, agentByToolId };
}

/* ─── Event → node(s) ───────────────────────────────────────────────────── */

function renderUserEvent(e: UserEvent): DisplayNode[] {
	const out: DisplayNode[] = [];
	const content = e.message.content;
	// String-content user events are round prompts — handled by the round
	// splitter, not here. This function is only called for array-content users.
	if (typeof content === 'string') return out;
	for (const block of content) {
		if (block.type === 'tool_result') {
			// Absorbed into the paired ToolInvocation node, skip.
			continue;
		}
		if (block.type === 'text') {
			out.push({ kind: 'user-text', uuid: e.uuid, text: block.text });
		}
	}
	return out;
}

function eventsToNodes(
	events: SessionEvent[],
	index: ToolResultIndex,
	subagents: Record<string, LoadedSubagent>,
	visitedAgents: Set<string>
): DisplayNode[] {
	const nodes: DisplayNode[] = [];
	for (const e of events) {
		switch (e.type) {
			case 'user':
				// String-content is a round boundary and handled above us;
				// array-content gets its text/tool_result blocks processed.
				if (typeof e.message.content !== 'string') {
					nodes.push(...renderUserEvent(e));
				}
				break;
			case 'assistant': {
				const model = e.message.model;
				for (const block of e.message.content) {
					if (block.type === 'text') {
						nodes.push({ kind: 'assistant-text', uuid: e.uuid, text: block.text, model });
					} else if (block.type === 'thinking') {
						nodes.push({ kind: 'thinking', uuid: e.uuid, text: block.thinking });
					} else if (block.type === 'tool_use') {
						const result = index.byId.get(block.id);
						const agentId = index.agentByToolId.get(block.id);
						let subagentView: SubagentView | undefined;
						if (agentId && subagents[agentId] && !visitedAgents.has(agentId)) {
							visitedAgents.add(agentId);
							subagentView = buildSubagentView(
								subagents[agentId],
								index,
								subagents,
								visitedAgents
							);
						}
						nodes.push({
							kind: 'tool-invocation',
							uuid: e.uuid,
							toolUseId: block.id,
							name: block.name,
							input: block.input,
							result,
							subagent: subagentView
						});
					}
				}
				break;
			}
			case 'system':
				nodes.push({
					kind: 'compact',
					uuid: e.uuid,
					trigger: e.compactMetadata?.trigger,
					preTokens: e.compactMetadata?.preTokens
				});
				break;
			case 'custom-title':
				// Handled at session header level.
				break;
		}
	}
	return nodes;
}

function buildSubagentView(
	sub: LoadedSubagent,
	index: ToolResultIndex,
	subagents: Record<string, LoadedSubagent>,
	visitedAgents: Set<string>
): SubagentView {
	return {
		agentId: sub.agentId,
		agentType: sub.meta.agentType,
		description: sub.meta.description,
		nodes: eventsToNodes(sub.events, index, subagents, visitedAgents)
	};
}

/* ─── Round splitting ───────────────────────────────────────────────────── */

/**
 * A user event is a round boundary iff its content is a plain string AND
 * it's not a meta wrapper (<local-command-caveat>, etc). Meta entries
 * annotate the round they appear in rather than starting a new one.
 */
function isRoundBoundary(e: SessionEvent): boolean {
	if (e.type !== 'user') return false;
	if (e.isMeta) return false;
	return typeof e.message.content === 'string';
}

function splitIntoRounds(
	events: SessionEvent[],
	index: ToolResultIndex,
	subagents: Record<string, LoadedSubagent>,
	visitedAgents: Set<string>
): { preamble: DisplayNode[]; rounds: Round[] } {
	const preambleEvents: SessionEvent[] = [];
	const roundGroups: { promptEvent: UserEvent; events: SessionEvent[] }[] = [];
	let current: { promptEvent: UserEvent; events: SessionEvent[] } | null = null;

	for (const e of events) {
		if (isRoundBoundary(e) && e.type === 'user') {
			current = { promptEvent: e, events: [] };
			roundGroups.push(current);
		} else if (current) {
			current.events.push(e);
		} else {
			preambleEvents.push(e);
		}
	}

	const preamble = eventsToNodes(preambleEvents, index, subagents, visitedAgents);
	const rounds: Round[] = roundGroups.map((group, i) => {
		const text =
			typeof group.promptEvent.message.content === 'string'
				? group.promptEvent.message.content
				: '';
		const rawIsMeta = group.promptEvent.isMeta ?? false;
		const kind = classifyPromptKind(text, rawIsMeta);
		return {
			anchor: `r${i + 1}`,
			index: i + 1,
			prompt: {
				uuid: group.promptEvent.uuid,
				text,
				kind,
				isMeta: kind === 'meta',
				slashCommand: kind === 'slash'
			},
			nodes: eventsToNodes(group.events, index, subagents, visitedAgents)
		};
	});

	return { preamble, rounds };
}

/* ─── Stats ─────────────────────────────────────────────────────────────── */

function computeStats(rounds: Round[], orphans: SubagentView[]): SessionStats {
	const s: SessionStats = {
		rounds: rounds.length,
		assistantMessages: 0,
		toolInvocations: 0,
		thinkingBlocks: 0,
		subagents: 0,
		compactions: 0
	};
	const walk = (nodes: DisplayNode[]) => {
		for (const n of nodes) {
			switch (n.kind) {
				case 'assistant-text':
					s.assistantMessages++;
					break;
				case 'tool-invocation':
					s.toolInvocations++;
					if (n.subagent) {
						s.subagents++;
						walk(n.subagent.nodes);
					}
					break;
				case 'thinking':
					s.thinkingBlocks++;
					break;
				case 'compact':
					s.compactions++;
					break;
			}
		}
	};
	for (const r of rounds) walk(r.nodes);
	for (const o of orphans) {
		s.subagents++;
		walk(o.nodes);
	}
	return s;
}

/* ─── Public ────────────────────────────────────────────────────────────── */

export function toSessionView(session: LoadedSession): SessionView {
	const allStreams: SessionEvent[][] = [
		session.events,
		...Object.values(session.subagents).map((s) => s.events)
	];
	const index = indexToolResults(allStreams);
	const visited = new Set<string>();

	const { preamble, rounds } = splitIntoRounds(
		session.events,
		index,
		session.subagents,
		visited
	);

	// Mark the last assistant-text in each round as `isFinal` — used by the
	// "overview" detail level to show only prompts + final answers.
	for (const round of rounds) {
		for (let i = round.nodes.length - 1; i >= 0; i--) {
			const n = round.nodes[i];
			if (n.kind === 'assistant-text') {
				round.nodes[i] = { ...n, isFinal: true };
				break;
			}
		}
	}

	const orphanSubagents: SubagentView[] = [];
	for (const [agentId, sub] of Object.entries(session.subagents)) {
		if (visited.has(agentId)) continue;
		orphanSubagents.push(buildSubagentView(sub, index, session.subagents, visited));
	}

	return {
		slug: session.slug,
		sessionId: session.sessionId,
		customTitle: session.customTitle,
		preamble,
		rounds,
		orphanSubagents,
		stats: computeStats(rounds, orphanSubagents)
	};
}
