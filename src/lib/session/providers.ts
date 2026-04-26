import {
	AssistantEvent,
	SessionEvent,
	type SessionEvent as LegacySessionEvent,
	type ToolResultBlockT,
	type UserEvent
} from './schema';
import {
	NORMALIZED_SESSION_FORMAT_VERSION,
	NormalizedSessionEvent,
	type SessionProvider,
	type ToolResultContent
} from './normalized-schema';

interface NormalizeOptions {
	provider?: SessionProvider;
	sourceSessionId?: string;
	rawPath?: string;
	importDate?: string;
}

export interface NormalizeResult {
	provider: SessionProvider;
	events: NormalizedSessionEvent[];
	kept: number;
	dropped: number;
}

function uuid(prefix: string, i: number): string {
	return `${prefix}-${i}`;
}

function makeHeader(options: NormalizeOptions): NormalizedSessionEvent {
	return {
		type: 'header',
		formatVersion: NORMALIZED_SESSION_FORMAT_VERSION,
		provider: options.provider ?? 'unknown',
		importDate: options.importDate ?? new Date().toISOString(),
		sourceSessionId: options.sourceSessionId,
		rawPath: options.rawPath
	};
}

function textFromContent(content: string | Array<{ type: string; text?: string }>): string {
	if (typeof content === 'string') return content;
	return content
		.filter((b) => b.type === 'text' && b.text)
		.map((b) => b.text)
		.join('\n');
}

export function detectProviderFromJsonl(rawText: string): SessionProvider {
	for (const line of rawText.split('\n')) {
		if (!line.trim()) continue;
		try {
			const obj = JSON.parse(line) as { type?: string; payload?: { type?: string } };
			if (obj.type === 'session_meta' || obj.type === 'event_msg' || obj.type === 'response_item')
				return 'codex';
			if (obj.type === 'user' || obj.type === 'assistant' || obj.type === 'system') return 'claude';
		} catch {
			continue;
		}
	}
	return 'unknown';
}

export function normalizeClaudeJsonl(rawText: string, options: NormalizeOptions = {}): NormalizeResult {
	const events: NormalizedSessionEvent[] = [
		makeHeader({ ...options, provider: options.provider ?? 'claude' })
	];
	let kept = 0;
	let dropped = 0;

	const lines = rawText.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		let raw: unknown;
		try {
			raw = JSON.parse(line);
		} catch {
			dropped++;
			continue;
		}
		const parsed = SessionEvent.safeParse(raw);
		if (!parsed.success) {
			dropped++;
			continue;
		}
		kept++;
		events.push(...legacyEventToNormalized(parsed.data, i));
	}

	return { provider: 'claude', events, kept, dropped };
}

function legacyEventToNormalized(e: LegacySessionEvent, index: number): NormalizedSessionEvent[] {
	switch (e.type) {
		case 'header':
			return [];
		case 'custom-title':
			return [{ type: 'custom-title', customTitle: e.customTitle }];
		case 'system':
			return [{
				type: 'compact-boundary',
				uuid: e.uuid,
				timestamp: e.timestamp,
				trigger: e.compactMetadata?.trigger,
				preTokens: e.compactMetadata?.preTokens
			}];
		case 'user':
			return legacyUserToNormalized(e, index);
		case 'assistant':
			return legacyAssistantToNormalized(e);
	}
}

function legacyUserToNormalized(e: UserEvent, index: number): NormalizedSessionEvent[] {
	const content = e.message.content;
	if (typeof content === 'string') {
		return [{
			type: 'user-message',
			uuid: e.uuid,
			timestamp: e.timestamp,
			text: content,
			isMeta: e.isMeta,
			startsRound: !e.isMeta
		}];
	}

	const out: NormalizedSessionEvent[] = [];
	for (let i = 0; i < content.length; i++) {
		const block = content[i];
		if (block.type === 'text') {
			out.push({
				type: 'user-message',
				uuid: `${e.uuid}-text-${i}`,
				timestamp: e.timestamp,
				text: block.text,
				isMeta: e.isMeta,
				startsRound: false
			});
		} else if (block.type === 'tool_result') {
			out.push({
				type: 'tool-result',
				uuid: `${e.uuid}-tool-result-${i}`,
				timestamp: e.timestamp,
				toolCallId: block.tool_use_id,
				content: block.content as ToolResultBlockT['content'],
				isError: block.is_error
			});
		}
	}
	if (out.length === 0) {
		out.push({
			type: 'user-message',
			uuid: uuid('legacy-user', index),
			timestamp: e.timestamp,
			text: textFromContent(content),
			isMeta: true,
			startsRound: false
		});
	}
	return out;
}

