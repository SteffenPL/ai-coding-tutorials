#!/usr/bin/env tsx
/**
 * Filtered copy of a Claude Code session log.
 *
 * Reads a raw `~/.claude/projects/<proj>/<sessionId>.jsonl` (plus any
 * sidecar `<sessionId>/subagents/` folder) and writes a slimmed version
 * that keeps the same Claude JSONL shape but drops:
 *   - PII / bookkeeping fields (cwd, gitBranch, requestId, ...)
 *   - Noise entries (file-history-snapshot, attachment, permission-mode,
 *     most `system` subtypes)
 *   - Opaque or display-irrelevant inner fields (thinking signatures,
 *     token usage, tool caller metadata)
 *
 * The allowlist is the zod schema in src/lib/session/schema.ts — running
 * entries through `SessionEvent.safeParse()` does the filtering by virtue
 * of zod's default `.strip()` behavior on unknown keys.
 *
 * Usage:
 *   tsx scripts/import-session.ts --session <path.jsonl> --out <dir> [--dry-run]
 */

import { copyFileSync, readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename, dirname, resolve } from 'node:path';
import {
	SubagentMeta,
	SessionEvent,
	KNOWN_DROPPED_TYPES,
	KNOWN_DROPPED_SYSTEM_SUBTYPES
} from '../src/lib/session/schema.ts';
import {
	detectProviderFromJsonl,
	normalizeSessionJsonl
} from '../src/lib/session/providers.ts';
import type { SessionProvider } from '../src/lib/session/normalized-schema.ts';

/* ─── CLI ──────────────────────────────────────────────────────────────── */

interface Args {
	session: string;
	out: string;
	provider: SessionProvider | 'auto';
	dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
	const a: Partial<Args> = { dryRun: false, provider: 'auto' };
	for (let i = 0; i < argv.length; i++) {
		const x = argv[i];
		if (x === '--session') a.session = argv[++i];
		else if (x === '--out') a.out = argv[++i];
		else if (x === '--provider') {
			const provider = argv[++i];
			if (!['auto', 'claude', 'codex'].includes(provider)) {
				console.error(`Unknown provider '${provider}'`);
				process.exit(1);
			}
			a.provider = provider as Args['provider'];
		}
		else if (x === '--dry-run') a.dryRun = true;
		else if (x === '--help' || x === '-h') {
			console.error(usage());
			process.exit(0);
		}
	}
	if (!a.session || !a.out) {
		console.error(usage());
		process.exit(1);
	}
	return a as Args;
}

function usage(): string {
	return `Usage: tsx scripts/import-session.ts --session <path.jsonl> --out <dir> [--provider auto|claude|codex] [--dry-run]

Reads the given session .jsonl and any sibling <uuid>/subagents/ folder.
Copies the raw input to <out>/raw/ and writes a normalized <out>/session.jsonl.`;
}

/* ─── Stats ────────────────────────────────────────────────────────────── */

interface Stats {
	kept: Map<string, number>;
	droppedQuiet: Map<string, number>;
	droppedWarn: Map<string, number>;
	firstErrors: Map<string, string>;
}

function blankStats(): Stats {
	return {
		kept: new Map(),
		droppedQuiet: new Map(),
		droppedWarn: new Map(),
		firstErrors: new Map()
	};
}

function bump(m: Map<string, number>, k: string) {
	m.set(k, (m.get(k) ?? 0) + 1);
}

function entryKey(raw: unknown): string {
	if (!raw || typeof raw !== 'object') return 'non-object';
	const o = raw as Record<string, unknown>;
	const t = typeof o.type === 'string' ? o.type : 'missing-type';
	if (t === 'system' && typeof o.subtype === 'string') return `system/${o.subtype}`;
	return t;
}

