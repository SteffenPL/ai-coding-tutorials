#!/usr/bin/env tsx
/**
 * Generate a complete tutorial folder from a Claude Code JSONL session.
 *
 * Produces:
 *   src/tutorials/<slug>/meta.yaml
 *   src/tutorials/<slug>/tutorial/round-NN.yaml    (curated — from spec)
 *   src/tutorials/<slug>/full-log/round-NN.yaml    (unabridged)
 *   static/tutorials/<slug>/assets/*               (extracted images)
 *
 * Two modes:
 *
 *   --inspect   Print the session structure (round index, step index, type,
 *               summary) as JSON so an agent can decide what to include.
 *
 *   --generate  Read a spec YAML (--spec <path>) that declares which steps
 *               to include in the curated tutorial layer, what comments to
 *               attach, and tutorial metadata. Writes all output files.
 *
 * Usage:
 *   tsx scripts/session-to-tutorial.ts inspect  --session <path.jsonl>
 *   tsx scripts/session-to-tutorial.ts generate --session <path.jsonl> --spec <spec.yaml> [--out <slug>]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import yaml from 'js-yaml';

/* ─── JSONL types ────────────────────────────── */

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

/* ─── Tutorial step types ────────────────────── */

type Step = Record<string, unknown>;

interface Round {
	kind?: 'claude' | 'terminal';
	prompt: string;
	cwd?: string;
	steps: Step[];
}

/* ─── Spec types ─────────────────────────────── */

interface StepSpec {
	round: number;
	step: number;
	comment?: { en: string; ja?: string } | string;
	compact?: boolean;
	hidden?: boolean;
	override?: Record<string, unknown>;
}

interface RoundSpec {
	round: number;
	include: 'all' | 'commented' | number[];
	promptOverride?: string;
	kind?: 'claude' | 'terminal';
	cwd?: string;
}

interface TutorialSpec {
	slug: string;
	title: { en: string; ja?: string };
	tags: string[];
	thumbnail?: string;
	author?: string;
	welcome?: {
		heading: { en: string; ja?: string };
		description: { en: string; ja?: string };
		learnings: Array<{ en: string; ja?: string }>;
	};
	rounds: RoundSpec[];
	steps: StepSpec[];
	truncateLines?: number;
}

/* ─── Parsing ────────────────────────────────── */

function readJsonl(path: string): Entry[] {
	return readFileSync(path, 'utf-8')
		.split('\n')
		.filter((l) => l.trim().length > 0)
		.map((l) => JSON.parse(l) as Entry);
}

function isUserPrompt(e: Entry): boolean {
	if (e.type !== 'user' || e.isMeta) return false;
	const content = e.message?.content;
	if (typeof content === 'string') {
		if (content.startsWith('<command-name>') || content.startsWith('<local-command-')) return false;
		return content.trim().length > 0;
	}
	if (Array.isArray(content)) {
		return content.some(
			(b) => b.type === 'text' && b.text && !b.text.startsWith('<command-name>')
		);
	}
	return false;
}

function isToolResultUser(e: Entry): boolean {
	if (e.type !== 'user' || e.isMeta) return false;
	const content = e.message?.content;
	if (!Array.isArray(content)) return false;
	return content.some((b) => b.type === 'tool_result');
}

function getPromptText(e: Entry): string {
	const content = e.message?.content;
	if (typeof content === 'string') return content.trim();
	if (Array.isArray(content)) {
		for (const b of content) {
			if (b.type === 'text' && b.text) return b.text.trim();
		}
	}
	return '(no prompt)';
}

/* ─── Group into rounds ──────────────────────── */

interface RoundGroup {
	prompt: string;
	entries: Entry[];
}

function groupRounds(entries: Entry[]): RoundGroup[] {
	const rounds: RoundGroup[] = [];
	let current: Entry[] = [];
	let prompt = '';
	let started = false;
	for (const e of entries) {
		if (isUserPrompt(e)) {
			if (started) rounds.push({ prompt, entries: current });
			prompt = getPromptText(e);
			current = [e];
			started = true;
		} else if (started && (e.type === 'assistant' || e.type === 'user')) {
			current.push(e);
		}
	}
	if (started && current.length > 0) rounds.push({ prompt, entries: current });
	return rounds;
}

