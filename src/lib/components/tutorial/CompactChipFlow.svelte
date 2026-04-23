<!--
	Renders a group of consecutive compact steps as type-colored chips
	in a flex-wrap flow. Clicking a chip expands it inline (radio-select:
	one expanded at a time).

	Used by both the tutorial viewer (TerminalTranscript) and the trace
	editor (UnifiedTracePanel), which wraps it with edit affordances.
-->
<script lang="ts">
	import type { Step, WindowStep } from '$lib/data/tutorials';
	import { getStepStyle, compactSummary } from './step-colors';
	import StepRenderer from './StepRenderer.svelte';

	let {
		steps,
		onFocusWindow
	}: {
		steps: Step[];
		onFocusWindow: (step: WindowStep) => void;
	} = $props();

	let expandedIndex = $state<number | null>(null);

	function toggle(i: number) {
		expandedIndex = expandedIndex === i ? null : i;
	}
</script>

<div class="chip-flow">
	{#each steps as step, i}
		{@const style = getStepStyle(step.type)}
		<button
			type="button"
			class="chip"
			class:chip-expanded={expandedIndex === i}
			style="--chip-accent: {style.accent}"
			onclick={() => toggle(i)}
			title={compactSummary(step)}
		>
			<span class="chip-icon">{style.icon}</span>
			<span class="chip-text">{compactSummary(step)}</span>
		</button>
	{/each}
</div>
{#if expandedIndex !== null && steps[expandedIndex]}
	<div class="chip-expanded-content" style="--chip-accent: {getStepStyle(steps[expandedIndex].type).accent}">
		<StepRenderer
			step={{ ...steps[expandedIndex], compact: false }}
			showClaudeLabel={steps[expandedIndex].type === 'assistant'}
			isLast={false}
			{onFocusWindow}
		/>
	</div>
{/if}

<style>
	.chip-flow {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		padding: 4px 0;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		min-width: 0;
		max-width: 260px;
		background: color-mix(in srgb, var(--chip-accent) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--chip-accent) 20%, transparent);
		border-radius: 14px;
		color: var(--chip-accent);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
	}

	.chip:hover {
		background: color-mix(in srgb, var(--chip-accent) 14%, transparent);
		border-color: color-mix(in srgb, var(--chip-accent) 35%, transparent);
	}

	.chip.chip-expanded {
		background: color-mix(in srgb, var(--chip-accent) 18%, transparent);
		border-color: var(--chip-accent);
	}

	.chip-icon {
		flex-shrink: 0;
		font-size: 0.75rem;
		width: 14px;
		text-align: center;
	}

	.chip-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.chip-expanded-content {
		border-left: 2px solid var(--chip-accent);
		margin: 4px 0 8px 0;
		padding-left: 8px;
		animation: chipReveal 0.15s ease-out;
	}

	@keyframes chipReveal {
		from { opacity: 0; transform: translateY(-4px); }
		to   { opacity: 1; transform: translateY(0); }
	}

	@media (max-width: 900px) {
		.chip {
			font-size: 0.68rem;
			padding: 3px 8px;
			max-width: 200px;
		}
	}
</style>
