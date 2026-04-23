#!/usr/bin/env tsx
/**
 * Merge a Claude Code JSONL session (and optional MCP trace files) into the
 * folder-based tutorial layout:
 *
 *   src/tutorials/<slug>/full-log/round-NN.yaml
 *   static/tutorials/<slug>/assets/<file>
 *
 * Usage:
 *   npx tsx scripts/merge-session.ts \
 *     --session src/tutorials/<slug>/session/<uuid>.jsonl \
 *     --out     src/tutorials/<slug>/
 *
 * This is Stage 1 of the pipeline — the user then curates `tutorial/round-*.yaml`
 * by hand (or with agent help). The merge script is idempotent w.r.t.
 * `full-log/` and the extracted assets. It never touches `tutorial/` or
 * `notes.md`.
 *
 * Heuristics are deliberately simple; curation is where the polish happens.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename, resolve, dirname } from 'node:path';
import yaml from 'js-yaml';

/* ─── CLI ────────────────────────────────────── */

interface Args {
	session: string;
	out: string;
	truncateLines: number;
}

function parseArgs(argv: string[]): Args {
	const args: Partial<Args> = { truncateLines: 100 };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--session') args.session = argv[++i];
		else if (a === '--out') args.out = argv[++i];
		else if (a === '--truncate-lines') args.truncateLines = parseInt(argv[++i], 10);
		else if (a === '--help' || a === '-h') {
			console.error(usage());
			process.exit(0);
		}
	}
	if (!args.session || !args.out) {
		console.error(usage());
		process.exit(1);
	}
	return args as Args;
}

function usage(): string {
	return `Usage: tsx scripts/merge-session.ts --session <path.jsonl> --out <tutorial-dir> [--truncate-lines N]`;
}

/* ─── JSONL entry shapes ─────────────────────── */

interface ContentBlock {
	type: string;
	text?: string;
	thinking?: string;
	name?: string;
	id?: string;
	input?: Record<string, unknown>;
	tool_use_id?: string;
	content?: string | ContentBlock[];
	source?: { type: 'base64'; media_type: string; data: string };
}

interface Entry {
	type: string;
	subtype?: string;
	isMeta?: boolean;
	message?: { role: string; content: string | ContentBlock[] };
	timestamp?: string;
	uuid?: string;
}

/* ─── Tutorial step output types ─────────────── */

type Step =
	| { type: 'thinking'; text: string; duration?: string }
	| { type: 'assistant'; html: string; final?: boolean }
	| { type: 'tool_call'; toolName: string; code: string }
	| { type: 'tool_result'; text: string; details?: string }
	| { type: 'window'; windowTitle: string; subtitle?: string; content: { kind: string; src: string; statusBar?: string } }
	| { type: 'output'; text: string; stream?: 'stdout' | 'stderr' }
	| { type: 'status'; text: string; variant?: 'success' | 'info' | 'warning' | 'error' };

interface Round {
	kind?: 'claude' | 'terminal';
	prompt: string;
	cwd?: string;
	steps: Step[];
}

/* ─── Parsing ────────────────────────────────── */

function readJsonl(path: string): Entry[] {
	const raw = readFileSync(path, 'utf-8');
	return raw
		.split('\n')
		.filter((l) => l.trim().length > 0)
		.map((l, i) => {
			try {
				return JSON.parse(l) as Entry;
			} catch (e) {
				throw new Error(`Line ${i + 1} is not valid JSON: ${(e as Error).message}`);
			}
		});
}

function isUserPrompt(e: Entry): boolean {
	if (e.type !== 'user') return false;
	if (e.isMeta) return false;
	const content = e.message?.content;
	if (typeof content !== 'string') return false;
	// Skip local-command wrappers (slash commands, /exit messages, etc.)
	if (content.startsWith('<command-name>')) return false;
	if (content.startsWith('<local-command-')) return false;
	return content.trim().length > 0;
}