function legacyAssistantToNormalized(e: AssistantEvent): NormalizedSessionEvent[] {
	const out: NormalizedSessionEvent[] = [];
	for (let i = 0; i < e.message.content.length; i++) {
		const block = e.message.content[i];
		if (block.type === 'text') {
			out.push({
				type: 'assistant-message',
				uuid: `${e.uuid}-text-${i}`,
				timestamp: e.timestamp,
				text: block.text,
				model: e.message.model
			});
		} else if (block.type === 'thinking') {
			out.push({
				type: 'thinking',
				uuid: `${e.uuid}-thinking-${i}`,
				timestamp: e.timestamp,
				text: block.thinking
			});
		} else if (block.type === 'tool_use') {
			out.push({
				type: 'tool-call',
				uuid: `${e.uuid}-tool-call-${i}`,
				timestamp: e.timestamp,
				toolCallId: block.id,
				name: block.name,
				input: block.input
			});
		}
	}
	return out;
}

export function normalizeCodexJsonl(rawText: string, options: NormalizeOptions = {}): NormalizeResult {
	const rawEvents: unknown[] = [];
	let dropped = 0;
	for (const line of rawText.split('\n')) {
		if (!line.trim()) continue;
		try {
			rawEvents.push(JSON.parse(line));
		} catch {
			dropped++;
		}
	}

	const meta = rawEvents.find((e): e is { type: 'session_meta'; payload: { id?: string } } =>
		!!e && typeof e === 'object' && (e as { type?: string }).type === 'session_meta'
	);
	const sourceSessionId = options.sourceSessionId ?? meta?.payload?.id;
	const events: NormalizedSessionEvent[] = [
		makeHeader({ ...options, provider: 'codex', sourceSessionId })
	];

	const execResults = new Set<string>();
	const resultEvents = new Set<string>();
	for (const raw of rawEvents) {
		const e = raw as {
			timestamp?: string;
			type?: string;
			payload?: Record<string, unknown>;
		};
		if (e.type !== 'event_msg') continue;
		const payload = e.payload ?? {};
		const callId = typeof payload.call_id === 'string' ? payload.call_id : undefined;
		if (!callId) continue;
		if (payload.type === 'exec_command_end') execResults.add(callId);
		if (['exec_command_end', 'patch_apply_end', 'mcp_tool_call_end'].includes(String(payload.type))) {
			resultEvents.add(callId);
		}
	}

	let kept = 0;
	for (let i = 0; i < rawEvents.length; i++) {
		const raw = rawEvents[i] as {
			timestamp?: string;
			type?: string;
			payload?: Record<string, unknown>;
		};
		const converted = codexEventToNormalized(raw, i, execResults, resultEvents);
		if (converted.length > 0) {
			kept++;
			events.push(...converted);
		}
	}

	return { provider: 'codex', events, kept, dropped };
}

function codexEventToNormalized(
	e: { timestamp?: string; type?: string; payload?: Record<string, unknown> },
	index: number,
	execResults: Set<string>,
	resultEvents: Set<string>
): NormalizedSessionEvent[] {
	const p = e.payload ?? {};

	if (e.type === 'event_msg' && p.type === 'user_message' && typeof p.message === 'string') {
		return [{
			type: 'user-message',
			uuid: uuid('codex-user', index),
			timestamp: e.timestamp,
			text: p.message,
			startsRound: true
		}];
	}

	if (e.type === 'event_msg' && p.type === 'agent_message' && typeof p.message === 'string') {
		return [{
			type: 'assistant-message',
			uuid: uuid('codex-assistant', index),
			timestamp: e.timestamp,
			text: p.message
		}];
	}

	if (e.type === 'response_item' && p.type === 'function_call') {
		const callId = typeof p.call_id === 'string' ? p.call_id : uuid('codex-call', index);
		const name = typeof p.name === 'string' ? p.name : 'tool';
		return [{
			type: 'tool-call',
			uuid: uuid('codex-tool-call', index),
			timestamp: e.timestamp,
			toolCallId: callId,
			name,
			input: parseCodexArguments(p.arguments)
		}];
	}

	if (e.type === 'response_item' && p.type === 'custom_tool_call') {
		const callId = typeof p.call_id === 'string' ? p.call_id : uuid('codex-custom-call', index);
		const name = typeof p.name === 'string' ? p.name : 'custom_tool';
		return [{
			type: 'tool-call',
			uuid: uuid('codex-custom-tool-call', index),
			timestamp: e.timestamp,
			toolCallId: callId,
			name,
			input: { input: p.input ?? '' }
		}];
	}

	if (e.type === 'response_item' && p.type === 'tool_search_call') {
		const callId = typeof p.call_id === 'string' ? p.call_id : uuid('codex-tool-search', index);
		return [{
			type: 'tool-call',
			uuid: uuid('codex-tool-search-call', index),
			timestamp: e.timestamp,
			toolCallId: callId,
			name: 'tool_search',
			input: parseCodexArguments(p.arguments)
		}];
	}

	if (e.type === 'event_msg' && p.type === 'exec_command_end') {
		const callId = typeof p.call_id === 'string' ? p.call_id : undefined;
		if (!callId) return [];
		return [{
			type: 'tool-result',
			uuid: uuid('codex-tool-result', index),
			timestamp: e.timestamp,
			toolCallId: callId,
			content: codexExecOutput(p),
			isError: typeof p.exit_code === 'number' ? p.exit_code !== 0 : undefined
		}];
	}

	if (e.type === 'event_msg' && p.type === 'patch_apply_end') {
		const callId = typeof p.call_id === 'string' ? p.call_id : undefined;
		if (!callId) return [];
		return [{
			type: 'tool-result',
			uuid: uuid('codex-patch-result', index),
			timestamp: e.timestamp,
			toolCallId: callId,
			content: codexPatchOutput(p),
			isError: typeof p.success === 'boolean' ? !p.success : undefined
		}];
	}

	if (e.type === 'event_msg' && p.type === 'mcp_tool_call_end') {
		const callId = typeof p.call_id === 'string' ? p.call_id : undefined;
		if (!callId) return [];
		return [{
			type: 'tool-result',
			uuid: uuid('codex-mcp-result', index),
			timestamp: e.timestamp,
			toolCallId: callId,
			content: codexMcpOutput(p),
			isError: isMcpError(p)
		}];
	}

	if (e.type === 'response_item' && p.type === 'function_call_output') {
		const callId = typeof p.call_id === 'string' ? p.call_id : undefined;
		if (!callId || execResults.has(callId)) return [];
		return [{
			type: 'tool-result',
			uuid: uuid('codex-tool-output', index),
			timestamp: e.timestamp,
			toolCallId: callId,
			content: typeof p.output === 'string' ? p.output : JSON.stringify(p.output ?? '', null, 2)
		}];
	}

	if (e.type === 'response_item' && p.type === 'custom_tool_call_output') {
		const callId = typeof p.call_id === 'string' ? p.call_id : undefined;
		if (!callId || resultEvents.has(callId)) return [];
		return [{
			type: 'tool-result',
			uuid: uuid('codex-custom-tool-output', index),
			timestamp: e.timestamp,
			toolCallId: callId,
			content: typeof p.output === 'string' ? p.output : JSON.stringify(p.output ?? '', null, 2)
		}];
	}

	if (e.type === 'response_item' && p.type === 'tool_search_output') {
		const callId = typeof p.call_id === 'string' ? p.call_id : undefined;
		if (!callId) return [];
		const tools = Array.isArray(p.tools) ? p.tools : [];
		return [{
			type: 'tool-result',
			uuid: uuid('codex-tool-search-output', index),
			timestamp: e.timestamp,
			toolCallId: callId,
			content: `Found ${tools.length} tool namespace${tools.length === 1 ? '' : 's'}.`
		}];
	}

	return [];
}

