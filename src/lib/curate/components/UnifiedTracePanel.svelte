<script lang="ts">
	import type { Step, WindowContentData, WindowStep } from '$lib/data/tutorials';
	import type { SessionView } from '$lib/session/viewmodel';
	import type { TraceState, TraceStep, TraceRound } from '$lib/trace/types';
	import { traceStepToTutorialStep } from '$lib/trace/convert';
	import { stepLabel, stepIcon, stepPreview, displayModeIcon, includedCount, totalCount } from './step-helpers';
	import StepRenderer from '$lib/components/tutorial/StepRenderer.svelte';

	let {
		curation,
		view,
		editingStep,
		showInsertMenu = $bindable(),
		onToggleRound,
		onToggleStep,
		onMoveStep,
		onRemoveStep,
		onRemoveRound,
		onCycleDisplayMode,
		onAddRound,
		onInsertStep,
		onInsertWindowStep,
		onInsertOutputStep,
		onInsertStatusStep,
		onInsertAssistantStep,
		onInsertDividerStep,
		onToggleHidden,
		onEditStep,
		onResetStep,
		onResetRound
	}: {
		curation: TraceState;
		view: SessionView | null;
		editingStep: { roundId: string; stepId: string } | null;
		showInsertMenu: { roundId: string; afterStepId: string | null } | null;
		onToggleRound: (roundId: string) => void;
		onToggleStep: (roundId: string, stepId: string) => void;
		onMoveStep: (roundId: string, stepId: string, direction: -1 | 1) => void;
		onRemoveStep: (roundId: string, stepId: string) => void;
		onRemoveRound: (roundId: string) => void;
		onCycleDisplayMode: (step: TraceStep) => void;
		onAddRound: (kind: 'claude' | 'terminal') => void;
		onInsertStep: (roundId: string, afterStepId: string | null, step: Step) => void;
		onInsertWindowStep: (roundId: string, afterStepId: string | null, kind: WindowContentData['kind']) => void;
		onInsertOutputStep: (roundId: string, afterStepId: string | null) => void;
		onInsertStatusStep: (roundId: string, afterStepId: string | null) => void;
		onInsertAssistantStep: (roundId: string, afterStepId: string | null) => void;
		onInsertDividerStep: (roundId: string, afterStepId: string | null) => void;
		onToggleHidden: (step: TraceStep) => void;
		onEditStep: (roundId: string, stepId: string) => void;
		onResetStep: (roundId: string, stepId: string) => void;
		onResetRound: (roundId: string) => void;
	} = $props();

	let showExcluded = $state(true);

	function toggleInsertMenu(roundId: string, afterStepId: string | null) {
		showInsertMenu =
			showInsertMenu?.roundId === roundId && showInsertMenu?.afterStepId === afterStepId
				? null
				: { roundId, afterStepId };
	}

	function toPreviewStep(traceStep: TraceStep): Step | null {
		return traceStepToTutorialStep(traceStep);
	}

	function noopFocus(_step: WindowStep) {}
</script>

{#snippet insertMenu(roundId: string, afterStepId: string | null)}
	<div class="insert-menu">
		<button onclick={() => onInsertAssistantStep(roundId, afterStepId)}>Assistant</button>
		<button onclick={() => onInsertStep(roundId, afterStepId, { type: 'tool_call', toolName: '', code: '' })}>Tool Call</button>
		<button onclick={() => onInsertStep(roundId, afterStepId, { type: 'tool_result', text: '' })}>Tool Result</button>
		<button onclick={() => onInsertOutputStep(roundId, afterStepId)}>Output</button>
		<button onclick={() => onInsertStatusStep(roundId, afterStepId)}>Status</button>
		<button onclick={() => onInsertDividerStep(roundId, afterStepId)}>Divider</button>
		<span class="insert-sep">Windows:</span>
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'fiji-image')}>Fiji Image</button>
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'image')}>Image</button>
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'video')}>Video</button>
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'source')}>Source</button>
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'markdown')}>Markdown</button>
	</div>
{/snippet}

