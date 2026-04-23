import type { TutorialMeta, TutorialWelcome, TutorialRound } from '$lib/data/tutorials';

export interface TutorialComposition {
	slug: string;
	meta: TutorialMeta;
	/** Markdown description (replaces structured welcome heading + description + learnings) */
	description?: string;
	/** Markdown prerequisites / requirements */
	requirements?: string;
	/** @deprecated Use `description` instead. Kept for backward compat during migration. */
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
