import { json } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RequestHandler } from './$types';
import type { TutorialComposition } from '$lib/compose/types';
import type { TraceState } from '$lib/trace/types';
import { resolveComposition } from '$lib/compose/resolve';
import { setPreview, getPreview } from '$lib/compose/preview-store';

export const prerender = false;

function loadTrace(slug: string): TraceState | null {
	const path = resolve('src/traces', slug, 'trace.json');
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, 'utf-8'));
}

export const POST: RequestHandler = async ({ params, request }) => {
	const composition = (await request.json()) as TutorialComposition;
	const tutorial = resolveComposition(composition, loadTrace);
	setPreview(params.slug, tutorial);
	return json({ ok: true });
};

export const GET: RequestHandler = async ({ params }) => {
	const tutorial = getPreview(params.slug);
	if (!tutorial) {
		return json({ ok: false, error: 'No preview available' }, { status: 404 });
	}
	return json({ ok: true, tutorial });
};
