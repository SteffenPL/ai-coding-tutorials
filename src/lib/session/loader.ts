/**
 * Loads filtered Claude Code session logs from `src/tutorials/<slug>/session/`.
 *
 * Layout expected (produced by scripts/import-session.ts):
 *   src/tutorials/<slug>/session/<sessionId>.jsonl
 *   src/tutorials/<slug>/session/<sessionId>/subagents/agent-<agentId>.jsonl
 *   src/tutorials/<slug>/session/<sessionId>/subagents/agent-<agentId>.meta.json
 *
 * JSONL / JSON files are pulled in via Vite's `import.meta.glob('?raw')` so
 * they are bundled statically at build time (matches the pattern already used
 * by `tutorial-loader.ts`).
 *
 * Each line is validated with `SessionEvent.safeParse`. Invalid lines are
 * reported to the console but not fatal — the filtered files on disk were
 * already produced by the same schema, so validation here is a safety net
 * (e.g., if someone hand-edited one).
 */

import {
	SubagentMeta,
	type SubagentMeta as TSubagentMeta
} from './schema';
import {
	NormalizedSessionEvent,
	type NormalizedSessionEvent as TSessionEvent
} from './normalized-schema';
import { normalizeClaudeJsonl } from './providers';

/* ─── Vite globs ────────────────────────────────────────────────────────── */

