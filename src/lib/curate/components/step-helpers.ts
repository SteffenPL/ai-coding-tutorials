import type { TraceStep, TraceRound } from '$lib/trace/types';

export function stepLabel(step: TraceStep): string {
	if (step.inserted) return step.inserted.type;
	const o = step.overrides as Record<string, unknown> | undefined;
	return (o?.type as string) ?? 'unknown';
}

export function stepPreview(step: TraceStep): string {
	if (step.inserted) {
		if (step.inserted.type === 'window') return step.inserted.windowTitle;
		if ('text' in step.inserted) return (step.inserted.text as string).slice(0, 80);
		if ('html' in step.inserted) return (step.inserted.html as string).slice(0, 80);
		return '';
	}
	const o = step.overrides as Record<string, unknown> | undefined;
	if (!o) return '';
	const text =
		step.shortenedText ??
		(o.text as string) ??
		(o.html as string) ??
		(o.code as string) ??
		(o.windowTitle as string) ??
		'';
	return text.slice(0, 100);
}

export function stepIcon(step: TraceStep): string {
	const type = stepLabel(step);
	switch (type) {
		case 'tool_call': return '⚙';
		case 'tool_result': return '↩';
		case 'assistant': return '💬';
		case 'thinking': return '🧠';
		case 'window': return '🖼';
		case 'output': return '$';
		case 'status': return '●';
		case 'divider': return '―';
		case 'permission': return '🔒';
		case 'question': return '?';
		case 'table': return '▤';
		default: return '•';
	}
}

export function stepIconTitle(step: TraceStep): string {
	const type = stepLabel(step);
	const preview = stepPreview(step);
	return preview ? `${type}: ${preview.slice(0, 60)}` : type;
}

export function displayModeIcon(mode: 'compact' | 'full'): string {
	return mode === 'compact' ? '▪' : '▣';
}

export function includedCount(round: TraceRound): number {
	return round.steps.filter((s) => s.included || s.inserted).length;
}

export function totalCount(round: TraceRound): number {
	return round.steps.length;
}