function parseCodexArguments(value: unknown): Record<string, unknown> {
	if (!value) return {};
	if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
	if (typeof value !== 'string') return { value };
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? parsed as Record<string, unknown>
			: { value: parsed };
	} catch {
		return { value };
	}
}

function codexExecOutput(payload: Record<string, unknown>): ToolResultContent {
	const output = typeof payload.aggregated_output === 'string'
		? payload.aggregated_output
		: [payload.stdout, payload.stderr].filter((v) => typeof v === 'string').join('\n');
	return output;
}

function codexPatchOutput(payload: Record<string, unknown>): ToolResultContent {
	const stdout = typeof payload.stdout === 'string' ? payload.stdout : '';
	const stderr = typeof payload.stderr === 'string' ? payload.stderr : '';
	const changes = payload.changes && typeof payload.changes === 'object'
		? Object.entries(payload.changes as Record<string, { type?: string }>)
			.map(([path, change]) => `${change.type ?? 'change'} ${path}`)
			.join('\n')
		: '';
	return [stdout, stderr, changes].filter(Boolean).join('\n');
}

function codexMcpOutput(payload: Record<string, unknown>): ToolResultContent {
	const result = payload.result;
	if (!result || typeof result !== 'object') return '';
	const ok = 'Ok' in result ? (result as { Ok?: unknown }).Ok : undefined;
	const err = 'Err' in result ? (result as { Err?: unknown }).Err : undefined;
	if (ok && typeof ok === 'object' && 'content' in ok) {
		const content = (ok as { content?: unknown }).content;
		if (Array.isArray(content)) {
			return content
				.map((part) =>
					part && typeof part === 'object' && 'text' in part
						? String((part as { text?: unknown }).text ?? '')
						: JSON.stringify(part)
				)
				.join('\n');
		}
	}
	return JSON.stringify(err ?? ok ?? result, null, 2);
}

function isMcpError(payload: Record<string, unknown>): boolean | undefined {
	const result = payload.result;
	if (!result || typeof result !== 'object') return undefined;
	if ('Err' in result) return true;
	if ('Ok' in result) {
		const ok = (result as { Ok?: { isError?: unknown } }).Ok;
		return typeof ok?.isError === 'boolean' ? ok.isError : false;
	}
	return undefined;
}

export function normalizeSessionJsonl(rawText: string, options: NormalizeOptions = {}): NormalizeResult {
	const provider = options.provider && options.provider !== 'unknown'
		? options.provider
		: detectProviderFromJsonl(rawText);
	if (provider === 'codex') return normalizeCodexJsonl(rawText, options);
	return normalizeClaudeJsonl(rawText, { ...options, provider: 'claude' });
}
