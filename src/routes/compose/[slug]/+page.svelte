<script lang="ts">
	import { base } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import type { TutorialComposition, TraceBlock } from '$lib/compose/types';
	import BlockSearchBar from '$lib/compose/BlockSearchBar.svelte';
	import AssetPickerDialog from '$lib/components/AssetPickerDialog.svelte';
	import TraceBlockEditor from '$lib/curate/components/TraceBlockEditor.svelte';

	let { data } = $props();

	let composition = $state<TutorialComposition>(
		data.composition ?? {
			slug: data.slug,
			meta: { slug: data.slug, title: { en: data.slug }, tags: [] },
			blocks: []
		}
	);

	let saving = $state(false);
	let previewing = $state(false);
	let statusMessage = $state('');
	let showBlockSearch = $state(false);
	let expandedBlocks = $state<Set<number>>(new Set());
	let showThumbnailPicker = $state(false);
	let dirtyTraces = $state<Set<string>>(new Set());
	let blockEditorRefs = $state<(TraceBlockEditor | null)[]>([]);

	const defaultSlideTimings = {
		title: 1000,
		prompt: 1000,
		message: 500,
		window: 1500,
		answer: 3000
	};

	function thumbnailPreviewUrl(ref: string | undefined): string | undefined {
		if (!ref) return undefined;
		if (ref.startsWith('shared/')) return `/assets/${ref.slice(7)}`;
		if (ref.includes('/') || ref.includes('://')) return ref;
		return `/tutorials/${data.slug}/assets/${ref}`;
	}

	function addTraceBlock(block: TraceBlock) {
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
			for (const ref of blockEditorRefs) {
				if (ref?.isDirty()) {
					const saved = await ref.save();
					if (!saved) {
						statusMessage = 'Trace save failed';
						return;
					}
				}
			}

			const res = await fetch(`/api/compose/${data.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(composition)
			});
			const json = await res.json();
			statusMessage = json.ok ? 'Saved' : 'Save failed';
			if (json.ok) dirtyTraces = new Set();
		} catch {
			statusMessage = 'Save error';
		} finally {
			saving = false;
			setTimeout(() => (statusMessage = ''), 3000);
		}
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

	function blockSummary(block: TraceBlock): string {
		const trace = data.availableTraces.find((t: { slug: string }) => t.slug === block.sourceSlug);
		const rounds = block.rounds ? `${block.rounds.length} rounds selected` : 'all rounds';
		return `${rounds}${trace ? ` · ${trace.roundCount} total` : ''}`;
	}

	function markTraceDirty(slug: string) {
		dirtyTraces = new Set([...dirtyTraces, slug]);
	}

	function slideTimingSeconds(kind: keyof typeof defaultSlideTimings): string {
		return String((composition.slideTimings?.[kind] ?? defaultSlideTimings[kind]) / 1000);
	}

	function setSlideTiming(kind: keyof typeof defaultSlideTimings, value: string) {
		const seconds = Number(value);
		if (!composition.slideTimings) composition.slideTimings = {};
		if (Number.isFinite(seconds) && seconds > 0) {
			composition.slideTimings[kind] = Math.round(seconds * 1000);
		} else {
			delete composition.slideTimings[kind];
		}
		if (Object.keys(composition.slideTimings).length === 0) {
			composition.slideTimings = undefined;
		}
	}

	function resetSlideTimings() {
		composition.slideTimings = undefined;
	}
</script>

<svelte:head>
	<title>Edit · {data.slug}</title>
</svelte:head>

<div class="page-bg" aria-hidden="true"></div>

<Nav pageTitle="Edit · {data.slug}" />

<header class="toolbar">
	<div class="toolbar-left">
		<span class="toolbar-slug">{data.slug}</span>
		{#if dirtyTraces.size > 0}
			<span class="dirty-indicator">{dirtyTraces.size} unsaved trace{dirtyTraces.size > 1 ? 's' : ''}</span>
		{/if}
		{#if statusMessage}
			<span class="toolbar-status">{statusMessage}</span>
		{/if}
	</div>
	<div class="toolbar-actions">
		<button class="btn" onclick={save} disabled={saving}>
			{saving ? 'Saving...' : 'Save'}
		</button>
		<button class="btn" onclick={preview} disabled={previewing}>
			{previewing ? 'Loading...' : 'Preview'}
		</button>
	</div>
</header>

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
							{@const url = thumbnailPreviewUrl(composition.meta.thumbnail)}
							{#if /\.(mp4|mov|webm)$/i.test(composition.meta.thumbnail)}
								<video src={url} autoplay loop muted playsinline class="thumbnail-preview"></video>
							{:else}
								<img src={url} alt="Thumbnail preview" class="thumbnail-preview" />
							{/if}
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
			</div>
		</details>
		<details class="card">
			<summary>Slide Timing</summary>
			<div class="form-grid">
				<div class="timing-grid">
					<label>
						<span>Show title duration (seconds)</span>
						<input
							type="number"
							min="0.1"
							step="0.1"
							value={slideTimingSeconds('title')}
							oninput={(e) => setSlideTiming('title', (e.target as HTMLInputElement).value)}
						/>
					</label>
					<label>
						<span>Prompt (seconds)</span>
						<input
							type="number"
							min="0.1"
							step="0.1"
							value={slideTimingSeconds('prompt')}
							oninput={(e) => setSlideTiming('prompt', (e.target as HTMLInputElement).value)}
						/>
					</label>
					<label>
						<span>Message (seconds)</span>
						<input
							type="number"
							min="0.1"
							step="0.1"
							value={slideTimingSeconds('message')}
							oninput={(e) => setSlideTiming('message', (e.target as HTMLInputElement).value)}
						/>
					</label>
					<label>
						<span>Window (seconds)</span>
						<input
							type="number"
							min="0.1"
							step="0.1"
							value={slideTimingSeconds('window')}
							oninput={(e) => setSlideTiming('window', (e.target as HTMLInputElement).value)}
						/>
					</label>
					<label>
						<span>Final answer (seconds)</span>
						<input
							type="number"
							min="0.1"
							step="0.1"
							value={slideTimingSeconds('answer')}
							oninput={(e) => setSlideTiming('answer', (e.target as HTMLInputElement).value)}
						/>
					</label>
				</div>
				<button class="btn-sm" onclick={resetSlideTimings}>Reset to built-in defaults</button>
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

	<!-- ═══ TRACE BLOCKS ═══ -->
	<section class="blocks-section">
		<div class="section-header">
			<h2>Blocks</h2>
			<div class="section-actions">
				<button class="btn-sm btn-accent" onclick={() => (showBlockSearch = true)}>
					+ Add Trace
				</button>
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
			<p class="empty">No blocks yet. Add a trace to start composing.</p>
		{:else}
			<ol class="block-list">
				{#each composition.blocks as block, i}
					{#if block.kind === 'trace'}
						<li class="block-item">
							<div class="block-header">
								<button class="block-expand" onclick={() => toggleExpand(i)}>
									{expandedBlocks.has(i) ? '▾' : '▸'}
								</button>
								<span class="block-kind">Trace</span>
								<span class="block-slug">{block.sourceSlug}</span>
								<span class="block-summary">{blockSummary(block)}</span>
								{#if dirtyTraces.has(block.sourceSlug)}
									<span class="block-dirty">●</span>
								{/if}
								<div class="block-actions">
									<button class="btn-icon" onclick={() => moveBlock(i, -1)} disabled={i === 0}>↑</button>
									<button class="btn-icon" onclick={() => moveBlock(i, 1)} disabled={i === composition.blocks.length - 1}>↓</button>
									<a class="btn-icon" href="{base}/curate/{block.sourceSlug}" title="Open in full curate view">↗</a>
									<button class="btn-icon danger" onclick={() => removeBlock(i)}>✕</button>
								</div>
							</div>

							<div class="block-detail" hidden={!expandedBlocks.has(i)}>
								<div class="block-rounds-filter">
									<label>
										<span>Round filter (comma-separated indices, empty = all)</span>
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
											placeholder="e.g. 0, 1, 3"
										/>
									</label>
								</div>
								<TraceBlockEditor
									slug={block.sourceSlug}
									tutorialSlug={data.slug}
									roundIndices={block.rounds}
									ondirty={() => markTraceDirty(block.sourceSlug)}
									showSaveButton={false}
									bind:this={blockEditorRefs[i]}
								/>
							</div>
						</li>
					{/if}
				{/each}
			</ol>
		{/if}

		<div class="add-block-footer">
			<button class="btn-sm btn-accent" onclick={() => (showBlockSearch = true)}>+ Add Trace</button>
		</div>
	</section>
</main>

<style>
	.page-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		background: var(--edit-gradient);
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
	.dirty-indicator {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--orange-300);
		background: rgba(233, 84, 32, 0.15);
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
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

	/* ─── Forms ─── */
	.form-grid {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
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
	.form-row-2col {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.timing-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
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

	/* ─── Block list ─── */
	.block-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.block-item {
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
		font-size: 0.6rem;
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		font-weight: 600;
		background: rgba(233, 84, 32, 0.15);
		color: var(--orange-300);
		flex-shrink: 0;
	}
	.block-slug {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--text-primary);
		font-weight: 500;
		flex-shrink: 0;
	}
	.block-summary {
		flex: 1;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--text-tertiary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.block-dirty {
		color: var(--orange-300);
		font-size: 0.6rem;
		flex-shrink: 0;
	}
	.block-actions {
		display: flex;
		gap: 0.2rem;
		flex-shrink: 0;
	}
	.block-detail {
		padding: 0 0.5rem 0.5rem;
	}
	.block-rounds-filter {
		padding: 0 0.25rem 0.5rem;
	}
	.block-rounds-filter label {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.block-rounds-filter label > span {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.block-rounds-filter input {
		padding: 0.3rem 0.5rem;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.72rem;
	}
	.block-rounds-filter input:focus {
		outline: none;
		border-color: var(--orange-400);
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

	.empty {
		padding: 1.5rem;
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

	@media (max-width: 760px) {
		.timing-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
