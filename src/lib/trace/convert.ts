import type { SessionView, DisplayNode, ToolInvocationResult } from '$lib/session/viewmodel';
import type { TraceState, TraceRound, TraceStep, DisplayMode } from './types';
import {
	validateTerminalRound
} from '$lib/data/tutorials';
import type {
	Step,
	StepType,
	TutorialRound,
	AssistantStep,
	ThinkingStep,
	ToolCallStep,
	ToolResultStep,
	WindowStep
} from '$lib/data/tutorials';
import { getDefaultMode } from '$lib/components/tutorial/step-colors';

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

function renderInlineCode(html: string): string {
	let result = html.replace(/`([^`\n]+)`/g, (_, code) => {
		const isDecorative = /^[★─]+|[─]+$/.test(code.trim());
		const cls = isDecorative ? 'decorative-rule' : 'inline-code';
		return `<code class="${cls}">${code}</code>`;
	});
	result = result
		.replace(/\n\n+/g, '</p><p>')
		.replace(/\n/g, '<br>');
	return result;
}

function nodeToSteps(node: DisplayNode, roundIdx: number, nodeIdx: number): TraceStep[] {
	const ref = { roundIndex: roundIdx, nodeIndex: nodeIdx };

	function makeStep(included: boolean, overrides: Record<string, unknown>, mode?: DisplayMode): TraceStep {
		const type = overrides.type as StepType;
		return { id: nextId('s'), sourceRef: ref, included, displayMode: mode ?? getDefaultMode(type), overrides };
	}

	switch (node.kind) {
		case 'assistant-text':
			return [makeStep(
				!!node.isFinal,
				{ type: 'assistant', html: renderInlineCode(`<p>${escapeHtml(node.text)}</p>`), final: node.isFinal }
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
			return [makeStep(false, { type: 'assistant', html: renderInlineCode(`<p>${escapeHtml(node.text)}</p>`) })];
		case 'compact':
			return [];
		default:
			return [];
	}
}

export function resetStepFromSource(step: TraceStep, view: SessionView): void {
	if (!step.sourceRef) return;
	const round = view.rounds.find((r) => r.index - 1 === step.sourceRef!.roundIndex);
	if (!round) return;
	const node = round.nodes[step.sourceRef.nodeIndex];
	if (!node) return;
	const freshSteps = nodeToSteps(node, step.sourceRef.roundIndex, step.sourceRef.nodeIndex);
	const fresh = freshSteps[0];
	if (!fresh) return;
	step.overrides = fresh.overrides;
	step.displayMode = fresh.displayMode;
	step.shortenedText = undefined;
	step.comment = undefined;
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
	const isCompact = step.displayMode === 'compact';

	function applyBase(s: Step): Step {
		if (step.comment) s.comment = step.comment;
		if (isCompact) s.compact = true;
		if (step.hidden) s.hidden = true;
		return s;
	}

	if (step.inserted) {
		return applyBase({ ...step.inserted });
	}
	if (!step.overrides) return null;

	const o = step.overrides as Record<string, unknown>;
	const type = o.type as string;

	switch (type) {
		case 'assistant': {
			return applyBase({
				type: 'assistant',
				html: (step.shortenedText ?? o.html) as string,
				...(o.final ? { final: true } : {})
			});
		}
		case 'thinking': {
			return applyBase({
				type: 'thinking',
				text: (step.shortenedText ?? o.text) as string
			});
		}
		case 'tool_call': {
			return applyBase({
				type: 'tool_call',
				toolName: o.toolName as string,
				code: (step.shortenedText ?? o.code) as string
			});
		}
		case 'tool_result': {
			return applyBase({
				type: 'tool_result',
				text: (step.shortenedText ?? o.text) as string
			});
		}
		case 'window': {
			return applyBase({
				type: 'window',
				windowTitle: o.windowTitle as string,
				...(o.subtitle ? { subtitle: o.subtitle as string } : {}),
				content: o.content as WindowStep['content']
			});
		}
		default:
			return applyBase(o as unknown as Step);
	}
}

export function traceStateToTutorialRounds(state: TraceState): TutorialRound[] {
	return state.rounds.map((round) => {
		const steps: Step[] = [];
		for (const ts of round.steps) {
			if (!ts.included) continue;
			const step = traceStepToTutorialStep(ts);
			if (step) steps.push(step);
		}
		const tutorialRound: TutorialRound = {
			kind: round.kind,
			prompt: round.prompt,
			steps
		};
		validateTerminalRound(tutorialRound);
		return tutorialRound;
	});
}
