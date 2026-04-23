<script lang="ts">
	import type { PageProps } from './$types';
	import type { TraceState, TraceStep } from '$lib/trace/types';
	import type { Step, WindowContentData } from '$lib/data/tutorials';
	import { sessionViewToTraceState } from '$lib/trace/convert';
	import Nav from '$lib/components/Nav.svelte';
	import SourcePanel from '$lib/curate/components/SourcePanel.svelte';
	import CuratedPanel from '$lib/curate/components/CuratedPanel.svelte';
	import EditDrawer from '$lib/curate/components/EditDrawer.svelte';
	import { onMount } from 'svelte';

	let { data }: PageProps = $props();
	const view = $derived(data.view);

	let curation = $state<TraceState | null>(null);
	let saving = $state(false);
	let statusMessage = $state('');
	let editingStep = $state<{ roundId: string; stepId: string } | null>(null);
	let showInsertMenu = $state<{ roundId: string; afterStepId: string | null } | null>(null);

	let noSession = $state(false);
	let hasSavedTrace = $state(false);
	let showResetConfirm = $state(false);
	let showDeleteConfirm = $state(false);

	onMount(async () => {
		const res = await fetch(`/api/traces/${data.slug}`);
		const json = await res.json();
		if (json.exists && json.state) {
			curation = json.state;
			hasSavedTrace = true;
		} else if (view) {
			curation = sessionViewToTraceState(view);
		} else {
			noSession = true;
		}
	});

	function resetToSource() {
		if (!view) return;
		curation = sessionViewToTraceState(view);
		editingStep = null;
		showResetConfirm = false;
		statusMessage = 'Reset to source session';
		setTimeout(() => (statusMessage = ''), 3000);
	}

	async function deleteTrace() {
		try {
			const res = await fetch(`/api/traces/${data.slug}`, { method: 'DELETE' });
			const json = await res.json();
			if (json.ok) {
				hasSavedTrace = false;
				showDeleteConfirm = false;
				if (view) {
					curation = sessionViewToTraceState(view);
					editingStep = null;
					statusMessage = 'Trace deleted — showing fresh state from session';
				} else {
					statusMessage = 'Trace deleted';
					curation = null;
					noSession = true;
				}
				setTimeout(() => (statusMessage = ''), 4000);
			}
		} catch {
			statusMessage = 'Delete failed';
			setTimeout(() => (statusMessage = ''), 3000);
		}
	}

	function getEditingCurationStep(): TraceStep | null {
		if (!editingStep || !curation) return null;
		const round = curation.rounds.find((r) => r.id === editingStep!.roundId);
		if (!round) return null;
		return round.steps.find((s) => s.id === editingStep!.stepId) ?? null;
	}

	const editStep = $derived(getEditingCurationStep());

	function cycleDisplayMode(step: TraceStep) {
		step.displayMode = step.displayMode === 'full' ? 'compact' : 'full';
	}

	function toggleStep(roundId: string, stepId: string) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		const step = round.steps.find((s) => s.id === stepId);
		if (!step) return;
		step.included = !step.included;
	}

	function includeAllInRound(roundId: string) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		round.steps.forEach((s) => (s.included = true));
	}

	function excludeAllInRound(roundId: string) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		round.steps.forEach((s) => (s.included = false));
	}

	function includeToolsOnly(roundId: string) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		round.steps.forEach((s) => {
			const type = (s.overrides as Record<string, unknown>)?.type ?? s.inserted?.type;
			s.included = type === 'tool_call' || type === 'tool_result';
		});
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
	}

	function removeStep(roundId: string, stepId: string) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		round.steps = round.steps.filter((s) => s.id !== stepId);
	}

	function removeRound(roundId: string) {
		if (!curation) return;
		curation.rounds = curation.rounds.filter((r) => r.id !== roundId);
	}

	let _insertId = 1000;
	function genId(): string {
		return `ins-${++_insertId}`;
	}

	function addRound(kind: 'claude' | 'terminal') {
		if (!curation) return;
		curation.rounds = [
			...curation.rounds,
			{
				id: genId(),
				kind,
				prompt: '',
				steps: []
			}
		];
	}

	function insertStep(roundId: string, afterStepId: string | null, step: Step) {
		if (!curation) return;
		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		const newStep: TraceStep = {
			id: genId(),
			included: true,
			displayMode: 'full',
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
	}

	function insertWindowStep(roundId: string, afterStepId: string | null, kind: WindowContentData['kind']) {
		const contentMap: Record<string, WindowContentData> = {
			'fiji-image': { kind: 'fiji-image', src: '' },
			image: { kind: 'image', src: '' },
			video: { kind: 'video', src: '' },
			markdown: { kind: 'markdown', text: '' },
			source: { kind: 'source', text: '' },
			folder: { kind: 'folder', entries: [] }
		};
		const step: Step = {
			type: 'window',
			windowTitle: 'New Window',
			content: contentMap[kind] ?? { kind: 'image', src: '' }
		};
		insertStep(roundId, afterStepId, step);
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

	let previewing = $state(false);

	async function preview() {
		if (!curation) return;
		previewing = true;
		statusMessage = '';
		try {
			const res = await fetch(`/api/traces/${data.slug}/preview`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(curation)
			});
			const json = await res.json();
			if (json.ok) {
				window.open(`/preview/${data.slug}`, '_blank');
			} else {
				statusMessage = 'Preview failed';
			}
		} catch (e) {
			statusMessage = 'Preview error';
		}
		previewing = false;
	}

	async function save() {
		if (!curation) return;
		saving = true;
		statusMessage = '';
		try {
			const res = await fetch(`/api/traces/${data.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(curation)
			});
			const json = await res.json();
			statusMessage = json.ok ? 'Saved' : 'Save failed';
		} catch (e) {
			statusMessage = 'Save error';
		}
		saving = false;
		setTimeout(() => (statusMessage = ''), 3000);
	}

	async function handleFileUpload(event: Event, roundId: string, stepId: string) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !curation) return;

		const formData = new FormData();
		formData.append('file', file);

		const res = await fetch(`/api/compose/${data.slug}/upload`, {
			method: 'POST',
			body: formData
		});
		const json = await res.json();
		if (!json.ok) return;

		const round = curation.rounds.find((r) => r.id === roundId);
		if (!round) return;
		const step = round.steps.find((s) => s.id === stepId);
		if (!step) return;

		if (step.inserted && step.inserted.type === 'window') {
			const content = step.inserted.content;
			if ('src' in content) {
				(content as { src: string }).src = json.filename;
			}
			step.inserted = { ...step.inserted };
		}
	}

	const curatedRounds = $derived(
		curation?.rounds.filter((r) => {
			return r.steps.some((s) => s.included || s.inserted) || r.prompt;
		}) ?? []
	);
</script>

<svelte:head>
	<title>Curate · {data.slug}</title>
</svelte:head>

<div class="page-bg" aria-hidden="true"></div>

<Nav showBack pageTitle="Curate · {data.slug}" />

{#if noSession}
	<main class="loading">No session found for "{data.slug}". Import one from the <a href="/edit">dashboard</a>.</main>
{:else if !curation}
	<main class="loading">Loading curation state...</main>
{:else}
	<!-- Toolbar -->
	<header class="toolbar">
		<div class="toolbar-left">
			<span class="toolbar-slug">{data.slug}</span>
			{#if statusMessage}
				<span class="toolbar-status">{statusMessage}</span>
			{/if}
		</div>
		<div class="toolbar-actions">
			{#if view}
				<button class="btn btn-subtle" onclick={() => (showResetConfirm = true)}>
					Reset to Source
				</button>
			{/if}
			{#if hasSavedTrace}
				<button class="btn btn-danger" onclick={() => (showDeleteConfirm = true)}>
					Delete
				</button>
			{/if}
			<button class="btn" onclick={save} disabled={saving}>
				{saving ? 'Saving...' : 'Save'}
			</button>
			<button class="btn" onclick={preview} disabled={previewing}>
				{previewing ? 'Loading...' : 'Preview'}
			</button>
		</div>
	</header>

	{#if showResetConfirm}
		<div class="overlay" role="dialog" onclick={() => (showResetConfirm = false)}>
			<div class="dialog" onclick={(e) => e.stopPropagation()}>
				<h3>Reset to source session?</h3>
				<p>This will discard all curation changes and re-derive the trace from the raw session. Unsaved changes will be lost.</p>
				<div class="dialog-actions">
					<button class="btn" onclick={() => (showResetConfirm = false)}>Cancel</button>
					<button class="btn btn-danger" onclick={resetToSource}>Reset</button>
				</div>
			</div>
		</div>
	{/if}

	{#if showDeleteConfirm}
		<div class="overlay" role="dialog" onclick={() => (showDeleteConfirm = false)}>
			<div class="dialog" onclick={(e) => e.stopPropagation()}>
				<h3>Delete saved trace?</h3>
				<p>This will delete <code>trace.json</code> from disk. {view ? 'The trace will be re-derived from the source session.' : 'There is no source session — the trace data will be gone.'}</p>
				<div class="dialog-actions">
					<button class="btn" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
					<button class="btn btn-danger" onclick={deleteTrace}>Delete</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- ═══ TRACE TITLE ═══ -->
	<section class="metadata-section">
		<div class="title-row">
			<label>
				<span>Trace title</span>
				<input type="text" bind:value={curation.title} placeholder="Human label for this trace" />
			</label>
		</div>
	</section>

	<main class="curate-layout" class:single-panel={!view}>
		{#if view}
			<SourcePanel
				{view}
				{curation}
				{editingStep}
				onToggleStep={toggleStep}
				onIncludeAll={includeAllInRound}
				onExcludeAll={excludeAllInRound}
				onIncludeToolsOnly={includeToolsOnly}
				onCycleDisplayMode={cycleDisplayMode}
				onEditStep={handleEditStep}
			/>
		{/if}

		<CuratedPanel
			{curation}
			{curatedRounds}
			{editingStep}
			bind:showInsertMenu
			onMoveStep={moveStep}
			onRemoveStep={removeStep}
			onRemoveRound={removeRound}
			onCycleDisplayMode={cycleDisplayMode}
			onAddRound={addRound}
			onInsertStep={insertStep}
			onInsertWindowStep={insertWindowStep}
			onInsertOutputStep={insertOutputStep}
			onInsertStatusStep={insertStatusStep}
			onInsertAssistantStep={insertAssistantStep}
			onInsertDividerStep={insertDividerStep}
			onEditStep={handleEditStep}
		/>
	</main>

	{#if editingStep && editStep}
		<EditDrawer
			{editStep}
			{editingStep}
			slug={data.slug}
			onClose={() => (editingStep = null)}
			onFileUpload={handleFileUpload}
		/>
	{/if}
{/if}

<style>
	.page-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(233, 84, 32, 0.38) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(240, 120, 40, 0.2) 0%, transparent 55%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(140, 60, 160, 0.2) 0%, transparent 60%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(60, 15, 42, 0.6) 0%, transparent 70%),
			linear-gradient(150deg, #2c001e 0%, #380a28 20%, #42122e 40%, #3a0e26 60%, #30051f 80%, #2c001e 100%);
		filter: blur(40px) saturate(1.35);
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		color: var(--text-secondary);
		font-family: var(--font-mono);
	}
	.loading a {
		color: var(--orange-300);
	}

	/* ─── Toolbar ─────────────────────────────── */
	.toolbar {
		position: sticky;
		top: 56px;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 1.25rem;
		background: rgba(20, 10, 18, 0.9);
		backdrop-filter: blur(18px);
		border-bottom: 1px solid var(--border-subtle);
	}
	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.toolbar-slug {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--orange-300);
		font-weight: 600;
	}
	.toolbar-status {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--teal);
		animation: fadeIn 0.2s;
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	.toolbar-actions {
		display: flex;
		gap: 0.5rem;
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
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-danger {
		border-color: rgba(220, 50, 50, 0.5);
		color: var(--red, #e44);
	}
	.btn-danger:hover {
		background: rgba(220, 50, 50, 0.15);
		border-color: var(--red, #e44);
	}
	.btn-subtle {
		color: var(--text-tertiary);
		border-color: transparent;
	}
	.btn-subtle:hover {
		color: var(--text-secondary);
		border-color: var(--border-subtle);
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
	.btn-sm.danger {
		color: var(--red);
		border-color: rgba(220, 50, 50, 0.3);
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

	/* ─── Metadata section (full-width, above panels) ─── */
	.metadata-section {
		max-width: 1600px;
		margin: 0 auto;
		padding: calc(56px + 3rem + 0.5rem) 1rem 0;
	}
	.metadata-section .tutorial-header {
		margin: 0;
	}

	/* ─── Layout ──────────────────────────────── */
	.curate-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		padding: 1rem 1rem 8rem;
		max-width: 1600px;
		margin: 0 auto;
	}
	.curate-layout.single-panel {
		grid-template-columns: 1fr;
		max-width: 900px;
	}

	/* ─── Title row ──────────────────────────── */
	.title-row {
		padding: 0.5rem 0.75rem;
	}
	.title-row label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.title-row label > span {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.title-row input {
		padding: 0.35rem 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}
	.title-row input:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	/* ─── Overlay / Dialog ────────────────────── */
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.dialog {
		background: rgba(30, 16, 26, 0.98);
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		padding: 1.5rem;
		max-width: 440px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
	}
	.dialog h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		color: var(--orange-300);
	}
	.dialog p {
		font-size: 0.82rem;
		color: var(--text-secondary);
		margin: 0 0 1rem;
	}
	.dialog code {
		background: rgba(255, 255, 255, 0.06);
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 0.78rem;
	}
	.dialog-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
</style>
