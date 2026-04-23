import { json } from '@sveltejs/kit';
import { writeFileSync, existsSync, readdirSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import yaml from 'js-yaml';
import type { RequestHandler } from './$types';
import type { TutorialComposition } from '$lib/compose/types';
import type { TraceState } from '$lib/trace/types';
import { resolveComposition } from '$lib/compose/resolve';

export const prerender = false;

function loadTrace(slug: string): TraceState | null {
	const path = resolve('src/traces', slug, 'trace.json');
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, 'utf-8'));
}

export const POST: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const composition = body.composition as TutorialComposition;
	const force = body.force === true;

	const slug = params.slug;
	const tutorialDir = resolve('src/tutorials', slug, 'tutorial');
	const metaPath = resolve('src/tutorials', slug, 'meta.yaml');

	const existing: string[] = [];
	if (existsSync(tutorialDir)) {
		const files = readdirSync(tutorialDir).filter((f) => f.match(/^round-\d+\.yaml$/));
		existing.push(...files);
	}

	if (existing.length > 0 && !force) {
		return json({
			ok: false,
			conflict: true,
			existingFiles: existing
		});
	}

	const tutorial = resolveComposition(composition, loadTrace);

	if (!existsSync(tutorialDir)) {
		mkdirSync(tutorialDir, { recursive: true });
	}

	const written: string[] = [];
	for (let i = 0; i < tutorial.rounds.length; i++) {
		const filename = `round-${String(i + 1).padStart(2, '0')}.yaml`;
		const filepath = join(tutorialDir, filename);
		const content = yaml.dump(tutorial.rounds[i], {
			lineWidth: 120,
			noRefs: true,
			quotingType: '"',
			forceQuotes: false
		});
		writeFileSync(filepath, content, 'utf-8');
		written.push(filename);
	}

	const metaObj: Record<string, unknown> = {};
	if (existsSync(metaPath)) {
		const raw = readFileSync(metaPath, 'utf-8');
		Object.assign(metaObj, yaml.load(raw) as Record<string, unknown>);
	}

	metaObj.slug = slug;
	metaObj.title = composition.meta.title;
	metaObj.tags = composition.meta.tags;
	if (composition.meta.thumbnail) metaObj.thumbnail = composition.meta.thumbnail;
	if (composition.meta.author) metaObj.author = composition.meta.author;
	if (composition.description) metaObj.description = composition.description;
	if (composition.requirements) metaObj.requirements = composition.requirements;
	if (composition.welcome) metaObj.welcome = composition.welcome;
	if (composition.briefing) metaObj.briefing = composition.briefing;

	writeFileSync(
		metaPath,
		yaml.dump(metaObj, { lineWidth: 120, noRefs: true, quotingType: '"', forceQuotes: false }),
		'utf-8'
	);

	return json({ ok: true, written, metaUpdated: true });
};
