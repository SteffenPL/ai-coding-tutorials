import type { Tutorial, TutorialRound, WindowStep, WindowContentData } from '$lib/data/tutorials';
import type { TraceState } from '$lib/trace/types';
import type { TutorialComposition, CompositionBlock } from './types';
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

function resolveBlocks(
	blocks: CompositionBlock[],
	loadTrace: TraceLoader
): TutorialRound[] {
	const allRounds: TutorialRound[] = [];
	for (const block of blocks) {
		if (block.kind === 'round') {
			allRounds.push(block.round);
			continue;
		}
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
	return allRounds;
}

export function resolveComposition(
	composition: TutorialComposition,
	loadTrace: TraceLoader
): Tutorial {
	const slug = composition.slug;
	const rounds = resolveBlocks(composition.blocks, loadTrace);

	return {
		meta: {
			...composition.meta,
			...(composition.meta.thumbnail
				? { thumbnail: rewriteAssetPath(slug, composition.meta.thumbnail) }
				: {})
		},
		...(composition.description ? { description: composition.description } : {}),
		...(composition.requirements ? { requirements: composition.requirements } : {}),
		rounds: rewriteRoundAssets(slug, rounds)
	};
}
