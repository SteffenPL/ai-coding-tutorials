import type { TutorialMeta, TutorialWelcome, TutorialRound } from '$lib/data/tutorials';

export const FORMAT_VERSION = '1.0.0';

export interface TutorialComposition {
	formatVersion?: string;
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
	fullBlocks?: CompositionBlock[];
	devOnly?: boolean;
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
