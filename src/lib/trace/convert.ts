import type { SessionView, DisplayNode, ToolInvocationResult } from '$lib/session/viewmodel';
import type { TraceState, TraceRound, TraceStep, DisplayMode } from './types';
import type {
	Step,
	TutorialRound,
	AssistantStep,
	ThinkingStep,
	ToolCallStep,
	ToolResultStep,
	WindowStep
} from '$lib/data/tutorials';

let _nextId = 0;
function nextId(prefix: string): string {
	return `${prefix}-${++_nextId}`;
}

export function resetIdCounter() {
	_nextId = 0;
}

function primaryInputText(name: string, input: Record<string, unknown>): string {
	if (name === 'Bash' && typeof input.command === 'string') return input.command;
	if (name === 'Read' && typeof input.file_path === 'string') return input.file_path;
	if (name === 'Edit' && typeof input.file_path === 'string') return input.file_path;
	if (name === 'Write' && typeof input.file_path === 'string') return input.file_path;
	if (name.endsWith('run_ij_macro') && typeof input.macro === 'string') return input.macro;
	if (name.endsWith('run_script') && typeof input.script === 'string') return input.script;
	return JSON.stringify(input, null, 2);
}

function prettyToolName(name: string): string {
	const m = name.match(/^mcp__([^_]+)-mcp__(.+)$/) ?? name.match(/^mcp__(.+?)__(.+)$/);
	return m ? `${m[1]} · ${m[2]}` : name;
}

function toolResultText(result: ToolInvocationResult | undefined): string {
	if (!result) return '';
	if (typeof result.content === 'string') return result.content;
	return result.content
		.filter((b) => b.type === 'text')
		.map((b) => (b as { text: string }).text)
		.join('\n');
}

function hasBase64Images(result: ToolInvocationResult | undefined): boolean {
	if (!result || typeof result.content === 'string') return false;
	return result.content.some((b) => b.type === 'image');
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function nodeToSteps(node: DisplayNode, roundIdx: number, nodeIdx: number): TraceStep[] {
	const ref = { roundIndex: roundIdx, nodeIndex: nodeIdx };

	function makeStep(included: boolean, overrides: Record<string, unknown>, mode: DisplayMode = 'full'): TraceStep {
		return { id: nextId('s'), sourceRef: ref, included, displayMode: mode, overrides };
	}

	switch (node.kind) {
		case 'assistant-text':
			return [makeStep(
				!!node.isFinal,
				{ type: 'assistant', html: `<p>${escapeHtml(node.text)}</p>`, final: node.isFinal }
			)];
		case 'thinking':
			return [makeStep(false, { type: 'thinking', text: node.text })];
		case 'tool-invocation': {
			const steps: TraceStep[] = [];
			steps.push(makeStep(true, {
				type: 'tool_call',
				toolName: prettyToolName(node.name),
				code: primaryInputText(node.name, node.input)
			}));
			if (node.result) {
				const text = toolResultText(node.result);
				steps.push(makeStep(text.length > 0, {
					type: 'tool_result',
					text,
					_isError: node.result.isError
				}));
			}
			if (hasBase64Images(node.result)) {
				steps.push(makeStep(false, {
					type: 'window',
					_hasBase64: true,
					windowTitle: prettyToolName(node.name),
					content: { kind: 'image', src: '' }
				}));
			}
			return steps;
		}
		case 'user-text':
			return [makeStep(false, { type: 'assistant', html: `<p>${escapeHtml(node.text)}</p>` })];
		case 'compact':
			return [];
		default:
			return [];
	}
}

export function sessionViewToTraceState(view: SessionView): TraceState {
	resetIdCounter();
	const rounds: TraceRound[] = view.rounds
		.filter((r) => r.prompt.kind === 'normal')
		.map((round) => {
			const steps: TraceStep[] = [];
			round.nodes.forEach((node, nodeIdx) => {
				steps.push(...nodeToSteps(node, round.index - 1, nodeIdx));
			});
			return {
				id: nextId('r'),
				kind: 'claude' as const,
				prompt: round.prompt.text,
				sourceRoundIndex: round.index - 1,
				steps
			};
		});

	return {
		sessionSlug: view.slug,
		title: view.customTitle ?? view.slug,
		rounds
	};
}

export function traceStepToTutorialStep(step: TraceStep): Step | null {
	if (step.inserted) {
		if (step.displayMode === 'compact') step.inserted.compact = true;
		return step.inserted;
	}
	if (!step.overrides) return null;

	const o = step.overrides as Record<string, unknown>;
	const type = o.type as string;
	const isCompact = step.displayMode === 'compact';

	switch (type) {
		case 'assistant': {
			const s: AssistantStep = {
				type: 'assistant',
				html: (step.shortenedText ?? o.html) as string,
				...(o.final ? { final: true } : {}),
				...(isCompact ? { compact: true } : {})
			};
			if (step.comment) s.comment = step.comment;
			return s;
		}
		case 'thinking': {
			const s: ThinkingStep = {
				type: 'thinking',
				text: (step.shortenedText ?? o.text) as string,
				...(isCompact ? { compact: true } : {})
			};
			if (step.comment) s.comment = step.comment;
			return s;
		}
		case 'tool_call': {
			const s: ToolCallStep = {
				type: 'tool_call',
				toolName: o.toolName as string,
				code: (step.shortenedText ?? o.code) as string,
				...(isCompact ? { compact: true } : {})
			};
			if (step.comment) s.comment = step.comment;
			return s;
		}
		case 'tool_result': {
			const s: ToolResultStep = {
				type: 'tool_result',
				text: (step.shortenedText ?? o.text) as string,
				...(isCompact ? { compact: true } : {})
			};
			if (step.comment) s.comment = step.comment;
			return s;
		}
		case 'window': {
			const s: WindowStep = {
				type: 'window',
				windowTitle: o.windowTitle as string,
				...(o.subtitle ? { subtitle: o.subtitle as string } : {}),
				content: o.content as WindowStep['content'],
				...(isCompact ? { compact: true } : {})
			};
			if (step.comment) s.comment = step.comment;
			return s;
		}
		default:
			return o as unknown as Step;
	}
}

export function traceStateToTutorialRounds(state: TraceState): TutorialRound[] {
	return state.rounds.map((round) => {
		const steps: Step[] = [];
		for (const ts of round.steps) {
			if (!ts.included && !ts.inserted) continue;
			const step = traceStepToTutorialStep(ts);
			if (step) steps.push(step);
		}
		return {
			kind: round.kind,
			prompt: round.prompt,
			steps
		};
	});
}