function isKnownQuietDrop(raw: unknown): boolean {
	if (!raw || typeof raw !== 'object') return false;
	const o = raw as Record<string, unknown>;
	if (typeof o.type !== 'string') return false;
	if (KNOWN_DROPPED_TYPES.has(o.type)) return true;
	if (
		o.type === 'system' &&
		typeof o.subtype === 'string' &&
		KNOWN_DROPPED_SYSTEM_SUBTYPES.has(o.subtype)
	)
		return true;
	return false;
}

/* ─── Core filter ──────────────────────────────────────────────────────── */

function filterJsonl(rawText: string, stats: Stats): string[] {
	const outLines: string[] = [];
	const lines = rawText.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		let raw: unknown;
		try {
			raw = JSON.parse(line);
		} catch {
			bump(stats.droppedWarn, 'invalid-json');
			if (!stats.firstErrors.has('invalid-json')) {
				stats.firstErrors.set('invalid-json', `line ${i + 1}: not valid JSON`);
			}
			continue;
		}
		const key = entryKey(raw);
		const result = SessionEvent.safeParse(raw);
		if (result.success) {
			outLines.push(JSON.stringify(result.data));
			bump(stats.kept, key);
		} else if (isKnownQuietDrop(raw)) {
			bump(stats.droppedQuiet, key);
		} else {
			bump(stats.droppedWarn, key);
			if (!stats.firstErrors.has(key)) {
				const issue = result.error.issues[0];
				const path = issue?.path?.join('.') ?? '';
				stats.firstErrors.set(key, `${issue?.message ?? 'unknown'} at ${path || '(root)'} [line ${i + 1}]`);
			}
		}
	}
	return outLines;
}

/* ─── Subagent discovery ───────────────────────────────────────────────── */

interface SubagentFile {
	agentId: string;
	jsonlPath: string;
	metaPath: string | null;
}

function findSubagentFolder(sessionPath: string): string | null {
	const dir = dirname(sessionPath);
	const uuid = basename(sessionPath, '.jsonl');
	const candidate = join(dir, uuid, 'subagents');
	return existsSync(candidate) && statSync(candidate).isDirectory() ? candidate : null;
}

function listSubagents(folder: string): SubagentFile[] {
	const entries = readdirSync(folder);
	const byId = new Map<string, SubagentFile>();
	for (const name of entries) {
		const m = name.match(/^agent-([^.]+)\.(jsonl|meta\.json)$/);
		if (!m) continue;
		const agentId = m[1];
		const rec = byId.get(agentId) ?? { agentId, jsonlPath: '', metaPath: null };
		if (m[2] === 'jsonl') rec.jsonlPath = join(folder, name);
		else rec.metaPath = join(folder, name);
		byId.set(agentId, rec);
	}
	return Array.from(byId.values()).filter((r) => r.jsonlPath);
}

function filterMeta(path: string): string | null {
	const raw = JSON.parse(readFileSync(path, 'utf-8'));
	const result = SubagentMeta.safeParse(raw);
	if (!result.success) {
		console.error(`[import] WARN subagent meta ${basename(path)}: ${result.error.issues[0]?.message}`);
		return null;
	}
	return JSON.stringify(result.data);
}

/* ─── Reporting ────────────────────────────────────────────────────────── */

function formatCounts(m: Map<string, number>): string {
	if (m.size === 0) return '  (none)';
	const rows = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
	const pad = Math.max(...rows.map(([k]) => k.length));
	return rows.map(([k, v]) => `  ${k.padEnd(pad)}  ${v}`).join('\n');
}

function reportStats(label: string, stats: Stats) {
	const totalKept = sum(stats.kept);
	const totalQuiet = sum(stats.droppedQuiet);
	const totalWarn = sum(stats.droppedWarn);
	console.error(`\n[import] ${label}:  kept ${totalKept}, dropped ${totalQuiet + totalWarn}`);
	console.error('  kept by type:');
	console.error(formatCounts(stats.kept));
	if (totalQuiet > 0) {
		console.error('  dropped (expected):');
		console.error(formatCounts(stats.droppedQuiet));
	}
	if (totalWarn > 0) {
		console.error('  dropped (UNEXPECTED — check schema):');
		console.error(formatCounts(stats.droppedWarn));
		for (const [k, msg] of stats.firstErrors) {
			console.error(`    first '${k}' error: ${msg}`);
		}
	}
}

