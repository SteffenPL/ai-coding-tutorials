import type { TutorialMeta, TutorialWelcome, TutorialRound } from '$lib/data/tutorials';

export interface TutorialComposition {
	slug: string;
	meta: TutorialMeta;
	welcome?: TutorialWelcome;
	briefing?: { en: string; ja?: string };
	blocks: CompositionBlock[];
}

export type CompositionBlock = TraceBlock | HandAuthoredBlock;

export interface TraceBlock {
	kind: 'trace';
	sourceSlug: string;
	rounds?: number[];
}

export interface HandAuthoredBlock {
	kind: 'round';
	round: TutorialRound;
}