/* ─── Content block → steps ──────────────────── */

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function textToHtml(t: string): string {
	return t
		.split(/\n\n+/)
		.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
		.join('');
}

function toolDisplayName(name: string): string {
	const m = name.match(/^mcp__([^_]+)-mcp__(.+)$/);
	if (m) return `${m[1]} — ${m[2]}`;
	const m2 = name.match(/^mcp__(.+?)__(.+)$/);
	if (m2) return `${m2[1]} — ${m2[2]}`;
	return name;
}

function toolInputToCode(name: string, input: Record<string, unknown>): string {
	if (name.includes('run_ij_macro') && typeof input.code === 'string') return input.code;
	if (name.includes('run_script') && typeof input.script === 'string') return input.script;
	if (name === 'Bash' && typeof input.command === 'string') return input.command;
	if ((name === 'Read' || name === 'ToolSearch') && typeof input.file_path === 'string')
		return input.file_path;
	return JSON.stringify(input, null, 2);
}

function truncateText(text: string, maxLines: number): string {
	const lines = text.split('\n');
	if (lines.length <= maxLines) return text;
	return lines.slice(0, maxLines).join('\n') + `\n... [${lines.length - maxLines} more lines]`;
}

interface AssetRef {
	filename: string;
	data: Buffer;
}

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
		(steps[lastTextIdx] as Record<string, unknown>).final = true;
	}
	return steps;
}

function toolResultsToSteps(
	blocks: ContentBlock[],
	maxLines: number,
	imageCounter: { n: number }
): { steps: Step[]; assets: AssetRef[] } {
	const steps: Step[] = [];
	const assets: AssetRef[] = [];
	for (const b of blocks) {
		if (b.type !== 'tool_result') continue;
		const content = b.content;
		if (typeof content === 'string') {
			steps.push({ type: 'tool_result', text: truncateText(content, maxLines) });
		} else if (Array.isArray(content)) {
			let combinedText = '';
			for (const sub of content) {
				if (sub.type === 'text' && sub.text) {
					combinedText += (combinedText ? '\n' : '') + sub.text;
				} else if (sub.type === 'image' && sub.source?.type === 'base64') {
					const ext = sub.source.media_type.split('/')[1] ?? 'png';
					imageCounter.n += 1;
					const filename = `step_${String(imageCounter.n).padStart(3, '0')}.${ext}`;
					assets.push({ filename, data: Buffer.from(sub.source.data, 'base64') });
					steps.push({
						type: 'window',
						windowTitle: `Image ${imageCounter.n}`,
						content: { kind: 'fiji-image', src: filename }
					});
				}
			}
			if (combinedText) {
				steps.push({ type: 'tool_result', text: truncateText(combinedText, maxLines) });
			}
		}
	}
	return { steps, assets };
}

/* ─── Build full round ───────────────────────── */

function buildFullRound(
	group: RoundGroup,
	maxLines: number,
	imageCounter: { n: number }
): { round: Round; assets: AssetRef[] } {
	const steps: Step[] = [];
	const assets: AssetRef[] = [];
	for (const e of group.entries.slice(1)) {
		if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
			steps.push(...assistantBlocksToSteps(e.message!.content as ContentBlock[]));
		} else if (isToolResultUser(e)) {
			const r = toolResultsToSteps(e.message!.content as ContentBlock[], maxLines, imageCounter);
			steps.push(...r.steps);
			assets.push(...r.assets);
		}
	}
	return { round: { prompt: group.prompt, steps }, assets };
}

/* ─── INSPECT mode ───────────────────────────── */

interface StepSummary {
	index: number;
	type: string;
	summary: string;
	hasImage?: boolean;
}