function sum(m: Map<string, number>): number {
	let s = 0;
	for (const v of m.values()) s += v;
	return s;
}

/* ─── Main ─────────────────────────────────────────────────────────────── */

function main() {
	const args = parseArgs(process.argv.slice(2));
	const sessionPath = resolve(args.session);
	const outDir = resolve(args.out);
	const sessionId = basename(sessionPath, '.jsonl');

	if (!existsSync(sessionPath)) {
		console.error(`[import] session file not found: ${sessionPath}`);
		process.exit(1);
	}

	console.error(`[import] session: ${sessionPath}`);
	console.error(`[import] out:     ${outDir}${args.dryRun ? '  (dry run)' : ''}`);

	/* Main file */
	const rawText = readFileSync(sessionPath, 'utf-8');
	const provider = args.provider === 'auto' ? detectProviderFromJsonl(rawText) : args.provider;
	const rawRelPath = `raw/${basename(sessionPath)}`;
	const normalized = normalizeSessionJsonl(rawText, {
		provider,
		sourceSessionId: sessionId,
		rawPath: rawRelPath
	});
	console.error(`[import] provider: ${normalized.provider}`);
	console.error(`[import] normalized main: kept ${normalized.kept}, dropped ${normalized.dropped}`);

	if (!args.dryRun) {
		mkdirSync(outDir, { recursive: true });
		const rawDir = join(outDir, 'raw');
		mkdirSync(rawDir, { recursive: true });
		copyFileSync(sessionPath, join(rawDir, basename(sessionPath)));
		writeFileSync(
			join(outDir, 'session.jsonl'),
			normalized.events.map((e) => JSON.stringify(e)).join('\n') + '\n',
			'utf-8'
		);
	}

	/* Subagents */
	const subFolder = findSubagentFolder(sessionPath);
	if (subFolder && normalized.provider === 'claude') {
		const subs = listSubagents(subFolder);
		console.error(`\n[import] found ${subs.length} subagent(s) in ${subFolder}`);
		const outSubDir = join(outDir, 'session', 'subagents');
		const rawSubDir = join(outDir, 'raw', sessionId, 'subagents');
		if (!args.dryRun) {
			mkdirSync(outSubDir, { recursive: true });
			mkdirSync(rawSubDir, { recursive: true });
		}

		for (const s of subs) {
			const subRawText = readFileSync(s.jsonlPath, 'utf-8');
			const sub = normalizeSessionJsonl(subRawText, {
				provider: 'claude',
				sourceSessionId: s.agentId,
				rawPath: `raw/${sessionId}/subagents/${basename(s.jsonlPath)}`
			});
			console.error(`[import] normalized subagent ${s.agentId}: kept ${sub.kept}, dropped ${sub.dropped}`);
			if (!args.dryRun) {
				copyFileSync(s.jsonlPath, join(rawSubDir, basename(s.jsonlPath)));
				writeFileSync(
					join(outSubDir, `agent-${s.agentId}.jsonl`),
					sub.events.map((e) => JSON.stringify(e)).join('\n') + '\n',
					'utf-8'
				);
				if (s.metaPath) {
					const meta = filterMeta(s.metaPath);
					if (meta) {
						copyFileSync(s.metaPath, join(rawSubDir, basename(s.metaPath)));
						writeFileSync(join(outSubDir, `agent-${s.agentId}.meta.json`), meta + '\n');
					}
				}
			}
		}
	} else {
		console.error('\n[import] no subagent folder found (session had no Agent calls, or was older)');
	}

	console.error('\n[import] done');
}

main();
