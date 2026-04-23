import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { TraceState } from '$lib/trace/types';
import { traceStateToTutorialRounds } from '$lib/trace/convert';
import { setPreview } from '$lib/trace/preview-store';
import { rewriteContent } from '$lib/compose/resolve';
import type { Tutorial, WindowStep } from '$lib/data/tutorials';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request }) => {
	const state = (await request.json()) as TraceState;
	const slug = params.slug;

	const rounds = traceStateToTutorialRounds(state);

	for (const round of rounds) {
		for (let i = 0; i < round.steps.length; i++) {
			const step = round.steps[i];
			if (step.type === 'window') {
				const w = step as WindowStep;
				round.steps[i] = { ...w, content: rewriteContent(slug, w.content) };
			}
		}
	}

	const tutorial: Tutorial = {
		meta: {
			slug,
			title: { en: state.title ?? slug },
			tags: []
		},
		rounds
	};

	setPreview(slug, tutorial);

	return json({ ok: true });
};

export const GET: RequestHandler = async ({ params }) => {
	const { getPreview } = await import('$lib/trace/preview-store');
	const tutorial = getPreview(params.slug);
	if (!tutorial) {
		return json({ ok: false, error: 'No preview available' }, { status: 404 });
	}
	return json({ ok: true, tutorial });
};
