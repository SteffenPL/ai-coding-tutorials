/**
 * Composition-based tutorial loader.
 *
 * Tutorials live in `src/tutorials/<slug>/` with a single `composition.json`
 * that references traces and/or contains hand-authored rounds.
 *
 * Traces live at `src/traces/<slug>/trace.json`.
 *
 * Both are loaded via `import.meta.glob` with `?raw` + `eager: true` for
 * synchronous build-time access, matching the pattern used throughout this
 * project.
 */

import type { Tutorial } from './tutorials';
import type { TutorialComposition } from '$lib/compose/types';
import { FORMAT_VERSION } from '$lib/compose/types';
import type { TraceState } from '$lib/trace/types';
import { resolveComposition } from '$lib/compose/resolve';

function checkVersion(label: string, version: string | undefined) {
	if (!version) {
		console.warn(`tutorial-loader: ${label} is missing formatVersion`);
	} else if (!version.startsWith('1.')) {
		console.warn(`tutorial-loader: ${label} has unknown formatVersion "${version}"`);
	}
}

/* ─── Vite globs ────────────────────────────── */

const compositionRaw = import.meta.glob('/src/tutorials/*/composition.json', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const traceRaw = import.meta.glob('/src/traces/*/trace.json', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

/* ─── Trace loader ─────────────────────────── */

const tracesBySlug = new Map<string, TraceState>();
for (const [path, raw] of Object.entries(traceRaw)) {
	const m = path.match(/\/src\/traces\/([^/]+)\/trace\.json$/);
	if (!m) continue;
	try {
		const trace: TraceState = JSON.parse(raw);
		checkVersion(`trace "${m[1]}"`, trace.formatVersion);
		tracesBySlug.set(m[1], trace);
	} catch (e) {
		console.warn(`tutorial-loader: failed to parse trace at ${path}:`, e);
	}
}

function loadTrace(slug: string): TraceState | null {
	return tracesBySlug.get(slug) ?? null;
}

/* ─── Composition loading ──────────────────── */

function slugFromPath(path: string): string {
	const m = path.match(/\/src\/tutorials\/([^/]+)\/composition\.json$/);
	if (!m) throw new Error(`tutorial-loader: unexpected composition path: ${path}`);
	return m[1];
}

function buildTutorial(path: string, raw: string): Tutorial | null {
	let composition: TutorialComposition;
	try {
		composition = JSON.parse(raw);
	} catch (e) {
		console.warn(`tutorial-loader: failed to parse ${path}:`, e);
		return null;
	}

	const slug = slugFromPath(path);
	checkVersion(`composition "${slug}"`, composition.formatVersion);
	if (composition.slug !== slug) {
		console.warn(
			`tutorial-loader: composition.slug "${composition.slug}" doesn't match directory "${slug}"`
		);
	}

	const vis = composition.meta?.visibility ?? 'public';
	if (composition.devOnly && !import.meta.env.DEV) return null;
	if (vis === 'draft' && !import.meta.env.DEV) return null;

	const tutorial = resolveComposition(composition, loadTrace);

	if (tutorial.rounds.length === 0) {
		console.warn(`tutorial-loader: ${slug} resolved to 0 rounds`);
	}

	return tutorial;
}

const allTutorials: Tutorial[] = Object.entries(compositionRaw)
	.map(([path, raw]) => buildTutorial(path, raw))
	.filter((t): t is Tutorial => t !== null)
	.sort((a, b) => a.meta.slug.localeCompare(b.meta.slug));

/* ─── Public API ────────────────────────────── */

export function getAllTutorials(): Tutorial[] {
	return allTutorials.filter((t) => t.meta.visibility !== 'hidden');
}

export function getTutorialBySlug(slug: string): Tutorial | undefined {
	return allTutorials.find((t) => t.meta.slug === slug);
}
