<script lang="ts">
	import type { Step, WindowContentData, WindowStep } from '$lib/data/tutorials';
	import type { SessionView } from '$lib/session/viewmodel';
	import type { TraceState, TraceStep, TraceRound } from '$lib/trace/types';
	import { traceStepToTutorialStep } from '$lib/trace/convert';
	import { rewriteContent } from '$lib/compose/resolve';
	import { stepLabel, stepIcon, stepPreview, displayModeIcon, includedCount, totalCount } from './step-helpers';
	import { getStepStyle, getCategory, getDefaultMode, categoryLabels, compactSummary as sharedCompactSummary } from '$lib/components/tutorial/step-colors';
	import StepRenderer from '$lib/components/tutorial/StepRenderer.svelte';

	let {
		slug,
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
		slug: string;
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
	let combineCompact = $state(true);
	let expandedCompactId: string | null = $state(null);
	let editingCommentId: string | null = $state(null);
	let commentEditValue = $state('');
	let inlineEditingStep: string | null = $state(null);
	let inlineEditValues: { content: string; toolName: string } = $state({ content: '', toolName: '' });

	function hideAllActions() {
		for (const round of curation.rounds) {
			for (const step of round.steps) {
				if (!step.included && !step.inserted) continue;
				const cat = getCategory(stepLabel(step));
				if (cat === 'supporting' && !step.hidden) {
					onToggleHidden(step);
				}
			}
		}
	}

	function getCommentText(step: TraceStep): string {
		if (!step.comment) return '';
		return typeof step.comment === 'string' ? step.comment : step.comment.en ?? '';
	}

	function startCommentEdit(step: TraceStep) {
		editingCommentId = step.id;
		commentEditValue = getCommentText(step);
	}

	function saveComment(step: TraceStep) {
		if (commentEditValue.trim()) {
			if (typeof step.comment === 'object' && step.comment?.ja) {
				step.comment = { en: commentEditValue.trim(), ja: step.comment.ja };
			} else {
				step.comment = commentEditValue.trim();
			}
		} else {
			step.comment = undefined;
		}
		editingCommentId = null;
	}

	function cancelCommentEdit(step?: TraceStep) {
		if (step && step.comment === '') {
			step.comment = undefined;
		}
		editingCommentId = null;
	}

	function addComment(step: TraceStep) {
		step.comment = '';
		startCommentEdit(step);
	}

	function handleCommentKeydown(e: KeyboardEvent, step: TraceStep) {
		if (e.key === 'Escape') {
			e.preventDefault();
			cancelCommentEdit(step);
		} else if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			saveComment(step);
		}
	}

	const inlineEditableTypes = new Set(['assistant', 'thinking', 'tool_call', 'tool_result', 'output']);

	function canInlineEdit(step: TraceStep): boolean {
		return inlineEditableTypes.has(stepLabel(step));
	}

	function getInlineEditContent(step: TraceStep): string {
		if (step.inserted) {
			const ins = step.inserted;
			if (ins.type === 'assistant') return ins.html;
			if ('text' in ins) return ins.text as string;
			if (ins.type === 'tool_call') return ins.code;
			return '';
		}
		const o = step.overrides as Record<string, unknown>;
		const type = o?.type as string;
		if (type === 'assistant') return (step.shortenedText ?? o.html) as string;
		if (type === 'thinking') return (step.shortenedText ?? o.text) as string;
		if (type === 'tool_call') return (step.shortenedText ?? o.code) as string;
		if (type === 'tool_result' || type === 'output') return (step.shortenedText ?? o.text) as string;
		return '';
	}

	function getToolName(step: TraceStep): string {
		if (step.inserted && step.inserted.type === 'tool_call') return step.inserted.toolName;
		return ((step.overrides as Record<string, unknown>)?.toolName as string) ?? '';
	}

	function startInlineEdit(step: TraceStep) {
		if (!canInlineEdit(step)) return;
		inlineEditingStep = step.id;
		inlineEditValues = {
			content: getInlineEditContent(step),
			toolName: getToolName(step)
		};
	}

	function saveInlineEdit(step: TraceStep) {
		const type = stepLabel(step);
		if (step.inserted) {
			if (step.inserted.type === 'assistant') step.inserted.html = inlineEditValues.content;
			else if (step.inserted.type === 'tool_call') {
				step.inserted.toolName = inlineEditValues.toolName;
				step.inserted.code = inlineEditValues.content;
			}
			else if ('text' in step.inserted) (step.inserted as { text: string }).text = inlineEditValues.content;
		} else {
			if (type === 'tool_call') {
				(step.overrides as Record<string, unknown>).toolName = inlineEditValues.toolName;
			}
			step.shortenedText = inlineEditValues.content;
		}
		inlineEditingStep = null;
	}

	function cancelInlineEdit() {
		inlineEditingStep = null;
	}

	function handleInlineKeydown(e: KeyboardEvent, step: TraceStep) {
		if (e.key === 'Escape') {
			e.preventDefault();
			cancelInlineEdit();
		} else if (e.key === 'Enter' && e.ctrlKey) {
			e.preventDefault();
			saveInlineEdit(step);
		}
	}

	function handleStepDblClick(step: TraceStep, roundId: string) {
		if (canInlineEdit(step)) {
			startInlineEdit(step);
		} else {
			onEditStep(roundId, step.id);
		}
	}

	function toggleInsertMenu(roundId: string, afterStepId: string | null) {
		showInsertMenu =
			showInsertMenu?.roundId === roundId && showInsertMenu?.afterStepId === afterStepId
				? null
				: { roundId, afterStepId };
	}

	function toPreviewStep(traceStep: TraceStep): Step | null {
		const step = traceStepToTutorialStep(traceStep);
		if (step && step.type === 'window') {
			return { ...step, content: rewriteContent(slug, step.content) };
		}
		return step;
	}

	function noopFocus(_step: WindowStep) {}

	function isCompactStep(step: TraceStep): boolean {
		return step.displayMode === 'compact' && (step.included || !!step.inserted);
	}

	function toggleCompactExpand(stepId: string) {
		expandedCompactId = expandedCompactId === stepId ? null : stepId;
	}

	function compactChipIcon(step: TraceStep): string {
		const type = stepLabel(step);
		return getStepStyle(type as import('$lib/data/tutorials').StepType).icon;
	}

	function compactChipText(step: TraceStep): string {
		return stepPreview(step).slice(0, 40) || stepLabel(step);
	}

	type StepGroup =
		| { kind: 'compact'; steps: TraceStep[] }
		| { kind: 'full'; step: TraceStep }
		| { kind: 'excluded'; step: TraceStep };

	function isExcluded(step: TraceStep): boolean {
		return !step.included && !step.inserted;
	}

	function groupSteps(steps: TraceStep[]): StepGroup[] {
		const groups: StepGroup[] = [];
		let compactBuf: TraceStep[] = [];

		function flushCompact() {
			if (compactBuf.length > 0) {
				groups.push({ kind: 'compact', steps: compactBuf });
				compactBuf = [];
			}
		}

		for (const step of steps) {
			if (isExcluded(step) && !showExcluded) continue;
			if (isCompactStep(step)) {
				if (combineCompact) {
					if (!step.hidden || showExcluded) compactBuf.push(step);
				} else {
					groups.push({ kind: 'full', step });
				}
			} else if (step.included || step.inserted) {
				flushCompact();
				groups.push({ kind: 'full', step });
			} else {
				flushCompact();
				groups.push({ kind: 'excluded', step });
			}
		}
		flushCompact();
		return groups;
	}
