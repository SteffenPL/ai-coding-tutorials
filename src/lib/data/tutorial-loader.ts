/**
 * Folder-based tutorial loader.
 *
 * Tutorials live in `src/tutorials/<slug>/` with:
 *   - `meta.yaml`              — title, tags, thumbnail, welcome, optional devOnly
 *   - `tutorial/round-NN.yaml` — curated simplified rounds
 *   - `full-log/round-NN.yaml` — optional unabridged log
 *
 * Assets live in `static/tutorials/<slug>/assets/<file>` and are referenced
 * by filename only in YAML. The loader rewrites bare filenames to the
 * site-relative path `tutorials/<slug>/assets/<file>` so that
 * `{base}/{src}` resolves correctly in window components.
 *
 * YAML files are imported via `import.meta.glob` with `?raw`, parsed by
 * `js-yaml` at module-load time. `eager: true` lets the loader expose a
 * synchronous `getAllTutorials()` so SvelteKit's prerender `entries()` can
 * discover slugs statically.
 */

import yaml from 'js-yaml';
import type {
	Tutorial,
	TutorialMeta,
	TutorialRound,
	TutorialWelcome,
	SessionRef,
	Step,
	WindowStep,
	WindowContentData
} from './tutorials';

/* ─── Vite globs ────────────────────────────── */

const metaRaw = import.meta.glob('/src/tutorials/*/meta.yaml', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const tutorialRoundsRaw = import.meta.glob('/src/tutorials/*/tutorial/round-*.yaml', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const fullRoundsRaw = import.meta.glob('/src/tutorials/*/full-log/round-*.yaml', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

/* ─── Path helpers ──────────────────────────── */

function slugFromMetaPath(path: string): string {
	const m = path.match(/\/src\/tutorials\/([^/]+)\/meta\.yaml$/);
	if (!m) throw new Error(`tutorial-loader: unexpected meta path: ${path}`);
	return m[1];
}

function numericSuffix(path: string): number {
	const m = path.match(/round-(\d+)\.yaml$/);
	return m ? parseInt(m[1], 10) : 0;
}

/* ─── Asset path rewriting ──────────────────── */

/**
 * Turn a bare filename (`step_001.png`) into a site-relative asset path
 * (`tutorials/<slug>/assets/step_001.png`). Paths that already contain a
 * slash or a protocol are passed through untouched, so pre-existing fully
 * qualified references still work.
 */
function rewriteAssetPath(slug: string, ref: string | undefined): string | undefined {
	if (!ref) return ref;
	if (ref.includes('/') || ref.includes('://')) return ref;
	return `tutorials/${slug}/assets/${ref}`;
}

function rewriteContent(slug: string, content: WindowContentData): WindowContentData {
	switch (content.kind) {
		case 'fiji-image':
			return { ...content, src: rewriteAssetPath(slug, content.src)! };
		case 'image':
			return { ...content, src: rewriteAssetPath(slug, content.src)! };
		case 'video':
			return {
				...content,
				src: rewriteAssetPath(slug, content.src)!,
				poster: rewriteAssetPath(slug, content.poster)
			};
		case 'window-collection':
			return {
				...content,
				windows: content.windows.map((w) => ({
					...w,
					content: rewriteContent(slug, w.content)
				}))
			};
		default:
			return content;
	}
}

function rewriteStep(slug: string, step: Step): Step {
	if (step.type === 'window') {
		const w = step as WindowStep;
		return { ...w, content: rewriteContent(slug, w.content) };
	}
	return step;
}

/* ─── YAML parsing ──────────────────────────── */

interface LoadedMeta extends TutorialMeta {
	welcome?: TutorialWelcome;
	devOnly?: boolean;
}

function parseMeta(raw: string, slug: string): LoadedMeta {
	const data = yaml.load(raw) as Partial<LoadedMeta> | null;
	if (!data || typeof data !== 'object') {
		throw new Error(`tutorial-loader: ${slug}/meta.yaml did not parse to an object`);
	}
	if (!data.title || !data.title.en) {
		throw new Error(`tutorial-loader: ${slug}/meta.yaml is missing title.en`);
	}
	if (import.meta.env.DEV && !Array.isArray(data.sessions)) {
		console.warn(`tutorial-loader: ${slug}/meta.yaml is missing 'sessions' — add source session references`);
	}
	return {
		slug: data.slug ?? slug,
		title: data.title,
		tags: data.tags ?? [],
		thumbnail: rewriteAssetPath(slug, data.thumbnail),
		sessions: Array.isArray(data.sessions) ? data.sessions as SessionRef[] : undefined,
		author: (data as Record<string, unknown>).author as string | undefined ?? 'Steffen Plunder',
		welcome: data.welcome,
		devOnly: data.devOnly === true
	};
}

function parseRound(raw: string, slug: string, source: string): TutorialRound {
	const data = yaml.load(raw) as Partial<TutorialRound> | null;
	if (!data || typeof data !== 'object') {
		throw new Error(`tutorial-loader: ${source} did not parse to an object`);
	}
	const steps = Array.isArray(data.steps) ? data.steps : [];
	return {
		kind: data.kind ?? 'claude',
		prompt: data.prompt ?? '',
		...(data.cwd !== undefined ? { cwd: data.cwd } : {}),
		steps: steps.map((s) => rewriteStep(slug, s as Step))
	};
}

/* ─── Round collection ──────────────────────── */

function collectRounds(
	slug: string,
	entries: Record<string, string>,
	prefix: 'tutorial' | 'full-log'
): TutorialRound[] {
	const base = `/src/tutorials/${slug}/${prefix}/`;
	return Object.entries(entries)
		.filter(([path]) => path.startsWith(base))
		.sort(([a], [b]) => numericSuffix(a) - numericSuffix(b))
		.map(([path, raw]) => parseRound(raw, slug, path));
}

/* ─── Assembly ──────────────────────────────── */

function buildTutorial(metaPath: string, metaYaml: string): Tutorial | null {
	const slug = slugFromMetaPath(metaPath);
	const meta = parseMeta(metaYaml, slug);

	if (meta.devOnly && !import.meta.env.DEV) return null;

	const rounds = collectRounds(slug, tutorialRoundsRaw, 'tutorial');
	if (rounds.length === 0) {
		throw new Error(`tutorial-loader: ${slug} has no tutorial/round-*.yaml files`);
	}
	const fullRounds = collectRounds(slug, fullRoundsRaw, 'full-log');

	return {
		meta: {
			slug: meta.slug,
			title: meta.title,
			tags: meta.tags,
			...(meta.thumbnail ? { thumbnail: meta.thumbnail } : {}),
			...(meta.sessions ? { sessions: meta.sessions } : {}),
			author: meta.author
		},
		...(meta.welcome ? { welcome: meta.welcome } : {}),
		rounds,
		...(fullRounds.length > 0 ? { fullRounds } : {})
	};
}

const allTutorials: Tutorial[] = Object.entries(metaRaw)
	.map(([path, raw]) => buildTutorial(path, raw))
	.filter((t): t is Tutorial => t !== null)
	.sort((a, b) => a.meta.slug.localeCompare(b.meta.slug));

/* ─── Public API ────────────────────────────── */

export function getAllTutorials(): Tutorial[] {
	return allTutorials;
}

export function getTutorialBySlug(slug: string): Tutorial | undefined {
	return allTutorials.find((t) => t.meta.slug === slug);
}
