<script lang="ts">
	import type { TraceState, TraceStep } from '$lib/trace/types';
	import type { Step, WindowContentData } from '$lib/data/tutorials';
	import { getDefaultMode } from '$lib/components/tutorial/step-colors';
	import UnifiedTracePanel from './UnifiedTracePanel.svelte';
	import StepEditorModal from './StepEditorModal.svelte';
	import { onMount } from 'svelte';

	let {
		slug,
		tutorialSlug,
		roundIndices,
		ondirty
	}: {
		slug: string;
		tutorialSlug: string;
		roundIndices?: number[];
		ondirty?: () => void;
	} = $props();

	let curation = $state<TraceState | null>(null);
	let loading = $state(true);
	let saving = $state(false);
	let statusMessage = $state('');
	let dirty = $state(false);
	let editingStep = $state<{ roundId: string; stepId: string } | null>(null);
	let showInsertMenu = $state<{ roundId: string; afterStepId: string | null } | null>(null);

	onMount(async () => {
		try {
			const res = await fetch(`/api/traces/${slug}`);
			const json = await res.json();
			if (json.exists && json.state) {
				curation = json.state;
			}
		} catch { /* no trace */ }
		loading = false;
	});

	function markDirty() {
		dirty = true;
		ondirty?.();
	}

	export async function save(): Promise<boolean> {
		if (!curation) return false;
		saving = true;
		statusMessage = '';
		try {
			const res = await fetch(`/api/traces/${slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(curation)
			});
			const json = await res.json();
			if (json.ok) {
				dirty = false;
				statusMessage = 'Saved';
				setTimeout(() => (statusMessage = ''), 3000);
				return true;
			}
			statusMessage = 'Save failed';
		} catch {
			statusMessage = 'Save error';
		}
		saving = false;
		return false;
	}

	export function isDirty(): boolean { return dirty; }

	function getEditingCurationStep(): TraceStep | null {
		if (!editingStep || !curation) return null;
		const round = curation.rounds.find((r) => r.id === editingStep!.roundId);
		if (!round) return null;
		return round.steps.find((s) => s.id === editingStep!.stepId) ?? null;
	}

	const editStep = $derived(getEditingCurationStep());

	function cycleDisplayMode(step: TraceStep) {
		const cycle = { compact: 'normal', normal: 'full', full: 'compact' } as const;
		step.displayMode = cycle[step.displayMode] ?? 'normal';
		markDirty();
	}

	function toggleHidden(step: TraceStep) {
		step.hidden = !step.hidden;
		markDirty();
	}

	function toggleRound(roundId: string) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		round.included = round.included === false ? true : false;
		curation.rounds = [...curation.rounds];
		markDirty();
	}

	function toggleStep(roundId: string, stepId: string) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		const step = round.steps.find((s) => s.id === stepId);
		if (!step) return;
		step.included = !step.included;
		markDirty();
	}

	function moveStep(roundId: string, stepId: string, direction: -1 | 1) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		const idx = round.steps.findIndex((s) => s.id === stepId);
		if (idx < 0) return;
		const newIdx = idx + direction;
		if (newIdx < 0 || newIdx >= round.steps.length) return;
		const tmp = round.steps[idx];
		round.steps[idx] = round.steps[newIdx];
		round.steps[newIdx] = tmp;
		round.steps = [...round.steps];
		markDirty();
	}

	function removeStep(roundId: string, stepId: string) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		round.steps = round.steps.filter((s) => s.id !== stepId);
		markDirty();
	}

	function moveRound(roundId: string, direction: -1 | 1) {
		if (!curation) return;
		const idx = curation.rounds.findIndex((r) => r.id === roundId);
		if (idx < 0) return;
		const newIdx = idx + direction;
		if (newIdx < 0 || newIdx >= curation.rounds.length) return;
		const tmp = curation.rounds[idx];
		curation.rounds[idx] = curation.rounds[newIdx];
		curation.rounds[newIdx] = tmp;
		curation.rounds = [...curation.rounds];
		markDirty();
	}

	function removeRound(roundId: string) {
		if (!curation) return;
		curation.rounds = curation.rounds.filter((r) => r.id !== roundId);
		markDirty();
	}

	let _insertId = 1000;
	function genId(): string { return `ins-${++_insertId}`; }

	function addRound(kind: 'claude' | 'terminal') {
		if (!curation) return;
		curation.rounds = [...curation.rounds, { id: genId(), kind, prompt: '', steps: [] }];
		markDirty();
	}

	function insertStep(roundId: string, afterStepId: string | null, step: Step) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		const newStep: TraceStep = {
			id: genId(),
			included: true,
			displayMode: getDefaultMode(step.type),
			inserted: step
		};
		if (afterStepId === null) {
			round.steps = [newStep, ...round.steps];
		} else {
			const idx = round.steps.findIndex((s) => s.id === afterStepId);
			round.steps.splice(idx + 1, 0, newStep);
			round.steps = [...round.steps];
		}
		showInsertMenu = null;
		markDirty();
	}

	function insertWindowStep(roundId: string, afterStepId: string | null, kind: WindowContentData['kind']) {
		const contentMap: Record<string, WindowContentData> = {
			'fiji-image': { kind: 'fiji-image', src: '' },
			'fiji-main': { kind: 'fiji-main' },
			image: { kind: 'image', src: '' },
			video: { kind: 'video', src: '' },
			markdown: { kind: 'markdown', text: '' },
			source: { kind: 'source', text: '' },
			folder: { kind: 'folder', entries: [] }
		};
		insertStep(roundId, afterStepId, {
			type: 'window',
			windowTitle: 'New Window',
			content: contentMap[kind] ?? { kind: 'image', src: '' }
		});
	}

	function insertOutputStep(roundId: string, afterStepId: string | null) {
		insertStep(roundId, afterStepId, { type: 'output', text: '' });
	}
	function insertStatusStep(roundId: string, afterStepId: string | null) {
		insertStep(roundId, afterStepId, { type: 'status', text: '', variant: 'success' });
	}
	function insertAssistantStep(roundId: string, afterStepId: string | null) {
		insertStep(roundId, afterStepId, { type: 'assistant', html: '<p></p>' });
	}
	function insertDividerStep(roundId: string, afterStepId: string | null) {
		insertStep(roundId, afterStepId, { type: 'divider', label: '' });
	}

	function handleEditStep(roundId: string, stepId: string) {
		editingStep = editingStep?.stepId === stepId ? null : { roundId, stepId };
	}

	function resetStep(_roundId: string, _stepId: string) {
		// Reset requires the source SessionView, which is only available in /curate
	}

	function resetRound(_roundId: string) {
		// Reset requires the source SessionView, which is only available in /curate
	}

	async function handleFileUpload(event: Event, roundId: string, stepId: string) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !curation) return;
		const formData = new FormData();
		formData.append('file', file);
		const res = await fetch(`/api/compose/${tutorialSlug}/upload`, { method: 'POST', body: formData });
		const json = await res.json();
		if (!json.ok) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		const step = round.steps.find((s) => s.id === stepId);
		if (!step) return;
		if (step.inserted && step.inserted.type === 'window') {
			const content = step.inserted.content;
			if ('src' in content) (content as { src: string }).src = json.filename;
			step.inserted = { ...step.inserted };
		}
		markDirty();
	}
</script>

{#if loading}
	<div class="block-loading">Loading trace...</div>
{:else if !curation}
	<div class="block-empty">No trace found for "{slug}"</div>
{:else}
	<div class="block-editor">
		<div class="block-editor-header">
			{#if dirty}
				<span class="dirty-badge">unsaved</span>
			{/if}
			{#if statusMessage}
				<span class="block-status">{statusMessage}</span>
			{/if}
			<button class="btn-sm" class:btn-accent={dirty} onclick={save} disabled={saving}>
				{saving ? 'Saving...' : 'Save Trace'}
			</button>
		</div>
		<UnifiedTracePanel
			slug={tutorialSlug}
			{curation}
			view={null}
			{editingStep}
			bind:showInsertMenu
			onToggleRound={toggleRound}
			onToggleStep={toggleStep}
			onMoveStep={moveStep}
			onMoveRound={moveRound}
			onRemoveStep={removeStep}
			onRemoveRound={removeRound}
			onCycleDisplayMode={cycleDisplayMode}
			onToggleHidden={toggleHidden}
			onAddRound={addRound}
			onInsertStep={insertStep}
			onInsertWindowStep={insertWindowStep}
			onInsertOutputStep={insertOutputStep}
			onInsertStatusStep={insertStatusStep}
			onInsertAssistantStep={insertAssistantStep}
			onInsertDividerStep={insertDividerStep}
			onEditStep={handleEditStep}
			onResetStep={resetStep}
			onResetRound={resetRound}
		/>
	</div>

	{#if editingStep && editStep}
		<StepEditorModal
			{editStep}
			{editingStep}
			slug={tutorialSlug}
			onClose={() => { editingStep = null; markDirty(); }}
			onFileUpload={handleFileUpload}
		/>
	{/if}
{/if}

<style>
	.block-loading, .block-empty {
		padding: 1.5rem;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--text-tertiary);
	}

	.block-editor-header {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(0, 0, 0, 0.15);
	}

	.dirty-badge {
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--orange-300);
		background: rgba(233, 84, 32, 0.15);
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.block-status {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--teal);
	}

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
	.btn-sm:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-accent {
		border-color: var(--orange-500);
		color: var(--orange-300);
	}
</style>
