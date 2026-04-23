<script lang="ts">
	import AssetUploadDialog from './AssetUploadDialog.svelte';

	interface Props {
		open: boolean;
		tutorialSlug?: string;
		/** Restrict to image files only (for thumbnail pickers etc.) */
		imagesOnly?: boolean;
		/** Currently selected asset ref (for highlight) */
		selected?: string;
		onselect: (ref: string) => void;
		onclose: () => void;
	}

	let { open, tutorialSlug, imagesOnly = false, selected, onselect, onclose }: Props = $props();

	let assets = $state<{ shared: string[]; tutorials: Record<string, string[]> }>({ shared: [], tutorials: {} });
	let search = $state('');
	let showUpload = $state(false);
	let loading = $state(false);

	$effect(() => {
		if (open) {
			search = '';
			loadAssets();
		}
	});

	async function loadAssets() {
		loading = true;
		try {
			const res = await fetch('/api/assets');
			assets = await res.json();
		} catch { /* ignore */ }
		loading = false;
	}

	function isImage(name: string): boolean {
		return /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(name);
	}

	function isVideo(name: string): boolean {
		return /\.(mp4|webm|mov|avi)$/i.test(name);
	}

	function matchesSearch(name: string): boolean {
		if (!search) return true;
		return name.toLowerCase().includes(search.toLowerCase());
	}

	function filterFiles(files: string[]): string[] {
		let filtered = files;
		if (imagesOnly) filtered = filtered.filter(isImage);
		return filtered.filter(matchesSearch);
	}

	function resolvePreviewUrl(file: string, scope: 'shared' | string): string {
		if (scope === 'shared') return `/assets/${file}`;
		return `/tutorials/${scope}/assets/${file}`;
	}

	function buildRef(file: string, scope: 'shared' | string): string {
		if (scope === 'shared') return `shared/${file}`;
		if (scope === tutorialSlug) return file;
		return `tutorials/${scope}/assets/${file}`;
	}

	function handleSelect(file: string, scope: 'shared' | string) {
		onselect(buildRef(file, scope));
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function handleUploaded(ref: string) {
		showUpload = false;
		loadAssets();
		onselect(ref);
	}

	// Gather all scopes in display order: current tutorial first, then shared, then others
	let sections = $derived.by(() => {
		const result: Array<{ label: string; scope: string; files: string[] }> = [];

		if (tutorialSlug && assets.tutorials[tutorialSlug]) {
			const files = filterFiles(assets.tutorials[tutorialSlug]);
			if (files.length) result.push({ label: tutorialSlug, scope: tutorialSlug, files });
		}

		const sharedFiles = filterFiles(assets.shared);
		if (sharedFiles.length) result.push({ label: 'Shared', scope: 'shared', files: sharedFiles });

		for (const [slug, files] of Object.entries(assets.tutorials)) {
			if (slug === tutorialSlug) continue;
			const filtered = filterFiles(files);
			if (filtered.length) result.push({ label: slug, scope: slug, files: filtered });
		}

		return result;
	});

	let totalCount = $derived(sections.reduce((n, s) => n + s.files.length, 0));
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={handleBackdrop} onkeydown={handleKeydown}>
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="picker" onclick={(e) => e.stopPropagation()} role="dialog" aria-label="Select asset">
			<div class="picker-header">
				<h3>Select Asset</h3>
				<button class="close-btn" onclick={onclose}>&times;</button>
			</div>

			<div class="picker-toolbar">
				<input
					class="search-input"
					type="text"
					placeholder="Search assets..."
					bind:value={search}
				/>
				<button class="btn btn-upload" onclick={() => (showUpload = true)}>+ Upload</button>
			</div>

			<div class="picker-body">
				{#if loading}
					<div class="picker-empty">Loading...</div>
				{:else if totalCount === 0}
					<div class="picker-empty">{search ? 'No matches' : 'No assets yet'}</div>
				{:else}
					{#each sections as section}
						<div class="section">
							<h4 class="section-label">{section.label}</h4>
							<div class="asset-grid">
								{#each section.files as file}
									{@const ref = buildRef(file, section.scope)}
									{@const url = resolvePreviewUrl(file, section.scope)}
									<button
										class="asset-thumb"
										class:selected={selected === ref}
										onclick={() => handleSelect(file, section.scope)}
										title={ref}
									>
										{#if isImage(file)}
											<img src={url} alt={file} />
										{:else if isVideo(file)}
											<div class="thumb-placeholder video">vid</div>
										{:else}
											<div class="thumb-placeholder">{file.split('.').pop()}</div>
										{/if}
										<span class="asset-name">{file}</span>
									</button>
								{/each}
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<div class="picker-footer">
				<span class="asset-count">{totalCount} asset{totalCount !== 1 ? 's' : ''}</span>
				<button class="btn" onclick={onclose}>Cancel</button>
			</div>
		</div>
	</div>
{/if}

<AssetUploadDialog
	open={showUpload}
	{tutorialSlug}
	onclose={() => (showUpload = false)}
	onuploaded={handleUploaded}
/>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.picker {
		width: 90%;
		max-width: 640px;
		max-height: 80vh;
		background: #2a1a24;
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.picker-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.2);
		flex-shrink: 0;
	}

	.picker-header h3 {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--orange-300);
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: 1.2rem;
		cursor: pointer;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		line-height: 1;
	}

	.close-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}

	.picker-toolbar {
		display: flex;
		gap: 0.5rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
	}

	.search-input {
		flex: 1;
		padding: 0.4rem 0.6rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 5px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.78rem;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	.search-input::placeholder {
		color: var(--text-tertiary);
	}

	.picker-body {
		flex: 1;
		overflow-y: auto;
		padding: 0.75rem 1rem;
	}

	.picker-empty {
		text-align: center;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		padding: 2rem;
	}

	.section {
		margin-bottom: 0.75rem;
	}

	.section:last-child {
		margin-bottom: 0;
	}

	.section-label {
		margin: 0 0 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.asset-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.asset-thumb {
		width: 90px;
		background: rgba(0, 0, 0, 0.3);
		border: 2px solid transparent;
		border-radius: 6px;
		padding: 0;
		cursor: pointer;
		overflow: hidden;
		transition: border-color 0.15s;
		display: flex;
		flex-direction: column;
	}

	.asset-thumb:hover {
		border-color: var(--orange-400);
	}

	.asset-thumb.selected {
		border-color: var(--orange-300);
		box-shadow: 0 0 0 1px var(--orange-500);
	}

	.asset-thumb img {
		width: 100%;
		height: 60px;
		object-fit: cover;
		display: block;
	}

	.thumb-placeholder {
		width: 100%;
		height: 60px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		background: rgba(0, 0, 0, 0.2);
	}

	.thumb-placeholder.video {
		color: var(--orange-400);
	}

	.asset-name {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		color: var(--text-tertiary);
		padding: 0.2rem 0.3rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}

	.picker-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		border-top: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	.asset-count {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
	}

	.btn {
		padding: 0.35rem 0.75rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.btn:hover {
		background: rgba(255, 255, 255, 0.1);
		border-color: var(--orange-400);
	}

	.btn-upload {
		background: var(--accent-soft);
		border-color: var(--orange-500);
		color: var(--orange-300);
	}
</style>
