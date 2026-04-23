<script lang="ts">
	import type { SessionView } from '$lib/session/viewmodel';
	import type { TraceState, TraceStep } from '$lib/trace/types';
	import { stepLabel, stepIcon, stepPreview, displayModeIcon, includedCount, totalCount } from './step-helpers';

	let {
		view,
		curation,
		editingStep,
		onToggleStep,
		onIncludeAll,
		onExcludeAll,
		onIncludeToolsOnly,
		onCycleDisplayMode,
		onEditStep
	}: {
		view: SessionView;
		curation: TraceState;
		editingStep: { roundId: string; stepId: string } | null;
		onToggleStep: (roundId: string, stepId: string) => void;
		onIncludeAll: (roundId: string) => void;
		onExcludeAll: (roundId: string) => void;
		onIncludeToolsOnly: (roundId: string) => void;
		onCycleDisplayMode: (step: TraceStep) => void;
		onEditStep: (roundId: string, stepId: string) => void;
	} = $props();
</script>

<section class="panel source-panel">
	<div class="panel-header">
		<h2>Source Session</h2>
		<span class="panel-meta">{view.stats.rounds} rounds · {view.stats.toolInvocations} tools</span>
	</div>

	{#each view.rounds.filter((r) => r.prompt.kind === 'normal') as round (round.anchor)}
		{@const cRound = curation.rounds.find((cr) => cr.sourceRoundIndex === round.index - 1)}
		<div class="source-round">
			<div class="source-round-header">
				<span class="round-label">R{round.index}</span>
				<span class="round-prompt">{round.prompt.text.slice(0, 80)}{round.prompt.text.length > 80 ? '...' : ''}</span>
				{#if cRound}
					<span class="round-count">{includedCount(cRound)}/{totalCount(cRound)}</span>
				{/if}
			</div>
			{#if cRound}
				<div class="source-round-actions">
					<button class="btn-sm" onclick={() => onIncludeAll(cRound.id)}>All</button>
					<button class="btn-sm" onclick={() => onExcludeAll(cRound.id)}>None</button>
					<button class="btn-sm" onclick={() => onIncludeToolsOnly(cRound.id)}>Tools only</button>
				</div>
				<div class="source-steps">
					{#each cRound.steps as step (step.id)}
						{#if step.sourceRef !== undefined}
							<div
								class="source-step"
								class:included={step.included}
								class:excluded={!step.included}
								class:is-compact={step.displayMode === 'compact'}
							>
								<label class="step-check">
									<input
										type="checkbox"
										checked={step.included}
										onchange={() => onToggleStep(cRound.id, step.id)}
									/>
									<span class="step-icon" title={stepLabel(step)}>{stepIcon(step)}</span>
									<span class="step-type">{stepLabel(step)}</span>
								</label>
								<button
									class="btn-mode"
									title="{step.displayMode === 'compact' ? 'Compact' : 'Full'} — click to toggle"
									onclick={() => onCycleDisplayMode(step)}
								>{displayModeIcon(step.displayMode)}</button>
								<span class="step-preview">{stepPreview(step)}</span>
								<button
									class="btn-icon"
									title="Edit"
									onclick={() => onEditStep(cRound.id, step.id)}
								>
									&#9998;
								</button>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</section>

<style>
	/* ─── Panels (shared) ─────────────────────── */
	.panel {
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		background: rgba(18, 8, 16, 0.85);
		backdrop-filter: blur(12px);
		overflow-y: auto;
		max-height: calc(100vh - 10rem);
		position: sticky;
		top: calc(56px + 3rem);
	}
	.panel-header {
		position: sticky;
		top: 0;
		z-index: 2;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		background: rgba(18, 8, 16, 0.95);
		border-bottom: 1px solid var(--border-subtle);
	}
	.panel-header h2 {
		font-size: 0.9rem;
		color: var(--orange-300);
		margin: 0;
		font-weight: 500;
	}
	.panel-meta {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
	}

	/* ─── Source panel ────────────────────────── */
	.source-round {
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
		padding: 0.6rem 0.8rem;
	}
	.source-round-header {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}
	.round-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--orange-300);
		font-weight: 600;
		flex-shrink: 0;
	}
	.round-prompt {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	.round-count {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}
	.source-round-actions {
		display: flex;
		gap: 0.3rem;
		margin-bottom: 0.4rem;
	}
	.source-steps {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.source-step {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.4rem;
		border-radius: 4px;
		font-size: 0.73rem;
		transition: opacity 0.15s;
	}
	.source-step.excluded {
		opacity: 0.4;
	}
	.source-step.included {
		background: rgba(255, 255, 255, 0.03);
	}
	.step-check {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		cursor: pointer;
		flex-shrink: 0;
	}
	.step-check input[type='checkbox'] {
		accent-color: var(--accent);
	}
	.step-type {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		min-width: 5.5rem;
	}
	.step-preview {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	/* ─── Per-step display mode ───────────────── */
	.btn-mode {
		background: none;
		border: 1px solid var(--border-subtle);
		border-radius: 3px;
		color: var(--text-tertiary);
		font-size: 0.65rem;
		cursor: pointer;
		padding: 0.1rem 0.3rem;
		line-height: 1;
		flex-shrink: 0;
		transition: all 0.12s;
	}
	.btn-mode:hover {
		color: var(--orange-300);
		border-color: var(--orange-400);
	}
	.source-step .step-icon {
		font-size: 0.72rem;
		line-height: 1;
		width: 1.2rem;
		text-align: center;
	}
	.source-step.is-compact {
		background: rgba(255, 255, 255, 0.01);
		border-left: 2px solid var(--text-tertiary);
		padding-left: 0.3rem;
	}
	.source-step.is-compact .step-preview {
		max-width: 12ch;
	}

	/* ─── Buttons ─────────────────────────────── */
	.btn-sm {
		padding: 0.2rem 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		cursor: pointer;
	}
	.btn-sm:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}
	.btn-icon {
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.15rem 0.3rem;
		border-radius: 3px;
	}
	.btn-icon:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}
</style>