{#snippet stepToolbar(round: TraceRound, step: TraceStep)}
	<div class="step-toolbar">
		<span class="toolbar-type">{stepLabel(step)}</span>
		<button class="tb" title={step.displayMode === 'full' ? 'Switch to compact' : 'Switch to full'} onclick={() => onCycleDisplayMode(step)}>{displayModeIcon(step.displayMode)}</button>
		<button class="tb" class:tb-active={step.hidden} title={step.hidden ? 'Unhide' : 'Hide in tutorial'} onclick={() => onToggleHidden(step)}>{step.hidden ? '◌' : '●'}</button>
		{#if step.comment}<span class="tb-badge">💬</span>{/if}
		<span class="tb-spacer"></span>
		<button class="tb" title="Move up" onclick={() => onMoveStep(round.id, step.id, -1)}>↑</button>
		<button class="tb" title="Move down" onclick={() => onMoveStep(round.id, step.id, 1)}>↓</button>
		<button class="tb" title="Edit" onclick={() => onEditStep(round.id, step.id)}>✎</button>
		{#if step.sourceRef}
			<button class="tb" title="Reset to source" onclick={() => onResetStep(round.id, step.id)}>↻</button>
		{/if}
		{#if step.inserted}
			<button class="tb tb-danger" title="Remove" onclick={() => onRemoveStep(round.id, step.id)}>✕</button>
		{:else}
			<button class="tb" title="Exclude" onclick={() => onToggleStep(round.id, step.id)}>⊘</button>
		{/if}
	</div>
{/snippet}

<section class="panel">
	<div class="panel-header">
		<h2>Trace</h2>
		<div class="panel-header-actions">
			<label class="toggle-excluded">
				<input type="checkbox" bind:checked={showExcluded} />
				<span>Show excluded</span>
			</label>
			<span class="panel-meta">{curation.rounds.length} rounds</span>
		</div>
	</div>

	<div class="terminal-bg">
		{#each curation.rounds as round (round.id)}
			{#if round.included === false}
				{#if showExcluded}
					<div class="round-excluded">
						<span class="kind-badge" class:terminal={round.kind === 'terminal'}>{round.kind}</span>
						<span class="round-prompt-preview">{round.prompt.slice(0, 60)}{round.prompt.length > 60 ? '...' : ''}</span>
						<span class="round-count">{totalCount(round)} steps</span>
						<button class="btn-icon btn-include" title="Include round" onclick={() => onToggleRound(round.id)}>+</button>
					</div>
				{/if}
			{:else}
				<div class="trace-round">
					<!-- Round header with real prompt styling -->
					<div class="round-header-bar">
						<span class="kind-badge" class:terminal={round.kind === 'terminal'}>{round.kind}</span>
						{#if round.sourceRoundIndex !== undefined}
							<span class="source-indicator">R{round.sourceRoundIndex + 1}</span>
						{/if}
						<span class="round-count">{includedCount(round)}/{totalCount(round)}</span>
						<div class="round-actions">
							{#if view && round.sourceRoundIndex !== undefined}
								<button class="btn-icon" title="Reset round" onclick={() => onResetRound(round.id)}>↻</button>
							{/if}
							<button class="btn-icon" title="Hide round" onclick={() => onToggleRound(round.id)}>⊘</button>
							<button class="btn-icon danger" title="Remove round" onclick={() => onRemoveRound(round.id)}>✕</button>
						</div>
					</div>

					<!-- Prompt rendered like the real terminal -->
					{#if round.kind === 'terminal'}
						<div class="prompt-block terminal-prompt">
							<div class="terminal-cmd">
								<span class="terminal-percent">%</span>
								<input class="prompt-input terminal-input" type="text" bind:value={round.prompt} placeholder="Command..." />
							</div>
						</div>
					{:else}
						<div class="prompt-block">
							<span class="prompt-chevron">›</span>
							<input class="prompt-input" type="text" bind:value={round.prompt} placeholder="User prompt..." />
						</div>
					{/if}

					<!-- Insert at top of round -->
					<button class="insert-btn" onclick={() => toggleInsertMenu(round.id, null)}>+</button>
					{#if showInsertMenu?.roundId === round.id && showInsertMenu?.afterStepId === null}
						{@render insertMenu(round.id, null)}
					{/if}

					<!-- Steps rendered with real StepRenderer -->
					{#each round.steps as step (step.id)}
						{#if step.included || step.inserted}
							{@const previewStep = toPreviewStep(step)}
							<div
								class="step-wrap"
								class:editing={editingStep?.stepId === step.id}
								class:step-hidden={step.hidden}
								class:step-excluded-style={false}
							>
								{@render stepToolbar(round, step)}
								<div class="step-render">
									{#if previewStep}
										<StepRenderer
											step={previewStep}
											showClaudeLabel={previewStep.type === 'assistant'}
											isLast={false}
											onFocusWindow={noopFocus}
										/>
									{:else}
										<div class="step-empty">Empty step — click ✎ to edit</div>
									{/if}
								</div>
							</div>
						{:else if showExcluded}
							<div class="step-wrap step-excluded-row">
								<span class="excluded-icon">{stepIcon(step)}</span>
								<span class="excluded-type">{stepLabel(step)}</span>
								<span class="excluded-preview">{stepPreview(step).slice(0, 50)}</span>
								<button class="btn-icon btn-include" title="Include" onclick={() => onToggleStep(round.id, step.id)}>+</button>
							</div>
						{/if}

						{#if step.included || step.inserted}
							<button class="insert-btn" onclick={() => toggleInsertMenu(round.id, step.id)}>+</button>
							{#if showInsertMenu?.roundId === round.id && showInsertMenu?.afterStepId === step.id}
								{@render insertMenu(round.id, step.id)}
							{/if}
						{/if}
					{/each}
				</div>
			{/if}
		{/each}

		<div class="add-round-actions">
			<button class="btn" onclick={() => onAddRound('claude')}>+ Claude Round</button>
			<button class="btn" onclick={() => onAddRound('terminal')}>+ Terminal Round</button>
		</div>
	</div>
</section>

<style>
	.panel {
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 10px;
		overflow: hidden;
	}
	.panel-header {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: rgba(28, 16, 26, 0.95);
		backdrop-filter: blur(12px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	.panel-header h2 {
		font-size: 1rem;
		color: var(--orange-300);
		margin: 0;
		font-weight: 600;
	}
	.panel-header-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.panel-meta {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}
	.toggle-excluded {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
	}
	.toggle-excluded input { accent-color: var(--accent); }
	.toggle-excluded span {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-secondary);
	}

	/* ─── Terminal-like background ─── */
	.terminal-bg {
		background: #241a20;
		padding: 12px 16px;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.65;
	}

	/* ─── Round ─── */
	.trace-round {
		margin-bottom: 1rem;
	}
	.round-header-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.3rem 0;
		margin-bottom: 0.25rem;
	}
	.kind-badge {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.15rem 0.4rem;
		border-radius: 3px;
		background: var(--accent-soft);
		color: var(--orange-300);
		flex-shrink: 0;
		font-weight: 600;
	}
	.kind-badge.terminal {
		background: rgba(112, 200, 184, 0.18);
		color: var(--teal);
	}
	.source-indicator {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.07);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
	}
	.round-count {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
	}
	.round-actions {
		margin-left: auto;
		display: flex;
		gap: 0.15rem;
	}

	/* ─── Prompt (matches real terminal styling) ─── */
	.prompt-block {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 16px;
		background: rgba(233, 84, 32, 0.14);
		border-right: 3px solid var(--accent);
		border-radius: 6px 0 0 6px;
		margin-bottom: 4px;
	}
	.prompt-chevron {
		color: var(--accent);
		font-weight: 700;
		font-size: 18px;
		line-height: 1.4;
		flex-shrink: 0;
		user-select: none;
	}
	.prompt-input {
		flex: 1;
		background: transparent;
		border: none;
		border-bottom: 1px dashed rgba(255, 255, 255, 0.15);
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.65;
		padding: 0;
	}
	.prompt-input:focus {
		outline: none;
		border-bottom-color: var(--orange-400);
	}
	.prompt-block.terminal-prompt {
		background: rgba(255, 255, 255, 0.04);
		border-right-color: var(--text-tertiary);
	}
	.terminal-cmd {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1;
	}
	.terminal-percent {
		color: var(--green);
		font-weight: 700;
		user-select: none;
	}
	.terminal-input {
		color: var(--text-primary);
	}

	/* ─── Excluded round ─── */
	.round-excluded {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.35rem 0.5rem;
		opacity: 0.4;
		border: 1px dashed rgba(255, 255, 255, 0.1);
		border-radius: 6px;
		margin-bottom: 0.5rem;
		transition: opacity 0.15s;
	}
	.round-excluded:hover { opacity: 0.65; }
	.round-prompt-preview {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--text-secondary);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ─── Step wrapper with hover toolbar ─── */
	.step-wrap {
		position: relative;
		border-radius: 4px;
		transition: background 0.15s;
	}
	.step-wrap:hover {
		background: rgba(255, 255, 255, 0.02);
	}
	.step-wrap.editing {
		outline: 1px solid rgba(233, 84, 32, 0.4);
		outline-offset: -1px;
	}
	.step-wrap.step-hidden {
		opacity: 0.45;
		border-left: 2px dashed var(--mauve);
	}

	/* Floating toolbar — hidden by default, visible on hover */
	.step-toolbar {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 3;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 2px 4px;
		background: rgba(18, 8, 16, 0.92);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0 4px 0 6px;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.12s;
	}
	.step-wrap:hover > .step-toolbar {
		opacity: 1;
		pointer-events: auto;
	}

	.toolbar-type {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0 0.3rem;
	}
	.tb {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.72rem;
		padding: 0.15rem 0.3rem;
		border-radius: 3px;
		line-height: 1;
	}
	.tb:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}
	.tb-active {
		color: var(--mauve);
	}
	.tb-danger:hover {
		color: var(--red);
	}
	.tb-badge {
		font-size: 0.65rem;
		line-height: 1;
	}
	.tb-spacer {
		width: 1px;
		height: 12px;
		background: rgba(255, 255, 255, 0.1);
		margin: 0 2px;
	}

	.step-render {
		position: relative;
		z-index: 1;
	}
	.step-empty {
		padding: 8px 14px;
		color: var(--text-tertiary);
		font-style: italic;
		font-size: 12px;
	}

	/* ─── Excluded step row ─── */
	.step-excluded-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0.6rem;
		opacity: 0.35;
		transition: opacity 0.15s;
	}
	.step-excluded-row:hover {
		opacity: 0.6;
	}
	.excluded-icon { font-size: 0.8rem; width: 1.2rem; text-align: center; }
	.excluded-type {
		font-size: 0.65rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		min-width: 5rem;
	}
	.excluded-preview {
		color: var(--text-tertiary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
		font-size: 0.7rem;
	}
	.btn-include {
		color: var(--teal) !important;
		font-weight: 600;
		font-size: 0.85rem !important;
	}

	/* ─── Insert button & menu ─── */
	.insert-btn {
		display: block;
		width: 100%;
		padding: 1px;
		background: transparent;
		border: 1px dashed transparent;
		border-radius: 3px;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		cursor: pointer;
		text-align: center;
		opacity: 0.3;
		transition: all 0.15s;
	}
	.insert-btn:hover {
		border-color: var(--orange-400);
		color: var(--orange-300);
		background: rgba(233, 84, 32, 0.06);
		opacity: 1;
	}
	.insert-menu {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		padding: 0.5rem;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		margin: 0.25rem 0;
	}
	.insert-menu button {
		padding: 0.25rem 0.6rem;
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		cursor: pointer;
	}
	.insert-menu button:hover {
		background: var(--accent-soft);
		color: var(--orange-300);
		border-color: var(--orange-500);
	}
	.insert-sep {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--text-secondary);
		align-self: center;
		margin: 0 0.25rem;
	}

	.add-round-actions {
		display: flex;
		gap: 0.6rem;
		padding: 1rem 0;
		justify-content: center;
	}

	/* ─── Buttons ─── */
	.btn {
		padding: 0.4rem 0.85rem;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.82rem;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}
	.btn:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: var(--orange-400);
	}
	.btn-icon {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.72rem;
		padding: 0.15rem 0.3rem;
		border-radius: 3px;
	}
	.btn-icon:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}
	.btn-icon.danger:hover {
		color: var(--red);
	}
</style>
