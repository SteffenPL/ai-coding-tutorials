import type { Step } from '$lib/data/tutorials';

export interface TraceStepRef {
	roundIndex: number;
	nodeIndex: number;
}

export type DisplayMode = 'compact' | 'full';

export interface TraceStep {
	id: string;
	sourceRef?: TraceStepRef;
	included: boolean;
	displayMode: DisplayMode;
	shortenedText?: string;
	comment?: string | { en: string; ja?: string };
	overrides?: Record<string, unknown>;
	inserted?: Step;
}

export interface TraceRound {
	id: string;
	kind: 'claude' | 'terminal';
	prompt: string;
	sourceRoundIndex?: number;
	steps: TraceStep[];
}

export interface TraceState {
	sessionSlug: string;
	title?: string;
	rounds: TraceRound[];
}