</script>

{#snippet insertMenu(roundId: string, afterStepId: string | null)}
	<div class="insert-menu">
		<div class="insert-row">
			<span class="insert-cat">Primary</span>
			<button onclick={() => onInsertAssistantStep(roundId, afterStepId)}>Assistant</button>
			<button onclick={() => onInsertOutputStep(roundId, afterStepId)}>Output</button>
			<button onclick={() => onInsertStep(roundId, afterStepId, { type: 'question', html: '<p>Question?</p>', answer: '1' })}>Question</button>
			<button onclick={() => onInsertStatusStep(roundId, afterStepId)}>Status</button>
			<button onclick={() => onInsertDividerStep(roundId, afterStepId)}>Divider</button>
		</div>
		<div class="insert-row">
			<span class="insert-cat">Tool</span>
			<button onclick={() => onInsertStep(roundId, afterStepId, { type: 'tool_call', toolName: '', code: '' })}>Tool Call</button>
			<button onclick={() => onInsertStep(roundId, afterStepId, { type: 'tool_result', text: '' })}>Tool Result</button>
		</div>
		<div class="insert-row">
			<span class="insert-cat">Content</span>
			<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'fiji-image')}>Fiji Image</button>
			<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'image')}>Image</button>
			<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'video')}>Video</button>
			<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'source')}>Source</button>
			<button onclick={() => onInsertWindowStep(roundId, afterStepId, 'markdown')}>Markdown</button>
		</div>
	</div>
{/snippet}

