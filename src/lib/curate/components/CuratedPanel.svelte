<script lang="ts">
	import type { Step, WindowContentData } from '$lib/data/tutorials';
	import type { TraceState, TraceStep } from '$lib/trace/types';
	import { stepLabel, stepIcon, stepPreview, displayModeIcon } from './step-helpers';

	let {
		curation,
		curatedRounds,
		editingStep,
		showInsertMenu = $bindable(),
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
		onEditStep
	}: {
		curation: TraceState;
		curatedRounds: typeof curation.rounds;
		editingStep: { roundId: string; stepId: string } | null;
		showInsertMenu: { roundId: string; afterStepId: string | null } | null;
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
		onEditStep: (roundId: string, stepId: string) => void;
	} = $props();

	function toggleInsertMenu(roundId: string, afterStepId: string | null) {
		showInsertMenu =
			showInsertMenu?.roundId === roundId && showInsertMenu?.afterStepId === afterStepId
				? null
				: { roundId, afterStepId };
	}
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
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'fiji-main')}>Fiji Main</button>
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'image')}>Image</button>
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'video')}>Video</button>
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'source')}>Source</button>
		<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'markdown')}>Markdown</button>
	</div>
{/snippet}

<section class="panel curated-panel">
	<div class="panel-header">
		<h2>Curated Tutorial</h2>
		<span class="panel-meta">{curatedRounds.length} rounds</span>
	</div>

	{#each curation.rounds as round (round.id)}
		{@const included = round.steps.filter((s) => s.included || s.inserted)}
		{#if included.length > 0 || !round.sourceRoundIndex}
			<div class="curated-round">
				<div class="curated-round-header">
					<span class="kind-badge" class:terminal={round.kind === 'terminal'}>
						{round.kind}
					</span>
					<input
						class="prompt-input"
						type="text"
						bind:value={round.prompt}
						placeholder="Round prompt..."
					/>
					<button class="btn-icon danger" title="Remove round" onclick={() => onRemoveRound(round.id)}>
						&#x2715;
					</button>
				</div>

				<!-- Insert at top -->
				<button
					class="insert-btn"
					onclick={() => toggleInsertMenu(round.id, null)}
				>
					+ Insert
				</button>
				{#if showInsertMenu?.roundId === round.id && showInsertMenu?.afterStepId === null}
					{@render insertMenu(round.id, null)}
				{/if}

				{#each included as step (step.id)}
					{#if step.displayMode === 'compact'}
						<div class="curated-step curated-step-compact" class:editing={editingStep?.stepId === step.id}>
							<span class="compact-icon">{stepIcon(step)}</span>
							<span class="compact-type">{stepLabel(step)}</span>
							<button
								class="btn-mode"
								title="Compact — click for full"
								onclick={() => onCycleDisplayMode(step)}
							>{displayModeIcon(step.displayMode)}</button>
							{#if step.comment}<span class="has-comment" title="Has comment">&#128172;</span>{/if}
							<div class="step-actions">
								<button class="btn-icon" title="Move up" onclick={() => onMoveStep(round.id, step.id, -1)}>&#x25B2;</button>
								<button class="btn-icon" title="Move down" onclick={() => onMoveStep(round.id, step.id, 1)}>&#x25BC;</button>
								<button
									class="btn-icon"
									title="Edit"
									onclick={() => onEditStep(round.id, step.id)}
								>&#9998;</button>
								{#if step.inserted}
									<button class="btn-icon danger" title="Remove" onclick={() => onRemoveStep(round.id, step.id)}>&#x2715;</button>
								{/if}
							</div>
						</div>
					{:else}
						<div class="curated-step" class:editing={editingStep?.stepId === step.id}>
							<div class="curated-step-header">
								<span class="step-type-badge">{stepLabel(step)}</span>
								<button
									class="btn-mode"
									title="Full — click for compact"
									onclick={() => onCycleDisplayMode(step)}
								>{displayModeIcon(step.displayMode)}</button>
								{#if step.comment}
									<span class="has-comment" title="Has comment">&#128172;</span>
								{/if}
								<div class="step-actions">
									<button
										class="btn-icon"
										title="Move up"
										onclick={() => onMoveStep(round.id, step.id, -1)}
									>&#x25B2;</button>
									<button
										class="btn-icon"
										title="Move down"
										onclick={() => onMoveStep(round.id, step.id, 1)}
									>&#x25BC;</button>
									<button
										class="btn-icon"
										title="Edit"
										onclick={() => onEditStep(round.id, step.id)}
									>&#9998;</button>
									{#if step.inserted}
										<button
											class="btn-icon danger"
											title="Remove"
											onclick={() => onRemoveStep(round.id, step.id)}
										>&#x2715;</button>
									{/if}
								</div>
							</div>
							<div class="curated-step-preview">
								{stepPreview(step)}
							</div>
						</div>
					{/if}

					<!-- Insert after this step -->
					<button
						class="insert-btn"
						onclick={() => toggleInsertMenu(round.id, step.id)}
					>
						+ Insert
					</button>
					{#if showInsertMenu?.roundId === round.id && showInsertMenu?.afterStepId === step.id}
						{@render insertMenu(round.id, step.id)}
					{/if}
				{/each}
			</div>
		{/if}
	{/each}

	<div class="add-round-actions">
		<button class="btn" onclick={() => onAddRound('claude')}>+ Claude Round</button>
		<button class="btn" onclick={() => onAddRound('terminal')}>+ Terminal Round</button>
	</div>
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

	/* ─── Curated panel ──────────────────────── */
	.curated-round {
		margin: 0.6rem 0.8rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.15);
		padding: 0.5rem;
	}
	.curated-round-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.3rem;
	}
	.kind-badge {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0.15rem 0.4rem;
		border-radius: 3px;
		background: var(--accent-soft);
		color: var(--orange-300);
		flex-shrink: 0;
	}
	.kind-badge.terminal {
		background: rgba(112, 200, 184, 0.15);
		color: var(--teal);
	}
	.prompt-input {
		flex: 1;
		padding: 0.3rem 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.73rem;
	}
	.prompt-input:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	.curated-step {
		padding: 0.35rem 0.5rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.04);
	}
	.curated-step-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.step-type-badge {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.04);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
	}
	.has-comment {
		font-size: 0.7rem;
	}
	.step-actions {
		margin-left: auto;
		display: flex;
		gap: 0.15rem;
	}
	.curated-step-preview {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-top: 0.2rem;
		padding-left: 0.35rem;
	}

	/* Curated compact step */
	.curated-step-compact {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.22rem 0.5rem;
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.04);
		font-family: var(--font-mono);
		font-size: 0.68rem;
	}
	.curated-step-compact .compact-icon {
		font-size: 0.75rem;
	}
	.curated-step-compact .compact-type {
		color: var(--text-tertiary);
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.curated-step.editing,
	.curated-step-compact.editing {
		border-color: var(--orange-500);
		box-shadow: 0 0 0 1px rgba(233, 84, 32, 0.3);
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

	/* ─── Insert button & menu ────────────────── */
	.insert-btn {
		display: block;
		width: 100%;
		padding: 0.15rem;
		background: transparent;
		border: 1px dashed transparent;
		border-radius: 3px;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.6rem;
		cursor: pointer;
		text-align: center;
		transition: all 0.15s;
	}
	.insert-btn:hover {
		border-color: var(--orange-400);
		color: var(--orange-300);
		background: rgba(233, 84, 32, 0.05);
	}
	.insert-menu {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		padding: 0.4rem;
		background: rgba(0, 0, 0, 0.4);
		border: 1px solid var(--border-subtle);
		border-radius: 5px;
		margin: 0.2rem 0;
	}
	.insert-menu button {
		padding: 0.2rem 0.5rem;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		cursor: pointer;
	}
	.insert-menu button:hover {
		background: var(--accent-soft);
		color: var(--orange-300);
		border-color: var(--orange-500);
	}
	.insert-sep {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--text-tertiary);
		align-self: center;
		margin: 0 0.2rem;
	}

	.add-round-actions {
		display: flex;
		gap: 0.5rem;
		padding: 0.8rem;
		justify-content: center;
	}

	/* ─── Buttons ─────────────────────────────── */
	.btn {
		padding: 0.35rem 0.75rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s, border-color 0.15s;
	}
	.btn:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: var(--orange-400);
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
	.btn-icon.danger:hover {
		color: var(--red);
	}
</style>
