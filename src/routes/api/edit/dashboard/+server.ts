import { json } from '@sveltejs/kit';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import type { RequestHandler } from './$types';

export const prerender = false;

interface SessionInfo {
	slug: string;
	hasTrace: boolean;
}

interface TraceInfo {
	slug: string;
	title?: string;
	sessionSlug: string;
	roundCount: number;
}

interface TutorialInfo {
	slug: string;
	title?: string;
	blockCount: number;
	hasComposition: boolean;
	hasYaml: boolean;
	exportDate?: string;
	sourceSlugs: string[];
}

function listDirs(base: string): string[] {
	if (!existsSync(base)) return [];
	return readdirSync(base, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name)
		.sort();
}

export const GET: RequestHandler = () => {
	const sessionsDir = resolve('src/sessions');
	const tracesDir = resolve('src/traces');
	const tutorialsDir = resolve('src/tutorials');

	const sessions: SessionInfo[] = [];
	for (const slug of listDirs(sessionsDir)) {
		const hasJsonl = readdirSync(join(sessionsDir, slug)).some((f) => f.endsWith('.jsonl'));
		if (!hasJsonl) continue;
		sessions.push({
			slug,
			hasTrace: existsSync(join(tracesDir, slug, 'trace.json'))
		});
	}

	// Also include sessions still in the old location (src/tutorials/<slug>/session/)
	for (const slug of listDirs(tutorialsDir)) {
		const sessionDir = join(tutorialsDir, slug, 'session');
		if (!existsSync(sessionDir)) continue;
		if (sessions.some((s) => s.slug === slug)) continue;
		const hasJsonl = readdirSync(sessionDir).some((f) => f.endsWith('.jsonl'));
		if (!hasJsonl) continue;
		sessions.push({
			slug,
			hasTrace: existsSync(join(tracesDir, slug, 'trace.json'))
		});
	}

	const traces: TraceInfo[] = [];
	for (const slug of listDirs(tracesDir)) {
		const tracePath = join(tracesDir, slug, 'trace.json');
		if (!existsSync(tracePath)) continue;
		try {
			const state = JSON.parse(readFileSync(tracePath, 'utf-8'));
			traces.push({
				slug,
				title: state.title,
				sessionSlug: state.sessionSlug,
				roundCount: state.rounds?.length ?? 0
			});
		} catch {
			traces.push({ slug, sessionSlug: slug, roundCount: 0 });
		}
	}

	const tutorials: TutorialInfo[] = [];
	for (const slug of listDirs(tutorialsDir)) {
		if (slug === 'CLAUDE.md') continue;
		const compositionPath = join(tutorialsDir, slug, 'composition.json');
		const metaPath = join(tutorialsDir, slug, 'meta.yaml');
		const tutorialDir = join(tutorialsDir, slug, 'tutorial');

		const hasComposition = existsSync(compositionPath);
		const hasMeta = existsSync(metaPath);
		const hasYaml = existsSync(tutorialDir) &&
			readdirSync(tutorialDir).some((f) => f.match(/^round-\d+\.yaml$/));

		if (!hasMeta && !hasComposition) continue;

		let title: string | undefined;
		let blockCount = 0;
		let exportDate: string | undefined;
		let sourceSlugs: string[] = [];

		if (hasComposition) {
			try {
				const comp = JSON.parse(readFileSync(compositionPath, 'utf-8'));
				title = comp.meta?.title?.en;
				blockCount = comp.blocks?.length ?? 0;
				sourceSlugs = (comp.blocks ?? [])
					.filter((b: { kind: string }) => b.kind === 'trace')
					.map((b: { sourceSlug: string }) => b.sourceSlug);
			} catch { /* skip */ }
		}

		if (!title && hasMeta) {
			try {
				const meta = yaml.load(readFileSync(metaPath, 'utf-8')) as Record<string, unknown>;
				const t = meta.title as Record<string, string> | undefined;
				title = t?.en;
			} catch { /* skip */ }
		}

		if (hasYaml) {
			try {
				const roundFiles = readdirSync(tutorialDir).filter((f) => f.match(/^round-\d+\.yaml$/));
				if (roundFiles.length > 0) {
					const lastRound = join(tutorialDir, roundFiles.sort().pop()!);
					const stat = statSync(lastRound);
					exportDate = stat.mtime.toISOString();
				}
			} catch { /* skip */ }
		}

		tutorials.push({
			slug,
			title,
			blockCount,
			hasComposition,
			hasYaml,
			exportDate,
			sourceSlugs
		});
	}

	return json({ sessions, traces, tutorials });
};