const mainJsonlFromTutorials = import.meta.glob('/src/tutorials/*/session/*.jsonl', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const mainJsonlFromSessions = import.meta.glob('/src/sessions/*/*.jsonl', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const mainJsonlRaw = { ...mainJsonlFromTutorials, ...mainJsonlFromSessions };

const subagentJsonlFromTutorials = import.meta.glob(
	'/src/tutorials/*/session/*/subagents/agent-*.jsonl',
	{ eager: true, query: '?raw', import: 'default' }
) as Record<string, string>;

const subagentJsonlFromSessions = import.meta.glob(
	'/src/sessions/*/*/subagents/agent-*.jsonl',
	{ eager: true, query: '?raw', import: 'default' }
) as Record<string, string>;

const subagentJsonlRaw = { ...subagentJsonlFromTutorials, ...subagentJsonlFromSessions };

const subagentMetaFromTutorials = import.meta.glob(
	'/src/tutorials/*/session/*/subagents/agent-*.meta.json',
	{ eager: true, query: '?raw', import: 'default' }
) as Record<string, string>;

const subagentMetaFromSessions = import.meta.glob(
	'/src/sessions/*/*/subagents/agent-*.meta.json',
	{ eager: true, query: '?raw', import: 'default' }
) as Record<string, string>;

const subagentMetaRaw = { ...subagentMetaFromTutorials, ...subagentMetaFromSessions };

/* ─── Types ─────────────────────────────────────────────────────────────── */

export interface LoadedSubagent {
	agentId: string;
	meta: TSubagentMeta;
	events: TSessionEvent[];
}

export interface LoadedSession {
	slug: string;
	sessionId: string;
	customTitle?: string;
	events: TSessionEvent[];
	/** Keyed by agentId. Subagent events reference their agentId via the
	 *  paired tool_result's toolUseResult.agentId on the main-session side. */
	subagents: Record<string, LoadedSubagent>;
}

/* ─── Path parsing ──────────────────────────────────────────────────────── */

function parseMainPath(path: string): { slug: string; sessionId: string } | null {
	const m = path.match(/\/src\/tutorials\/([^/]+)\/session\/([^/]+)\.jsonl$/) ??
		path.match(/\/src\/sessions\/([^/]+)\/([^/]+)\.jsonl$/);
	if (!m) return null;
	const sessionId = m[2] === 'session' ? 'session' : m[2];
	return { slug: m[1], sessionId };
}

function parseSubagentPath(
	path: string
): { slug: string; sessionId: string; agentId: string } | null {
	const m = path.match(
		/\/src\/tutorials\/([^/]+)\/session\/([^/]+)\/subagents\/agent-([^.]+)\.jsonl$/
	) ?? path.match(
		/\/src\/sessions\/([^/]+)\/([^/]+)\/subagents\/agent-([^.]+)\.jsonl$/
	);
	if (!m) return null;
	return { slug: m[1], sessionId: m[2], agentId: m[3] };
}

function parseSubagentMetaPath(
	path: string
): { slug: string; sessionId: string; agentId: string } | null {
	const m = path.match(
		/\/src\/tutorials\/([^/]+)\/session\/([^/]+)\/subagents\/agent-([^.]+)\.meta\.json$/
	) ?? path.match(
		/\/src\/sessions\/([^/]+)\/([^/]+)\/subagents\/agent-([^.]+)\.meta\.json$/
	);
	if (!m) return null;
	return { slug: m[1], sessionId: m[2], agentId: m[3] };
}

/* ─── Parsing ───────────────────────────────────────────────────────────── */

interface ParsedJsonl {
	events: TSessionEvent[];
	formatVersion?: string;
}

function parseJsonl(raw: string, source: string): ParsedJsonl {
	const events: TSessionEvent[] = [];
	let formatVersion: string | undefined;
	const lines = raw.split('\n');
	let sawHeader = false;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		let obj: unknown;
		try {
			obj = JSON.parse(line);
		} catch {
			console.warn(`[session loader] ${source}:${i + 1} — invalid JSON, skipped`);
			continue;
		}
		const result = NormalizedSessionEvent.safeParse(obj);
		if (result.success) {
			if (result.data.type === 'header') {
				sawHeader = true;
				formatVersion = result.data.formatVersion;
				if (formatVersion.startsWith('1.')) {
					return parseLegacyClaudeJsonl(raw, source);
				}
				if (!formatVersion.startsWith('2.')) {
					console.warn(`[session loader] ${source} — unknown formatVersion "${formatVersion}"`);
				}
			} else {
				events.push(result.data);
			}
		} else {
			break;
		}
	}
	if (!sawHeader || events.length === 0) {
		return parseLegacyClaudeJsonl(raw, source);
	}
	return { events, formatVersion };
}

function parseLegacyClaudeJsonl(raw: string, source: string): ParsedJsonl {
	const normalized = normalizeClaudeJsonl(raw, { rawPath: source });
	if (normalized.dropped > 0) {
		console.warn(`[session loader] ${source} — migrated legacy Claude log, dropped ${normalized.dropped} lines`);
	}
	const events = normalized.events.filter((e) => e.type !== 'header');
	return { events, formatVersion: '1.x-legacy' };
}

function parseMeta(raw: string, source: string): TSubagentMeta | null {
	try {
		const obj = JSON.parse(raw);
		const r = SubagentMeta.safeParse(obj);
		if (r.success) return r.data;
		console.warn(`[session loader] ${source} — ${r.error.issues[0]?.message}`);
	} catch {
		console.warn(`[session loader] ${source} — invalid JSON`);
	}
	return null;
}

/* ─── Assembly ──────────────────────────────────────────────────────────── */

interface SlugBucket {
	slug: string;
	sessionId: string;
	mainPath: string;
	mainRaw: string;
	subagentJsonl: Map<string, string>; // agentId → raw
	subagentMeta: Map<string, string>; // agentId → raw
}

const buckets = new Map<string, SlugBucket>();

for (const [path, raw] of Object.entries(mainJsonlRaw)) {
	const parsed = parseMainPath(path);
	if (!parsed) continue;
	// One session per slug for now; if a slug has multiple .jsonl files, the
	// first one alphabetically wins and a warning is emitted.
	const existing = buckets.get(parsed.slug);
	if (existing) {
		if (parsed.sessionId === 'session' && existing.sessionId !== 'session') {
			buckets.set(parsed.slug, {
				slug: parsed.slug,
				sessionId: parsed.sessionId,
				mainPath: path,
				mainRaw: raw,
				subagentJsonl: new Map(),
				subagentMeta: new Map()
			});
			continue;
		}
		console.warn(
			`[session loader] slug '${parsed.slug}' has multiple session .jsonl files; ` +
				`using '${existing.sessionId}', ignoring '${parsed.sessionId}'`
		);
		continue;
	}
	buckets.set(parsed.slug, {
		slug: parsed.slug,
		sessionId: parsed.sessionId,
		mainPath: path,
		mainRaw: raw,
		subagentJsonl: new Map(),
		subagentMeta: new Map()
	});
}

for (const [path, raw] of Object.entries(subagentJsonlRaw)) {
	const parsed = parseSubagentPath(path);
	if (!parsed) continue;
	const bucket = buckets.get(parsed.slug);
	if (!bucket || bucket.sessionId !== parsed.sessionId) continue;
	bucket.subagentJsonl.set(parsed.agentId, raw);
}

for (const [path, raw] of Object.entries(subagentMetaRaw)) {
	const parsed = parseSubagentMetaPath(path);
	if (!parsed) continue;
	const bucket = buckets.get(parsed.slug);
	if (!bucket || bucket.sessionId !== parsed.sessionId) continue;
	bucket.subagentMeta.set(parsed.agentId, raw);
}

/* ─── Public API ────────────────────────────────────────────────────────── */

function buildSession(bucket: SlugBucket): LoadedSession {
	const { events } = parseJsonl(bucket.mainRaw, bucket.mainPath);

	const customTitle = events.find((e) => e.type === 'custom-title')?.customTitle;

	const subagents: Record<string, LoadedSubagent> = {};
	for (const [agentId, jsonlRaw] of bucket.subagentJsonl) {
		const metaRaw = bucket.subagentMeta.get(agentId);
		const meta = metaRaw
			? parseMeta(metaRaw, `subagent meta ${agentId}`)
			: null;
		subagents[agentId] = {
			agentId,
			meta: meta ?? { agentType: 'unknown', description: '' },
			events: parseJsonl(jsonlRaw, `subagent ${agentId}`).events
		};
	}

	return {
		slug: bucket.slug,
		sessionId: bucket.sessionId,
		customTitle,
		events,
		subagents
	};
}

export function getAllSessionSlugs(): string[] {
	return Array.from(buckets.keys()).sort();
}

export function getSessionBySlug(slug: string): LoadedSession | undefined {
	const bucket = buckets.get(slug);
	return bucket ? buildSession(bucket) : undefined;
}
