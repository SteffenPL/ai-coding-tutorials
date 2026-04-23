import type { Step, StepType } from '$lib/data/tutorials';

export interface StepTypeStyle {
	accent: string;
	icon: string;
	label: string;
}

export const stepTypeColors: Record<StepType, StepTypeStyle> = {
	tool_call:   { accent: 'var(--peach)',           icon: '⚡', label: 'tool_call' },
	tool_result: { accent: 'var(--border-subtle)',   icon: '←',  label: 'tool_result' },
	thinking:    { accent: 'var(--mauve)',            icon: '✧',  label: 'thinking' },
	assistant:   { accent: 'var(--teal)',             icon: '○',  label: 'assistant' },
	window:      { accent: 'var(--green)',            icon: '↗',  label: 'window' },
	permission:  { accent: 'var(--orange-300)',       icon: '⚿',  label: 'permission' },
	question:    { accent: 'var(--orange-300)',       icon: '?',  label: 'question' },
	output:      { accent: 'var(--text-tertiary)',    icon: '$',  label: 'output' },
	status:      { accent: 'var(--text-tertiary)',    icon: '•',  label: 'status' },
	table:       { accent: 'var(--text-tertiary)',    icon: '☷',  label: 'table' },
	divider:     { accent: 'var(--text-tertiary)',    icon: '—',  label: 'divider' },
};

export function getStepStyle(type: StepType | string): StepTypeStyle {
	return stepTypeColors[type as StepType] ?? stepTypeColors.status;
}

export function compactSummary(step: Step): string {
	switch (step.type) {
		case 'assistant': return stripHtml(step.html).slice(0, 80);
		case 'thinking': return 'Thinking' + (step.duration ? ` (${step.duration})` : '');
		case 'tool_call': return step.toolName;
		case 'tool_result': return step.text.slice(0, 60);
		case 'permission': return `${step.tool} — ${step.granted ? 'allowed' : 'denied'}`;
		case 'question': return stripHtml(step.html).slice(0, 60);
		case 'output': return step.text.split('\n')[0].slice(0, 60);
		case 'window': return step.windowTitle;
		case 'table': return `Table: ${step.columns.join(', ')}`;
		case 'status': return step.text;
		case 'divider': return step.label;
		default: return '';
	}
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '').trim();
}