{#snippet inlineEditor(step: TraceStep)}
	{@const type = stepLabel(step)}
	<div class="inline-edit-area">
		<div class="inline-edit-header">
			<span class="inline-edit-label">{type}</span>
			<span class="inline-edit-hint">Ctrl+Enter to save · Esc to cancel</span>
		</div>
		{#if type === 'tool_call'}
			<label class="inline-field">
				<span class="inline-field-label">Tool Name</span>
				<input
					type="text"
					class="inline-input"
					bind:value={inlineEditValues.toolName}
					onkeydown={(e) => handleInlineKeydown(e, step)}
				/>
			</label>
			<label class="inline-field">
				<span class="inline-field-label">Code</span>
				<textarea
					class="inline-textarea mono"
					bind:value={inlineEditValues.content}
					onkeydown={(e) => handleInlineKeydown(e, step)}
					rows="8"
				></textarea>
			</label>
		{:else}
			<textarea
				class="inline-textarea"
				class:mono={type === 'tool_result' || type === 'output'}
				bind:value={inlineEditValues.content}
				onkeydown={(e) => handleInlineKeydown(e, step)}
				rows="6"
			></textarea>
		{/if}
		<div class="inline-edit-actions">
			<button class="btn-sm" onclick={() => saveInlineEdit(step)}>Save</button>
			<button class="btn-sm btn-cancel" onclick={cancelInlineEdit}>Cancel</button>
		</div>
	</div>
{/snippet}

{#snippet stepToolbar(round: TraceRound, step: TraceStep)}
	{@const type = stepLabel(step)}
	{@const cat = getCategory(type)}
	{@const isOverridden = step.displayMode !== getDefaultMode(type)}
	<div class="step-toolbar">
		<span class="toolbar-type">{type}</span>
		<span class="toolbar-cat" class:cat-primary={cat === 'primary'} class:cat-supporting={cat === 'supporting'} class:cat-structural={cat === 'structural'}>{categoryLabels[cat]}</span>

		<span class="tb-spacer"></span>

		<!-- Primary: Edit -->
		<button class="tb-labeled" title="Edit" onclick={() => onEditStep(round.id, step.id)}>
			<span class="tb-icon">✎</span><span class="tb-label">Edit</span>
		</button>

		<span class="tb-spacer"></span>

		<!-- Display controls -->
		<button class="tb-labeled" class:tb-override={isOverridden} title="Mode: {step.displayMode} (default: {getDefaultMode(type)})" onclick={() => onCycleDisplayMode(step)}>
			<span class="tb-icon">{displayModeIcon(step.displayMode)}</span><span class="tb-label">{step.displayMode}</span>
		</button>
		<button class="tb-labeled" class:tb-active={step.hidden} title={step.hidden ? 'Unhide' : 'Hide in tutorial'} onclick={() => onToggleHidden(step)}>
			<span class="tb-icon">{step.hidden ? '◌' : '●'}</span><span class="tb-label">{step.hidden ? 'Hidden' : 'Visible'}</span>
		</button>
		{#if !step.comment}
			<button class="tb-labeled" title="Add comment" onclick={() => addComment(step)}>
				<span class="tb-icon">💬</span><span class="tb-label">Comment</span>
			</button>
		{/if}

		<span class="tb-spacer"></span>

		<!-- Move -->
		<button class="tb" title="Move up" onclick={() => onMoveStep(round.id, step.id, -1)}>↑</button>
		<button class="tb" title="Move down" onclick={() => onMoveStep(round.id, step.id, 1)}>↓</button>

		<span class="tb-spacer"></span>

		<!-- Reset / Remove -->
		{#if step.sourceRef}
			<button class="tb-labeled" title="Reset to source" onclick={() => onResetStep(round.id, step.id)}>
				<span class="tb-icon">↻</span><span class="tb-label">Reset</span>
			</button>
		{/if}
		{#if step.inserted}
			<button class="tb-labeled tb-danger" title="Remove" onclick={() => onRemoveStep(round.id, step.id)}>
				<span class="tb-icon">✕</span><span class="tb-label">Remove</span>
			</button>
		{:else}
			<button class="tb-labeled" title="Exclude" onclick={() => onToggleStep(round.id, step.id)}>
				<span class="tb-icon">⊘</span><span class="tb-label">Exclude</span>
			</button>
		{/if}
	</div>
{/snippet}

{#snippet commentBlock(step: TraceStep)}
	{#if step.comment || editingCommentId === step.id}
		<div class="comment-block">
			<span class="comment-label">📝 Comment</span>
			{#if editingCommentId === step.id}
				<textarea
					class="comment-edit"
					bind:value={commentEditValue}
					onblur={() => saveComment(step)}
					onkeydown={(e) => handleCommentKeydown(e, step)}
					rows="2"
				></textarea>
			{:else}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div class="comment-text" onclick={() => startCommentEdit(step)}>
					{getCommentText(step) || 'Click to add comment...'}
				</div>
			{/if}
			{#if step.comment && editingCommentId !== step.id}
				<button class="comment-remove" title="Remove comment" onclick={() => { step.comment = undefined; }}>✕</button>
			{/if}
		</div>
	{/if}
{/snippet}

<section class="panel">
	<div class="panel-header">
		<h2>Trace</h2>
		<div class="panel-header-actions">
			<label class="toggle-excluded">
				<input type="checkbox" bind:checked={combineCompact} />
				<span>Combine</span>
			</label>
			<label class="toggle-excluded">
				<input type="checkbox" bind:checked={showExcluded} />
				<span>Show all</span>
			</label>
			<button class="btn-hide-actions" title="Hide all supporting steps (tool calls, results, thinking, status, permissions)" onclick={hideAllActions}>Hide actions</button>
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
						<span class="round-count">{#if includedCount(round) < totalCount(round)}{includedCount(round)}/{totalCount(round)}{:else}{totalCount(round)} steps{/if}</span>
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

					<!-- Steps rendered with real StepRenderer, compact steps grouped -->
					{#each groupSteps(round.steps) as group}
						{#if group.kind === 'compact'}
							<div class="compact-flow">
								{#each group.steps as step (step.id)}
									{@const chipStyle = getStepStyle(stepLabel(step) as import('$lib/data/tutorials').StepType)}
									<div class="compact-chip-wrap">
									<button
										class="compact-chip"
										class:compact-chip-expanded={expandedCompactId === step.id}
										class:compact-chip-hidden={step.hidden}
										style="--chip-accent: {chipStyle.accent}"
										onclick={() => toggleCompactExpand(step.id)}
										title={stepPreview(step)}
									>
										<span class="chip-icon">{chipStyle.icon}</span>
										<span class="chip-text">{compactChipText(step)}</span>
										<span class="chip-type">{stepLabel(step)}</span>
									</button>
									<button
										class="chip-hide-btn"
										title={step.hidden ? 'Unhide' : 'Hide'}
										onclick={(e) => { e.stopPropagation(); onToggleHidden(step); }}
									>{step.hidden ? '◌' : '●'}</button>
								</div>
								{/each}
							</div>
							{#each group.steps as step (step.id)}
								{#if expandedCompactId === step.id}
									{@const previewStep = toPreviewStep(step)}
									<div class="step-wrap compact-expanded" class:step-hidden={step.hidden}>
										{@render stepToolbar(round, step)}
										<div class="step-render">
											{#if previewStep}
												<StepRenderer
													step={{ ...previewStep, compact: false }}
													showClaudeLabel={previewStep.type === 'assistant'}
													isLast={false}
													onFocusWindow={noopFocus}
												/>
											{/if}
										</div>
										{@render commentBlock(step)}
									</div>
								{/if}
							{/each}
							{@const lastCompact = group.steps[group.steps.length - 1]}
							<button class="insert-btn" onclick={() => toggleInsertMenu(round.id, lastCompact.id)}>+</button>
							{#if showInsertMenu?.roundId === round.id && showInsertMenu?.afterStepId === lastCompact.id}
								{@render insertMenu(round.id, lastCompact.id)}
							{/if}
						{:else if group.kind === 'full'}
							{@const step = group.step}
							{@const previewStep = toPreviewStep(step)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="step-wrap"
								class:editing={editingStep?.stepId === step.id}
								class:step-hidden={step.hidden}
								class:inline-editing={inlineEditingStep === step.id}
								ondblclick={() => handleStepDblClick(step, round.id)}
							>
								{@render stepToolbar(round, step)}
								{#if inlineEditingStep === step.id}
									{@render inlineEditor(step)}
								{:else}
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
								{/if}
								{@render commentBlock(step)}
							</div>

							<button class="insert-btn" onclick={() => toggleInsertMenu(round.id, step.id)}>+</button>
							{#if showInsertMenu?.roundId === round.id && showInsertMenu?.afterStepId === step.id}
								{@render insertMenu(round.id, step.id)}
							{/if}
						{:else if group.kind === 'excluded'}
							{@const step = group.step}
							<div class="step-wrap step-excluded-row">
								<span class="excluded-icon">{stepIcon(step)}</span>
								<span class="excluded-type">{stepLabel(step)}</span>
								<span class="excluded-preview">{stepPreview(step).slice(0, 50)}</span>
								<button class="btn-icon btn-include" title="Include" onclick={() => onToggleStep(round.id, step.id)}>+</button>
							</div>
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

	.btn-hide-actions {
		padding: 3px 10px;
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		background: none;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}

	.btn-hide-actions:hover {
		color: var(--text-secondary);
		border-color: var(--orange-300);
	}

	/* ─── Terminal-like background ─── */
	.terminal-bg {
		background: var(--bg-terminal);
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
		gap: 3px;
		padding: 4px 8px;
		background: rgba(18, 8, 16, 0.94);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0 4px 0 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
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
	.toolbar-cat {
		font-size: 0.55rem;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 1px 5px;
		border-radius: 3px;
		line-height: 1.4;
	}
	.cat-primary    { color: var(--teal); background: rgba(112, 200, 184, 0.12); }
	.cat-supporting { color: var(--peach); background: rgba(232, 160, 112, 0.12); }
	.cat-structural { color: var(--green); background: rgba(100, 180, 100, 0.12); }

	/* Icon-only button (move up/down) */
	.tb {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-size: 0.85rem;
		padding: 0.25rem 0.35rem;
		border-radius: 4px;
		line-height: 1;
		min-width: 26px;
		min-height: 26px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.tb:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}

	/* Labeled button (icon + text below) */
	.tb-labeled {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 3px 6px;
		border-radius: 4px;
		transition: background 0.12s, color 0.12s;
	}
	.tb-labeled:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.08);
	}
	.tb-icon {
		font-size: 0.85rem;
		line-height: 1;
	}
	.tb-label {
		font-family: var(--font-mono);
		font-size: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		line-height: 1;
		opacity: 0.7;
	}

	.tb-override { color: var(--orange-300); }
	.tb-active { color: var(--mauve); }
	.tb-danger:hover { color: var(--red); }
	.tb-danger:hover .tb-label { opacity: 1; }

	.tb-spacer {
		width: 1px;
		height: 20px;
		background: rgba(255, 255, 255, 0.08);
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

	/* ─── Comment blocks ─── */
	.comment-block {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin: 4px 0 2px 0;
		padding: 6px 12px;
		border-left: 3px solid var(--orange-200);
		background: rgba(232, 200, 104, 0.06);
		border-radius: 0 4px 4px 0;
		position: relative;
	}

	.comment-label {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--orange-200);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		flex-shrink: 0;
		padding-top: 2px;
	}

	.comment-text {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--text-secondary);
		line-height: 1.5;
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 3px;
		transition: background 0.15s;
		white-space: pre-wrap;
	}

	.comment-text:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.comment-edit {
		flex: 1;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--orange-400);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		line-height: 1.5;
		padding: 4px 8px;
		resize: vertical;
		min-height: 28px;
	}

	.comment-edit:focus {
		outline: none;
		border-color: var(--orange-300);
	}

	.comment-remove {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: 0.65rem;
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 3px;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.comment-block:hover .comment-remove {
		opacity: 1;
	}

	.comment-remove:hover {
		color: var(--red);
		background: rgba(255, 255, 255, 0.06);
	}

	/* ─── Inline editing ─── */
	.inline-editing {
		outline: 1px solid rgba(233, 84, 32, 0.5);
		outline-offset: -1px;
		background: rgba(0, 0, 0, 0.15);
	}

	.inline-edit-area {
		padding: 10px 14px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.inline-edit-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.inline-edit-label {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--orange-300);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		font-weight: 600;
	}

	.inline-edit-hint {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--text-tertiary);
	}

	.inline-field {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.inline-field-label {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.inline-input {
		padding: 6px 10px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 5px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.82rem;
	}

	.inline-input:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	.inline-textarea {
		padding: 8px 12px;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 5px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.82rem;
		line-height: 1.6;
		resize: vertical;
		min-height: 100px;
	}

	.inline-textarea:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	.inline-edit-actions {
		display: flex;
		gap: 6px;
	}

	.btn-cancel {
		color: var(--text-tertiary) !important;
	}

	.btn-cancel:hover {
		color: var(--text-primary) !important;
	}

	/* ─── Compact flow (multi-column chips) ─── */
	.compact-flow {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 4px 0;
	}

	.compact-chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 5px 12px;
		min-width: 120px;
		max-width: 280px;
		background: color-mix(in srgb, var(--chip-accent) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--chip-accent) 20%, transparent);
		border-radius: 14px;
		color: var(--chip-accent);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
		flex: 1 1 auto;
	}

	.compact-chip:hover {
		background: color-mix(in srgb, var(--chip-accent) 14%, transparent);
		border-color: color-mix(in srgb, var(--chip-accent) 35%, transparent);
	}

	.compact-chip.compact-chip-expanded {
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
	}

	.chip-type {
		flex-shrink: 0;
		font-size: 0.58rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		opacity: 0.6;
	}

	.compact-chip-wrap {
		position: relative;
		display: inline-flex;
	}

	.chip-hide-btn {
		position: absolute;
		top: -6px;
		right: -6px;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		border: 1px solid var(--border-subtle);
		background: var(--bg-secondary);
		color: var(--text-tertiary);
		font-size: 8px;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.compact-chip-wrap:hover .chip-hide-btn {
		opacity: 1;
	}

	.chip-hide-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.compact-chip.compact-chip-hidden {
		opacity: 0.4;
	}

	.compact-expanded {
		border-left: 2px solid var(--orange-400);
		margin: 4px 0;
		background: rgba(233, 84, 32, 0.03);
		border-radius: 0 4px 4px 0;
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
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.55rem 0.65rem;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 6px;
		margin: 0.25rem 0;
	}
	.insert-row {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
	}
	.insert-cat {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		font-weight: 600;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		min-width: 56px;
		flex-shrink: 0;
	}
	.insert-menu button {
		padding: 0.25rem 0.6rem;
		background: rgba(255, 255, 255, 0.07);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		cursor: pointer;
		transition: background 0.12s, color 0.12s, border-color 0.12s;
	}
	.insert-menu button:hover {
		background: var(--accent-soft);
		color: var(--orange-300);
		border-color: var(--orange-500);
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

	.btn-sm {
		padding: 0.35rem 0.75rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border-subtle);
		border-radius: 5px;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.btn-sm:hover {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
		border-color: var(--orange-400);
	}
</style>
