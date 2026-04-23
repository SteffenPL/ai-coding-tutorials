<script lang="ts">
	import { base } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import type { TutorialComposition, CompositionBlock, TraceBlock, HandAuthoredBlock } from '$lib/compose/types';
	import type { Step, WindowContentData } from '$lib/data/tutorials';
	import BlockSearchBar from '$lib/compose/BlockSearchBar.svelte';
	import AssetPickerDialog from '$lib/components/AssetPickerDialog.svelte';

	let { data } = $props();

	let composition = $state<TutorialComposition>(
		data.composition ?? {
			slug: data.slug,
			meta: { slug: data.slug, title: { en: data.slug }, tags: [] },
			blocks: []
		}
	);

	let saving = $state(false);
	let exporting = $state(false);
	let previewing = $state(false);
	let statusMessage = $state('');
	let showExportConfirm = $state<string[] | null>(null);
	let showBlockSearch = $state(false);
	let expandedBlocks = $state<Set<number>>(new Set());
	let showThumbnailPicker = $state(false);

	function thumbnailPreviewUrl(ref: string | undefined): string | undefined {
		if (!ref) return undefined;
		if (ref.startsWith('shared/')) return `/assets/${ref.slice(7)}`;
		if (ref.includes('/') || ref.includes('://')) return ref;
		return `/tutorials/${data.slug}/assets/${ref}`;
	}

	function addTraceBlock(block: TraceBlock) {
		composition.blocks = [...composition.blocks, block];
	}

	function addHandAuthoredBlock() {
		const block: HandAuthoredBlock = {
			kind: 'round',
			round: { kind: 'claude', prompt: '', steps: [] }
		};
		composition.blocks = [...composition.blocks, block];
	}

	function removeBlock(index: number) {
		composition.blocks = composition.blocks.filter((_, i) => i !== index);
	}

	function moveBlock(index: number, direction: -1 | 1) {
		const newIdx = index + direction;
		if (newIdx < 0 || newIdx >= composition.blocks.length) return;
		const blocks = [...composition.blocks];
		const tmp = blocks[index];
		blocks[index] = blocks[newIdx];
		blocks[newIdx] = tmp;
		composition.blocks = blocks;
	}

	function toggleExpand(index: number) {
		const next = new Set(expandedBlocks);
		if (next.has(index)) next.delete(index);
		else next.add(index);
		expandedBlocks = next;
	}

	async function save() {
		saving = true;
		statusMessage = '';
		try {
			const res = await fetch(`/api/compose/${data.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(composition)
			});
			const json = await res.json();
			statusMessage = json.ok ? 'Saved' : 'Save failed';
		} catch {
			statusMessage = 'Save error';
		}
		saving = false;
		setTimeout(() => (statusMessage = ''), 3000);
	}

	async function doExport(force = false) {
		exporting = true;
		statusMessage = '';
		try {
			const res = await fetch(`/api/compose/${data.slug}/export`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ composition, force })
			});
			const json = await res.json();
			if (json.conflict) {
				showExportConfirm = json.existingFiles;
			} else if (json.ok) {
				statusMessage = `Exported ${json.written.length} rounds`;
				showExportConfirm = null;
			} else {
				statusMessage = 'Export failed';
			}
		} catch {
			statusMessage = 'Export error';
		}
		exporting = false;
		setTimeout(() => (statusMessage = ''), 5000);
	}

	async function preview() {
		previewing = true;
		statusMessage = '';
		try {
			const res = await fetch(`/api/compose/${data.slug}/preview`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(composition)
			});
			const json = await res.json();
			if (json.ok) {
				window.open(`${base}/preview/${data.slug}`, '_blank');
			} else {
				statusMessage = 'Preview failed';
			}
		} catch {
			statusMessage = 'Preview error';
		}
		previewing = false;
	}

	function blockSummary(block: CompositionBlock): string {
		if (block.kind === 'trace') {
			const trace = data.availableTraces.find((t: { slug: string }) => t.slug === block.sourceSlug);
			const rounds = block.rounds ? `${block.rounds.length} rounds` : 'all rounds';
			return `${block.sourceSlug} (${rounds}${trace ? `, ${trace.roundCount} total` : ''})`;
		}
		return `Hand-authored: "${block.round.prompt.slice(0, 60)}${block.round.prompt.length > 60 ? '...' : ''}"`;
	}

	function insertStep(blockIndex: number, step: Step) {
		const block = composition.blocks[blockIndex];
		if (block.kind !== 'round') return;
		block.round.steps = [...block.round.steps, step];
		composition.blocks = [...composition.blocks];
	}

	async function handleFileUpload(event: Event, blockIndex: number) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const formData = new FormData();
		formData.append('file', file);

		const res = await fetch(`/api/compose/${data.slug}/upload`, {
			method: 'POST',
			body: formData
		});
		const json = await res.json();
		if (json.ok) {
			statusMessage = `Uploaded: ${json.filename}`;
			setTimeout(() => (statusMessage = ''), 3000);
		}
	}
</script>

<svelte:head>
	<title>Compose · {data.slug}</title>
</svelte:head>

<div class="page-bg" aria-hidden="true"></div>

<Nav showBack pageTitle="Compose · {data.slug}" />

<header class="toolbar">
	<div class="toolbar-left">
		<span class="toolbar-slug">{data.slug}</span>
		{#if statusMessage}
			<span class="toolbar-status">{statusMessage}</span>
		{/if}
	</div>
	<div class="toolbar-actions">
		<button class="btn" onclick={save} disabled={saving}>
			{saving ? 'Saving...' : 'Save'}
		</button>
		<button class="btn btn-primary" onclick={() => doExport()} disabled={exporting}>
			{exporting ? 'Exporting...' : 'Export YAML'}
		</button>
		<button class="btn" onclick={preview} disabled={previewing}>
			{previewing ? 'Loading...' : 'Preview'}
		</button>
	</div>
</header>

{#if showExportConfirm}
	<div class="overlay" onclick={() => (showExportConfirm = null)}>
		<div class="dialog" onclick={(e) => e.stopPropagation()}>
			<h3>Files already exist</h3>
			<p>The following files will be overwritten:</p>
			<ul>
				{#each showExportConfirm as f}
					<li><code>{f}</code></li>
				{/each}
			</ul>
			<div class="dialog-actions">
				<button class="btn" onclick={() => (showExportConfirm = null)}>Cancel</button>
				<button class="btn btn-danger" onclick={() => doExport(true)}>Overwrite All</button>
			</div>
		</div>
	</div>
{/if}

<main class="compose">
	<!-- METADATA -->
	<section class="metadata-section">
		<details class="card" open>
			<summary>Tutorial Metadata</summary>
			<div class="form-grid">
				<div class="form-row-2col">
					<label>
						<span>Title (EN)</span>
						<input type="text" bind:value={composition.meta.title.en} />
					</label>
					<label>
						<span>Title (JA)</span>
						<input type="text" bind:value={composition.meta.title.ja} />
					</label>
				</div>
				<div class="form-row-2col">
					<label>
						<span>Author</span>
						<input type="text" value={composition.meta.author ?? 'Steffen Plunder'} oninput={(e) => { composition.meta.author = (e.target as HTMLInputElement).value; }} />
					</label>
					<label>
						<span>Tags (comma-separated)</span>
						<input
							type="text"
							value={composition.meta.tags.join(', ')}
							oninput={(e) => {
								composition.meta.tags = (e.target as HTMLInputElement).value
									.split(',')
									.map((t) => t.trim())
									.filter(Boolean);
							}}
						/>
					</label>
				</div>

				<!-- Thumbnail picker -->
				<label>
					<span>Thumbnail</span>
					<div class="thumbnail-field">
						{#if composition.meta.thumbnail}
							<img
								src={thumbnailPreviewUrl(composition.meta.thumbnail)}
								alt="Thumbnail preview"
								class="thumbnail-preview"
							/>
						{/if}
						<div class="thumbnail-controls">
							<span class="thumbnail-ref">{composition.meta.thumbnail || '(none)'}</span>
							<button class="btn-sm" onclick={() => (showThumbnailPicker = true)}>Select / Upload</button>
						</div>
					</div>
				</label>

				<label>
					<span>Description (Markdown)</span>
					<textarea
						bind:value={composition.description}
						rows="4"
						placeholder="What this tutorial covers..."
					></textarea>
				</label>
				<label>
					<span>Requirements / Prerequisites (Markdown)</span>
					<textarea
						bind:value={composition.requirements}
						rows="3"
						placeholder="What the reader needs before starting..."
					></textarea>
				</label>
				<label>
					<span>Briefing (shown in desktop area when no windows visible)</span>
					<textarea
						value={composition.briefing?.en ?? ''}
						oninput={(e) => {
							const val = (e.target as HTMLTextAreaElement).value;
							composition.briefing = val ? { en: val } : undefined;
						}}
						rows="3"
						placeholder="Markdown briefing text..."
					></textarea>
				</label>
			</div>
		</details>
	</section>

	<!-- Thumbnail picker -->
	<AssetPickerDialog
		open={showThumbnailPicker}
		tutorialSlug={data.slug}
		imagesOnly
		selected={composition.meta.thumbnail}
		onselect={(ref) => { composition.meta.thumbnail = ref; showThumbnailPicker = false; }}
		onclose={() => (showThumbnailPicker = false)}
	/>

	<!-- ═══ BLOCKS ═══ -->
	<section class="blocks-section">
		<div class="section-header">
			<h2>Composition Blocks</h2>
			<div class="section-actions">
				<button class="btn-sm btn-accent" onclick={() => (showBlockSearch = true)}>
					+ Add Block
				</button>
				<button class="btn-sm" onclick={addHandAuthoredBlock}>+ Round</button>
			</div>
		</div>

		{#if showBlockSearch}
			<BlockSearchBar
				availableTraces={data.availableTraces}
				onAddBlock={addTraceBlock}
				onClose={() => (showBlockSearch = false)}
			/>
		{/if}

		{#if composition.blocks.length === 0}
			<p class="empty">No blocks yet. Add a trace or a hand-authored round.</p>
		{:else}
			<ol class="block-list">
				{#each composition.blocks as block, i}
					<li class="block-item" class:trace={block.kind === 'trace'} class:round={block.kind === 'round'}>
						<div class="block-header">
							<button class="block-expand" onclick={() => toggleExpand(i)}>
								{expandedBlocks.has(i) ? '▾' : '▸'}
							</button>
							<span class="block-kind">{block.kind === 'trace' ? 'Trace' : 'Round'}</span>
							<span class="block-summary">{blockSummary(block)}</span>
							<div class="block-actions">
								<button class="btn-icon" onclick={() => moveBlock(i, -1)} disabled={i === 0}>↑</button>
								<button class="btn-icon" onclick={() => moveBlock(i, 1)} disabled={i === composition.blocks.length - 1}>↓</button>
								{#if block.kind === 'trace'}
									<a class="btn-icon" href="{base}/curate/{block.sourceSlug}" title="Edit trace">✎</a>
								{/if}
								<button class="btn-icon danger" onclick={() => removeBlock(i)}>✕</button>
							</div>
						</div>

						{#if expandedBlocks.has(i)}
							<div class="block-detail">
								{#if block.kind === 'trace'}
									<div class="form-grid compact">
										<label>
											<span>Source slug</span>
											<input type="text" bind:value={block.sourceSlug} />
										</label>
										<label>
											<span>Rounds (comma-separated indices, empty = all)</span>
											<input
												type="text"
												value={block.rounds?.join(', ') ?? ''}
												oninput={(e) => {
													const val = (e.target as HTMLInputElement).value.trim();
													if (!val) {
														block.rounds = undefined;
													} else {
														block.rounds = val.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
													}
													composition.blocks = [...composition.blocks];
												}}
											/>
										</label>
									</div>
								{:else}
									<div class="form-grid compact">
										<label>
											<span>Kind</span>
											<select bind:value={block.round.kind}>
												<option value="claude">claude</option>
												<option value="terminal">terminal</option>
											</select>
										</label>
										<label>
											<span>Prompt</span>
											<textarea bind:value={block.round.prompt} rows="2"></textarea>
										</label>
									</div>
									<div class="round-steps">
										<span class="steps-label">{block.round.steps.length} steps</span>
										<button class="btn-sm" onclick={() => insertStep(i, { type: 'assistant', html: '<p></p>' })}>+ Assistant</button>
										<button class="btn-sm" onclick={() => insertStep(i, { type: 'tool_call', toolName: '', code: '' })}>+ Tool Call</button>
										<button class="btn-sm" onclick={() => insertStep(i, { type: 'output', text: '' })}>+ Output</button>
										<button class="btn-sm" onclick={() => insertStep(i, { type: 'status', text: '', variant: 'success' })}>+ Status</button>
									</div>
									{#each block.round.steps as step, si}
										<div class="step-row">
											<span class="step-type">{step.type}</span>
											<button class="btn-icon danger" onclick={() => {
												block.round.steps = block.round.steps.filter((_, j) => j !== si);
												composition.blocks = [...composition.blocks];
											}}>✕</button>
										</div>
									{/each}
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}

		<!-- Insert between blocks -->
		<div class="add-block-footer">
			<button class="btn-sm btn-accent" onclick={() => (showBlockSearch = true)}>+ Add Block</button>
			<button class="btn-sm" onclick={addHandAuthoredBlock}>+ Round</button>
			<input type="file" class="upload-input" onchange={(e) => handleFileUpload(e, -1)} />
		</div>
	</section>
</main>

<style>
	.page-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(ellipse 80% 60% at 70% 15%, rgba(140, 160, 200, 0.08) 0%, transparent 60%),
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(233, 84, 32, 0.38) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(240, 120, 40, 0.2) 0%, transparent 55%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(140, 60, 160, 0.22) 0%, transparent 60%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(60, 15, 42, 0.5) 0%, transparent 70%),
			linear-gradient(150deg, #32061f 0%, #3c0e2a 20%, #481832 40%, #40122a 60%, #360a22 80%, #32061f 100%);
		filter: blur(40px) saturate(1.3);
	}

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

	.compose {
		max-width: 960px;
		margin: 0 auto;
		padding: calc(56px + 3rem + 0.5rem) 1rem 8rem;
	}

	/* ─── Cards ─── */
	.card {
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.2);
		margin-bottom: 1rem;
	}
	.card > summary {
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--orange-300);
	}
	.card h4 {
		margin: 0.6rem 0.75rem 0.3rem;
		font-size: 0.72rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	/* ─── Forms ─── */
	.form-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
	}
	.form-grid.compact {
		padding: 0.4rem 0;
	}
	.form-grid label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.form-grid label > span {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.form-grid input,
	.form-grid textarea,
	.form-grid select {
		padding: 0.35rem 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		resize: vertical;
	}
	.form-grid input:focus,
	.form-grid textarea:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	/* ─── 2-column form layout ─── */
	.form-row-2col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	/* ─── Thumbnail picker ─── */
	.thumbnail-field {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
	}
	.thumbnail-preview {
		width: 80px;
		height: 80px;
		object-fit: cover;
		border-radius: 6px;
		border: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.3);
		flex-shrink: 0;
	}
	.thumbnail-controls {
		flex: 1;
		display: flex;
		gap: 0.4rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.thumbnail-ref {
		flex: 1;
		min-width: 0;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}


	/* ─── Blocks section ─── */
	.blocks-section {
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.2);
		overflow: hidden;
	}
	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.15);
	}
	.section-header h2 {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--orange-300);
		font-weight: 600;
	}
	.section-actions {
		display: flex;
		gap: 0.4rem;
	}

	/* ─── Block list ─���─ */
	.block-list {
		list-style: none;
		padding: 0;
		margin: 0;
		counter-reset: block;
	}
	.block-item {
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}
	.block-item:last-child {
		border-bottom: none;
	}
	.block-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
	}
	.block-expand {
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.1rem 0.3rem;
	}
	.block-kind {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-weight: 600;
	}
	.block-item.trace .block-kind {
		background: rgba(233, 84, 32, 0.15);
		color: var(--orange-300);
	}
	.block-item.round .block-kind {
		background: rgba(100, 200, 180, 0.12);
		color: var(--teal);
	}
	.block-summary {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.block-actions {
		display: flex;
		gap: 0.2rem;
		flex-shrink: 0;
	}
	.block-detail {
		padding: 0 0.75rem 0.6rem 2rem;
	}

	.round-steps {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.4rem;
		flex-wrap: wrap;
	}
	.steps-label {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
	}
	.step-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0;
	}
	.step-type {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--text-secondary);
	}

	/* ─── Footer ─── */
	.add-block-footer {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		border-top: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.1);
	}
	.upload-input {
		margin-left: auto;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
	}

	.empty {
		padding: 1rem;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		text-align: center;
	}

	/* ─── Buttons ─── */
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
	.btn-primary {
		background: var(--accent-soft);
		border-color: var(--orange-500);
		color: var(--orange-300);
	}
	.btn-danger {
		border-color: var(--red);
		color: var(--red);
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
		text-decoration: none;
	}
	.btn-sm:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}
	.btn-sm.danger {
		color: var(--red);
		border-color: rgba(220, 50, 50, 0.3);
	}
	.btn-accent {
		border-color: var(--orange-500);
		color: var(--orange-300);
	}
	.btn-icon {
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.15rem 0.3rem;
		border-radius: 3px;
		text-decoration: none;
	}
	.btn-icon:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}
	.btn-icon.danger:hover {
		color: var(--red);
	}
	.btn-icon:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* ─── Overlay / Dialog ���── */
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
		margin: 0 0 0.6rem;
	}
	.dialog ul {
		margin: 0 0 1rem;
		padding-left: 1.2rem;
	}
	.dialog li {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-primary);
	}
	.dialog-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}
</style>
