import type { Tutorial, TutorialRound, TutorialWelcome, WindowStep, WindowContentData } from '$lib/data/tutorials';
import type { TraceState } from '$lib/trace/types';
import type { TutorialComposition } from './types';
import { traceStateToTutorialRounds } from '$lib/trace/convert';

export type TraceLoader = (slug: string) => TraceState | null;

export function rewriteAssetPath(slug: string, ref: string | undefined): string | undefined {
	if (!ref) return ref;
	if (ref.startsWith('shared/')) return `assets/${ref.slice(7)}`;
	if (ref.includes('/') || ref.includes('://')) return ref;
	return `tutorials/${slug}/assets/${ref}`;
}

export function rewriteContent(slug: string, content: WindowContentData): WindowContentData {
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
		default:
			return content;
	}
}

function rewriteRoundAssets(slug: string, rounds: TutorialRound[]): TutorialRound[] {
	for (const round of rounds) {
		for (let i = 0; i < round.steps.length; i++) {
			const step = round.steps[i];
			if (step.type === 'window') {
				const w = step as WindowStep;
				round.steps[i] = { ...w, content: rewriteContent(slug, w.content) };
			}
		}
	}
	return rounds;
}

export function resolveComposition(
	composition: TutorialComposition,
	loadTrace: TraceLoader
): Tutorial {
	const allRounds: TutorialRound[] = [];

	for (const block of composition.blocks) {
		if (block.kind === 'round') {
			allRounds.push(block.round);
		} else {
			const trace = loadTrace(block.sourceSlug);
			if (!trace) continue;
			let rounds = traceStateToTutorialRounds(trace);
			if (block.rounds) {
				rounds = block.rounds
					.filter((i) => i >= 0 && i < rounds.length)
					.map((i) => rounds[i]);
			}
			allRounds.push(...rounds);
		}
	}

	const slug = composition.slug;

	let welcome: TutorialWelcome | undefined;
	if (composition.description) {
		welcome = {
			heading: composition.meta.title,
			description: { en: composition.description },
			learnings: []
		};
	} else if (composition.welcome) {
		welcome = composition.welcome;
	}

	return {
		meta: {
			...composition.meta,
			...(composition.meta.thumbnail
				? { thumbnail: rewriteAssetPath(slug, composition.meta.thumbnail) }
				: {})
		},
		...(welcome ? { welcome } : {}),
		...(composition.briefing ? { briefing: composition.briefing } : {}),
		rounds: rewriteRoundAssets(slug, allRounds)
	};
}