interface RoundSummary {
	index: number;
	prompt: string;
	stepCount: number;
	steps: StepSummary[];
}

function inspectSession(sessionPath: string): void {
	const entries = readJsonl(sessionPath);
	const groups = groupRounds(entries);
	const imageCounter = { n: 0 };

	const rounds: RoundSummary[] = groups.map((g, ri) => {
		const { round } = buildFullRound(g, 50, imageCounter);
		const steps: StepSummary[] = round.steps.map((s, si) => {
			const type = s.type as string;
			let summary = '';
			let hasImage: boolean | undefined;
			if (type === 'thinking') {
				summary = (s.text as string).slice(0, 80) + '…';
			} else if (type === 'assistant') {
				summary = (s.html as string).replace(/<[^>]+>/g, '').slice(0, 120);
				if (s.final) summary = '[FINAL] ' + summary;
			} else if (type === 'tool_call') {
				summary = `${s.toolName}: ${(s.code as string).slice(0, 100)}`;
			} else if (type === 'tool_result') {
				summary = (s.text as string).slice(0, 100);
			} else if (type === 'window') {
				summary = `Window: ${s.windowTitle}`;
				hasImage = true;
			} else if (type === 'status') {
				summary = s.text as string;
			}
			return { index: si, type, summary, ...(hasImage ? { hasImage } : {}) };
		});
		return { index: ri, prompt: g.prompt.slice(0, 200), stepCount: round.steps.length, steps };
	});

	console.log(JSON.stringify(rounds, null, 2));
}

/* ─── GENERATE mode ──────────────────────────── */

function dumpYaml(obj: unknown): string {
	return yaml.dump(obj, {
		lineWidth: 100,
		noRefs: true,
		noCompatMode: true,
		quotingType: '"',
		forceQuotes: false
	});
}

function generate(sessionPath: string, specPath: string, outSlug?: string): void {
	const spec = yaml.load(readFileSync(specPath, 'utf-8')) as TutorialSpec;
	const slug = outSlug ?? spec.slug;
	const maxLines = spec.truncateLines ?? 100;

	const repoRoot = findRepoRoot(resolve('.'));
	const tutDir = join(repoRoot, 'src', 'tutorials', slug);
	const tutorialDir = join(tutDir, 'tutorial');
	const fullLogDir = join(tutDir, 'full-log');
	const assetDir = join(repoRoot, 'static', 'tutorials', slug, 'assets');

	mkdirSync(tutorialDir, { recursive: true });
	mkdirSync(fullLogDir, { recursive: true });
	mkdirSync(assetDir, { recursive: true });

	const entries = readJsonl(sessionPath);
	const groups = groupRounds(entries);
	const imageCounter = { n: 0 };

	// Build all full rounds + collect assets
	const fullRounds: Round[] = [];
	const allAssets: AssetRef[] = [];
	for (const g of groups) {
		const { round, assets } = buildFullRound(g, maxLines, imageCounter);
		fullRounds.push(round);
		allAssets.push(...assets);
	}

	// Write full-log rounds
	for (let i = 0; i < fullRounds.length; i++) {
		const filename = `round-${String(i + 1).padStart(2, '0')}.yaml`;
		writeFileSync(join(fullLogDir, filename), dumpYaml(fullRounds[i]));
		console.error(`[full-log] ${filename} — ${fullRounds[i].steps.length} steps`);
	}

	// Write assets
	for (const a of allAssets) {
		writeFileSync(join(assetDir, a.filename), a.data);
		console.error(`[asset] ${a.filename}`);
	}

	// Build step lookup: stepSpec keyed by "round:step"
	const stepSpecs = new Map<string, StepSpec>();
	for (const s of spec.steps) {
		stepSpecs.set(`${s.round}:${s.step}`, s);
	}

	// Build curated tutorial rounds
	let curatedRoundIndex = 0;
	for (const rs of spec.rounds) {
		if (rs.round >= fullRounds.length) {
			console.error(`[warn] spec references round ${rs.round} but session only has ${fullRounds.length} rounds`);
			continue;
		}
		const fullRound = fullRounds[rs.round];
		const curatedSteps: Step[] = [];

		const includeIndices: Set<number> =
			rs.include === 'all'
				? new Set(fullRound.steps.map((_, i) => i))
				: rs.include === 'commented'
					? new Set(spec.steps.filter((s) => s.round === rs.round).map((s) => s.step))
					: new Set(rs.include);

		for (const idx of Array.from(includeIndices).sort((a, b) => a - b)) {
			if (idx >= fullRound.steps.length) continue;
			const step = { ...fullRound.steps[idx] };
			const ss = stepSpecs.get(`${rs.round}:${idx}`);
			if (ss?.comment) {
				step.comment = ss.comment;
			}
			if (ss?.compact) step.compact = true;
			if (ss?.hidden) step.hidden = true;
			if (ss?.override) Object.assign(step, ss.override);
			curatedSteps.push(step);
		}

		const curatedRound: Round = {
			...(rs.kind ? { kind: rs.kind } : {}),
			prompt: rs.promptOverride ?? fullRound.prompt,
			...(rs.cwd ? { cwd: rs.cwd } : {}),
			steps: curatedSteps
		};

		curatedRoundIndex++;
		const filename = `round-${String(curatedRoundIndex).padStart(2, '0')}.yaml`;
		writeFileSync(join(tutorialDir, filename), dumpYaml(curatedRound));
		console.error(`[tutorial] ${filename} — ${curatedSteps.length} steps`);
	}

	// Write meta.yaml
	const meta: Record<string, unknown> = {
		slug,
		title: spec.title,
		tags: spec.tags
	};
	if (spec.thumbnail) meta.thumbnail = spec.thumbnail;
	if (spec.author) meta.author = spec.author;
	if (spec.welcome) meta.welcome = spec.welcome;
	writeFileSync(join(tutDir, 'meta.yaml'), dumpYaml(meta));
	console.error(`[meta] meta.yaml written`);
	console.error(`[done] Tutorial "${slug}" generated at ${tutDir}`);
}