function isToolResultUser(e: Entry): boolean {
	if (e.type !== 'user' || e.isMeta) return false;
	const content = e.message?.content;
	if (!Array.isArray(content)) return false;
	return content.some((b) => b.type === 'tool_result');
}

/* ─── Assistant content → steps ──────────────── */

function assistantBlocksToSteps(blocks: ContentBlock[]): Step[] {
	const steps: Step[] = [];
	let lastTextIdx = -1;
	for (const b of blocks) {
		if (b.type === 'thinking' && b.thinking) {
			steps.push({ type: 'thinking', text: b.thinking });
		} else if (b.type === 'text' && b.text) {
			lastTextIdx = steps.length;
			steps.push({ type: 'assistant', html: textToHtml(b.text) });
		} else if (b.type === 'tool_use' && b.name) {
			steps.push({
				type: 'tool_call',
				toolName: toolDisplayName(b.name),
				code: toolInputToCode(b.name, b.input ?? {})
			});
		}
	}
	if (lastTextIdx >= 0) {
		const step = steps[lastTextIdx] as { type: 'assistant'; html: string; final?: boolean };
		step.final = true;
	}
	return steps;
}

function textToHtml(t: string): string {
	// Minimal conversion: wrap paragraphs, preserve newlines. Curator can refine.
	const paragraphs = t.split(/\n\n+/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`);
	return paragraphs.join('');
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function toolDisplayName(name: string): string {
	// mcp__fiji-mcp__run_ij_macro → "fiji — run_ij_macro"
	const m = name.match(/^mcp__([^_]+)-mcp__(.+)$/);
	if (m) return `${m[1]} — ${m[2]}`;
	const m2 = name.match(/^mcp__(.+?)__(.+)$/);
	if (m2) return `${m2[1]} — ${m2[2]}`;
	return name;
}

function toolInputToCode(name: string, input: Record<string, unknown>): string {
	// For macro-style tools, prefer the primary code field as raw text; else JSON.
	if (name.includes('run_ij_macro') && typeof input.macro === 'string') return input.macro as string;
	if (name.includes('run_script') && typeof input.script === 'string') return input.script as string;
	if (name === 'Bash' && typeof input.command === 'string') return input.command as string;
	if (name === 'Edit' || name === 'Write') {
		return JSON.stringify(input, null, 2);
	}
	return JSON.stringify(input, null, 2);
}

/* ─── Tool results + assets ──────────────────── */

interface AssetRef {
	filename: string;
	data: Buffer;
}

function toolResultsToSteps(
	blocks: ContentBlock[],
	slug: string,
	assetDir: string,
	truncateLines: number,
	imageCounter: { n: number }
): { steps: Step[]; assets: AssetRef[] } {
	const steps: Step[] = [];
	const assets: AssetRef[] = [];
	for (const b of blocks) {
		if (b.type !== 'tool_result') continue;
		const content = b.content;
		if (typeof content === 'string') {
			steps.push(makeToolResult(content, truncateLines));
		} else if (Array.isArray(content)) {
			let combinedText = '';
			for (const sub of content) {
				if (sub.type === 'text' && sub.text) {
					combinedText += (combinedText ? '\n' : '') + sub.text;
				} else if (sub.type === 'image' && sub.source?.type === 'base64') {
					const ext = sub.source.media_type.split('/')[1] ?? 'png';
					imageCounter.n += 1;
					const filename = `extracted_${String(imageCounter.n).padStart(3, '0')}.${ext}`;
					assets.push({ filename, data: Buffer.from(sub.source.data, 'base64') });
					steps.push({
						type: 'window',
						windowTitle: filename,
						content: { kind: 'fiji-image', src: filename }
					});
				}
			}
			if (combinedText) steps.push(makeToolResult(combinedText, truncateLines));
		}
	}
	return { steps, assets };
}

function makeToolResult(text: string, truncateLines: number): Step {
	const lines = text.split('\n');
	if (lines.length > truncateLines) {
		const head = lines.slice(0, truncateLines).join('\n');
		const remaining = lines.length - truncateLines;
		return { type: 'tool_result', text: `${head}\n... [${remaining} more lines]` };
	}
	return { type: 'tool_result', text };
}

/* ─── Round assembly ─────────────────────────── */

function groupRounds(entries: Entry[]): Entry[][] {
	const rounds: Entry[][] = [];
	let current: Entry[] = [];
	let started = false;
	for (const e of entries) {
		if (isUserPrompt(e)) {
			if (started) rounds.push(current);
			current = [e];
			started = true;
		} else if (started && (e.type === 'assistant' || e.type === 'user')) {
			current.push(e);
		}
	}
	if (started && current.length > 0) rounds.push(current);
	return rounds;
}

function buildRound(
	entries: Entry[],
	slug: string,
	assetDir: string,
	truncateLines: number,
	imageCounter: { n: number }
): { round: Round; assets: AssetRef[] } {
	const promptEntry = entries[0];
	const promptText = promptEntry.message?.content as string;

	const steps: Step[] = [];
	const assets: AssetRef[] = [];

	for (const e of entries.slice(1)) {
		if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
			steps.push(...assistantBlocksToSteps(e.message!.content as ContentBlock[]));
		} else if (isToolResultUser(e)) {
			const { steps: resultSteps, assets: resultAssets } = toolResultsToSteps(
				e.message!.content as ContentBlock[],
				slug,
				assetDir,
				truncateLines,
				imageCounter
			);
			steps.push(...resultSteps);
			assets.push(...resultAssets);
		}
	}

	return {
		round: { prompt: promptText, steps },
		assets
	};
}

/* ─── YAML dump ──────────────────────────────── */

function dumpYaml(obj: unknown): string {
	return yaml.dump(obj, {
		lineWidth: 100,
		noRefs: true,
		noCompatMode: true,
		quotingType: '"',
		styles: { '!!str': 'plain' }
	});
}

/* ─── Main ───────────────────────────────────── */

function main() {
	const args = parseArgs(process.argv.slice(2));
	const sessionPath = resolve(args.session);
	const outDir = resolve(args.out);
	const slug = basename(outDir);

	const fullLogDir = join(outDir, 'full-log');
	const repoRoot = findRepoRoot(outDir);
	const assetDir = join(repoRoot, 'static', 'tutorials', slug, 'assets');

	mkdirSync(fullLogDir, { recursive: true });
	mkdirSync(assetDir, { recursive: true });

	console.error(`[merge] slug=${slug}`);
	console.error(`[merge] reading ${sessionPath}`);
	const entries = readJsonl(sessionPath);
	console.error(`[merge] ${entries.length} entries`);

	const roundGroups = groupRounds(entries);
	console.error(`[merge] ${roundGroups.length} rounds detected`);

	const imageCounter = { n: 0 };
	for (let i = 0; i < roundGroups.length; i++) {
		const { round, assets } = buildRound(roundGroups[i], slug, assetDir, args.truncateLines, imageCounter);
		const filename = `round-${String(i + 1).padStart(2, '0')}.yaml`;
		const path = join(fullLogDir, filename);
		writeFileSync(path, dumpYaml(round));
		for (const a of assets) {
			const assetPath = join(assetDir, a.filename);
			writeFileSync(assetPath, a.data);
		}
		console.error(`[merge] wrote ${filename} — ${round.steps.length} steps, ${assets.length} assets`);
	}
	console.error(`[merge] done`);
}

function findRepoRoot(start: string): string {
	let cur = resolve(start);
	while (cur !== dirname(cur)) {
		if (existsSync(join(cur, 'package.json'))) return cur;
		cur = dirname(cur);
	}
	throw new Error(`no package.json found walking up from ${start}`);
}

main();