/* ─── Utilities ──────────────────────────────── */

function findRepoRoot(start: string): string {
	let cur = resolve(start);
	while (cur !== dirname(cur)) {
		if (existsSync(join(cur, 'package.json'))) return cur;
		cur = dirname(cur);
	}
	throw new Error(`no package.json found walking up from ${start}`);
}

/* ─── CLI ────────────────────────────────────── */

function usage(): string {
	return `session-to-tutorial — Generate tutorial YAML from a Claude Code session

INSPECT (print session structure as JSON for agent planning):
  tsx scripts/session-to-tutorial.ts inspect --session <path.jsonl>

GENERATE (produce tutorial from session + spec):
  tsx scripts/session-to-tutorial.ts generate --session <path.jsonl> --spec <spec.yaml> [--out <slug>]

The spec YAML declares metadata, which rounds/steps to include in the curated
tutorial layer, and what comments to attach. See scripts/TUTORIAL-WORKFLOW.md
for the full spec format and agent workflow.`;
}

function main() {
	const argv = process.argv.slice(2);
	const command = argv[0];

	if (command === 'inspect') {
		let session = '';
		for (let i = 1; i < argv.length; i++) {
			if (argv[i] === '--session') session = argv[++i];
		}
		if (!session) {
			console.error(usage());
			process.exit(1);
		}
		inspectSession(session);
	} else if (command === 'generate') {
		let session = '', spec = '', out = '';
		for (let i = 1; i < argv.length; i++) {
			if (argv[i] === '--session') session = argv[++i];
			else if (argv[i] === '--spec') spec = argv[++i];
			else if (argv[i] === '--out') out = argv[++i];
		}
		if (!session || !spec) {
			console.error(usage());
			process.exit(1);
		}
		generate(session, spec, out || undefined);
	} else {
		console.error(usage());
		process.exit(command === '--help' || command === '-h' ? 0 : 1);
	}
}

main();
