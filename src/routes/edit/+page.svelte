<script lang="ts">
	import { base } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';
	import DropZone from '$lib/components/DropZone.svelte';
	import AssetUploadDialog from '$lib/components/AssetUploadDialog.svelte';

	let { data } = $props();

	// Session import state
	let showImport = $state(false);
	let importSlug = $state('');
	let importParent = $state('');
	let importFile: File | null = $state(null);
	let importStatus = $state('');
	let importing = $state(false);

	let newTutorialSlug = $state('');
	let showNewTutorial = $state(false);
	let newTraceSlug = $state('');
	let showNewTrace = $state(false);
	let newTraceFromSession = $state<string | null>(null);

	let expandedTutorialAssets: Record<string, boolean> = $state({});
	let copyToast = $state('');
	let copyTimeout: ReturnType<typeof setTimeout> | undefined;

	// Asset upload dialog state
	let assetDialogOpen = $state(false);
	let assetDialogSlug: string | undefined = $state(undefined);

	async function copyAssetRef(ref: string) {
		await navigator.clipboard.writeText(ref);
		clearTimeout(copyTimeout);
		copyToast = ref;
		copyTimeout = setTimeout(() => (copyToast = ''), 1500);
	}

	function isImage(filename: string): boolean {
		return /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/i.test(filename);
	}

	function findRefs(kind: string, slug: string): string[] {
		const warnings: string[] = [];
		if (kind === 'session') {
			for (const t of data.traces) {
				if (t.sessionSlug === slug) warnings.push(`trace "${t.slug}"`);
			}
		}
		if (kind === 'trace') {
			for (const t of data.tutorials) {
				if (t.sourceSlugs?.includes(slug)) warnings.push(`tutorial "${t.slug}"`);
			}
		}
		return warnings;
	}

	async function deleteItem(kind: string, opts: { slug?: string; filename?: string; shared?: boolean } = {}) {
		const label = kind === 'asset' ? opts.filename : opts.slug;
		let msg = `Move ${kind} "${label}" to trash?`;
		if (opts.slug) {
			const refs = findRefs(kind, opts.slug);
			if (refs.length > 0) {
				msg += `\n\nWarning: referenced by ${refs.join(', ')}`;
			}
		}
		if (!confirm(msg)) return;
		const res = await fetch('/api/edit/delete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ kind, ...opts })
		});
		if (res.ok) location.reload();
	}

	let trashExpanded = $state(false);

	async function emptyTrash() {
		if (!confirm('Permanently delete all trashed items? This cannot be undone.')) return;
		const res = await fetch('/api/edit/trash', { method: 'DELETE' });
		if (res.ok) location.reload();
	}

	async function trashAction(action: 'restore' | 'delete', kind: string, name: string) {
		const verb = action === 'restore' ? 'Restore' : 'Permanently delete';
		if (!confirm(`${verb} "${name}"?`)) return;
		const res = await fetch('/api/edit/trash', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action, kind, name })
		});
		if (res.ok) location.reload();
	}

	function trashKindLabel(kind: string): string {
		switch (kind) {
			case 'tutorial-assets': return 'tutorial assets';
			default: return kind.replace(/s$/, '');
		}
	}

	function handleSessionFile(files: File[]) {
		const f = files[0];
		importFile = f;
		importStatus = '';
		if (!importSlug) {
			importSlug = f.name.replace(/\.jsonl$/, '').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
		}
	}

	async function importSession() {
		if (!importFile || !importSlug) return;
		importing = true;
		importStatus = '';
		try {
			const formData = new FormData();
			formData.append('file', importFile);
			formData.append('slug', importSlug);
			if (importParent) {
				formData.append('parentSession', importParent);
			}
			const res = await fetch('/api/sessions/upload', {
				method: 'POST',
				body: formData
			});
			const json = await res.json();
			if (json.ok) {
				const parentNote = json.parentSession ? ` (subagent of ${json.parentSession})` : '';
				importStatus = `Imported: ${json.kept} events kept, ${json.dropped} dropped${parentNote}`;
				setTimeout(() => location.reload(), 1500);
			} else {
				importStatus = `Error: ${json.message ?? 'Import failed'}`;
			}
		} catch {
			importStatus = 'Import error';
		}
		importing = false;
	}

	function createTrace(sessionSlug: string) {
		window.location.href = `${base}/curate/${sessionSlug}`;
	}

	async function createTutorial() {
		if (!newTutorialSlug) return;
		const composition = {
			slug: newTutorialSlug,
			meta: { slug: newTutorialSlug, title: { en: newTutorialSlug }, tags: [], author: 'Steffen Plunder' },
			blocks: []
		};
		const res = await fetch(`/api/compose/${newTutorialSlug}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(composition)
		});
		if (res.ok) {
			window.location.href = `${base}/compose/${newTutorialSlug}`;
		}
	}

	function openAssetDialog(slug?: string) {
		assetDialogSlug = slug;
		assetDialogOpen = true;
	}

	function handleAssetUploaded() {
		setTimeout(() => location.reload(), 800);
	}
</script>

<svelte:head>
	<title>Edit Dashboard</title>
</svelte:head>

<div class="page-bg" aria-hidden="true"></div>

<Nav pageTitle="Edit Dashboard" />

<main class="dashboard">
	<!-- ═══ SESSIONS ═══ -->
	<section class="section grid-sessions">
		<div class="section-header">
			<h2>Sessions</h2>
			<button class="btn" onclick={() => (showImport = !showImport)}>
				{showImport ? 'Cancel' : 'Import Session'}
			</button>
		</div>

		{#if showImport}
			<div class="import-form">
				<DropZone
					accept=".jsonl"
					label={importFile ? importFile.name : 'Drop .jsonl session file here'}
					sublabel={importFile ? `${(importFile.size / 1024).toFixed(1)} KB — ready to import` : 'or click to browse'}
					onfiles={handleSessionFile}
				/>
				{#if importFile}
					<label>
						<span>Slug</span>
						<input type="text" bind:value={importSlug} placeholder="my-session" />
					</label>
					<label>
						<span>Subagent of (optional)</span>
						<select bind:value={importParent}>
							<option value="">None (standalone session)</option>
							{#each data.sessions as session}
								<option value={session.slug}>{session.slug}</option>
							{/each}
						</select>
					</label>
					<div class="import-actions">
						<button class="btn btn-primary" onclick={importSession} disabled={importing || !importSlug}>
							{importing ? 'Importing...' : 'Import'}
						</button>
						{#if importStatus}
							<span class="status-msg">{importStatus}</span>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		{#if data.sessions.length === 0}
			<p class="empty">No sessions imported yet.</p>
		{:else}
			<ul class="item-list">
				{#each data.sessions as session}
					{@const sessionTraces = data.traces.filter(t => t.sessionSlug === session.slug)}
					<li class="item item-col">
						<div class="item-row">
							<span class="item-slug">{session.slug}</span>
							<div class="item-actions">
								<a class="btn-sm" href="{base}/log/{session.slug}">View Log</a>
								<button class="btn-sm btn-accent" onclick={() => {
									newTraceFromSession = session.slug;
									newTraceSlug = session.slug + '-trace';
								}}>New Trace</button>
								<button class="btn-sm btn-danger" onclick={() => deleteItem('session', { slug: session.slug })}>Delete</button>
							</div>
						</div>
						{#if sessionTraces.length > 0}
							<div class="item-sub">
								{#each sessionTraces as trace}
									<a class="sub-link" href="{base}/curate/{trace.slug}">{trace.slug}</a>
								{/each}
							</div>
						{/if}
						{#if newTraceFromSession === session.slug}
							<div class="inline-form">
								<input
									type="text"
									bind:value={newTraceSlug}
									placeholder="trace-slug"
									class="slug-input"
								/>
								<a
									class="btn btn-primary"
									href={newTraceSlug ? `${base}/curate/${newTraceSlug}?session=${session.slug}` : '#'}
									class:disabled={!newTraceSlug}
								>Create</a>
								<button class="btn-sm" onclick={() => (newTraceFromSession = null)}>Cancel</button>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- ═══ TRACES ═══ -->
	<section class="section grid-traces">
		<div class="section-header">
			<h2>Traces</h2>
			<button class="btn" onclick={() => (showNewTrace = !showNewTrace)}>
				{showNewTrace ? 'Cancel' : 'New Trace'}
			</button>
		</div>

		{#if showNewTrace}
			<div class="inline-form">
				<input
					type="text"
					bind:value={newTraceSlug}
					placeholder="trace-slug"
					class="slug-input"
				/>
				<a
					class="btn btn-primary"
					href={newTraceSlug ? `${base}/curate/${newTraceSlug}` : '#'}
					class:disabled={!newTraceSlug}
				>
					Create & Edit
				</a>
			</div>
		{/if}

		{#if data.traces.length === 0 && !showNewTrace}
			<p class="empty">No traces yet. Create a blank trace or curate one from a session.</p>
		{:else}
			<ul class="item-list">
				{#each data.traces as trace}
					<li class="item">
						<div class="item-info">
							<span class="item-slug">{trace.slug}</span>
							{#if trace.title && trace.title !== trace.slug}
								<span class="item-title">{trace.title}</span>
							{/if}
							<span class="item-meta">
								{trace.roundCount} rounds
								{#if trace.sessionSlug}
									· from <a class="meta-link" href="{base}/log/{trace.sessionSlug}">{trace.sessionSlug}</a>
								{:else}
									· standalone
								{/if}
							</span>
						</div>
						<div class="item-actions">
							<a class="btn-sm" href="{base}/curate/{trace.slug}">Edit</a>
							<button class="btn-sm btn-danger" onclick={() => deleteItem('trace', { slug: trace.slug })}>Delete</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- ═══ TUTORIALS ═══ -->
	<section class="section grid-tutorials">
		<div class="section-header">
			<h2>Tutorials</h2>
			<button class="btn" onclick={() => (showNewTutorial = !showNewTutorial)}>
				{showNewTutorial ? 'Cancel' : 'New Tutorial'}
			</button>
		</div>

		{#if showNewTutorial}
			<div class="import-form">
				<label>
					<span>Tutorial slug</span>
					<input type="text" bind:value={newTutorialSlug} placeholder="my-tutorial" />
				</label>
				<button class="btn btn-primary" onclick={createTutorial} disabled={!newTutorialSlug}>
					Create
				</button>
			</div>
		{/if}

		{#if data.tutorials.length === 0}
			<p class="empty">No tutorials yet.</p>
		{:else}
			<ul class="item-list">
				{#each data.tutorials as tutorial}
					<li class="item">
						<div class="item-info">
							<span class="item-slug">{tutorial.slug}</span>
							{#if tutorial.title}
								<span class="item-title">{tutorial.title}</span>
							{/if}
							<span class="item-meta">
								{tutorial.blockCount} blocks
								{#if tutorial.sourceSlugs?.length}
									· traces: {tutorial.sourceSlugs.join(', ')}
								{/if}
							</span>
						</div>
						<div class="item-actions">
							<a class="btn-sm" href="{base}/compose/{tutorial.slug}">Compose</a>
							<a class="btn-sm" href="{base}/preview/{tutorial.slug}">Preview</a>
							<button class="btn-sm btn-danger" onclick={() => deleteItem('tutorial', { slug: tutorial.slug })}>Delete</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- ═══ ASSETS ═══ -->
	<section class="section grid-assets">
		<div class="section-header">
			<h2>Assets</h2>
			<button class="btn" onclick={() => openAssetDialog()}>Upload Asset</button>
		</div>

		{#if copyToast}
			<div class="copy-toast">Copied: {copyToast}</div>
		{/if}

		<!-- Shared assets -->
		<div class="asset-group">
			<div class="asset-group-header">
				<span class="asset-group-title">Shared</span>
				<span class="asset-group-count">{data.assets.shared.length}</span>
			</div>
			{#if data.assets.shared.length === 0}
				<p class="empty">No shared assets yet.</p>
			{:else}
				<div class="asset-grid">
					{#each data.assets.shared as filename}
						<div class="asset-item-wrap">
							<button
								class="asset-item"
								title="Click to copy: shared/{filename}"
								onclick={() => copyAssetRef(`shared/${filename}`)}
							>
								{#if isImage(filename)}
									<img class="asset-thumb" src="/assets/{filename}" alt={filename} />
								{:else}
									<div class="asset-thumb asset-thumb-placeholder">
										<span>{filename.split('.').pop()}</span>
									</div>
								{/if}
								<span class="asset-name">{filename}</span>
							</button>
							<button class="asset-delete" title="Delete" onclick={() => deleteItem('asset', { filename, shared: true })}>x</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Per-tutorial assets -->
		{#each Object.entries(data.assets.tutorials as Record<string, string[]>) as [slug, files]}
			<div class="asset-group">
				<button
					class="asset-group-header asset-group-toggle"
					onclick={() => (expandedTutorialAssets[slug] = !expandedTutorialAssets[slug])}
				>
					<span class="asset-group-title">{slug}</span>
					<span class="asset-group-count">{files.length}</span>
					<span class="asset-chevron" class:expanded={expandedTutorialAssets[slug]}>›</span>
				</button>
				{#if expandedTutorialAssets[slug]}
					<div class="asset-grid">
						{#each files as filename}
							<div class="asset-item-wrap">
								<button
									class="asset-item"
									title="Click to copy: {filename}"
									onclick={() => copyAssetRef(filename)}
								>
									{#if isImage(filename)}
										<img class="asset-thumb" src="/tutorials/{slug}/assets/{filename}" alt={filename} />
									{:else}
										<div class="asset-thumb asset-thumb-placeholder">
											<span>{filename.split('.').pop()}</span>
										</div>
									{/if}
									<span class="asset-name">{filename}</span>
								</button>
								<button class="asset-delete" title="Delete" onclick={() => deleteItem('asset', { slug, filename })}>x</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</section>

	<!-- ═══ TRASH ═══ -->
	{#if data.trash.count > 0}
		<section class="section trash-section">
			<button class="section-header trash-toggle" onclick={() => (trashExpanded = !trashExpanded)}>
				<h2>Trash <span class="trash-count">{data.trash.count}</span></h2>
				<div class="trash-header-actions">
					{#if trashExpanded}
						<button class="btn-sm btn-danger" onclick={(e: MouseEvent) => { e.stopPropagation(); emptyTrash(); }}>Empty All</button>
					{/if}
					<span class="asset-chevron" class:expanded={trashExpanded}>›</span>
				</div>
			</button>

			{#if trashExpanded}
				<ul class="item-list">
					{#each data.trash.items as item}
						<li class="item">
							<div class="item-info">
								<span class="item-slug">{item.name}</span>
								<span class="item-meta">{trashKindLabel(item.kind)}</span>
							</div>
							<div class="item-actions">
								<button class="btn-sm" onclick={() => trashAction('restore', item.kind, item.name)}>Restore</button>
								<button class="btn-sm btn-danger" onclick={() => trashAction('delete', item.kind, item.name)}>Delete</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>

<AssetUploadDialog
	open={assetDialogOpen}
	tutorialSlug={assetDialogSlug}
	onclose={() => (assetDialogOpen = false)}
	onuploaded={handleAssetUploaded}
/>

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

	.dashboard {
		max-width: 1100px;
		margin: 80px auto 0;
		padding: 24px;
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-areas:
			"sessions traces"
			"tutorials tutorials"
			"assets assets"
			"trash trash";
		gap: 1rem;
	}

	.grid-sessions { grid-area: sessions; }
	.grid-traces { grid-area: traces; }
	.grid-tutorials { grid-area: tutorials; }
	.grid-assets { grid-area: assets; }
	:global(.trash-section) { grid-area: trash; }

	.grid-sessions,
	.grid-traces {
		max-height: 500px;
		overflow-y: auto;
	}

	@media (max-width: 768px) {
		.dashboard {
			grid-template-columns: 1fr;
			grid-template-areas:
				"sessions"
				"traces"
				"tutorials"
				"assets"
				"trash";
		}

		.grid-sessions,
		.grid-traces {
			max-height: none;
		}
	}

	.section {
		border: 1px solid var(--border-subtle);
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.2);
		overflow: hidden;
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.15);
	}

	.section-header h2 {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		color: var(--orange-300);
		font-weight: 600;
	}

	.empty {
		padding: 1rem;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		text-align: center;
	}

	.item-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.item:last-child {
		border-bottom: none;
	}

	.item-info {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.item-slug {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.item-title {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--text-secondary);
	}

	.item-meta {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
	}

	.item-actions {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	/* ─── Import form ─── */
	.import-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		background: rgba(0, 0, 0, 0.1);
	}

	.import-form label {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.import-form label > span {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.import-form input {
		padding: 0.35rem 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.import-form input:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	.import-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.status-msg {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--teal);
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
		transition: all 0.15s;
	}

	.btn-sm:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.btn-accent {
		border-color: var(--orange-500);
		color: var(--orange-300);
	}

	.btn-danger {
		border-color: rgba(220, 60, 60, 0.4);
		color: rgba(220, 100, 100, 0.8);
	}

	.btn-danger:hover {
		background: rgba(220, 60, 60, 0.15);
		border-color: rgba(220, 60, 60, 0.6);
		color: rgb(220, 100, 100);
	}

	.import-form select {
		padding: 0.35rem 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
	}

	.import-form select:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	/* ─── Assets panel ─── */
	.copy-toast {
		padding: 0.35rem 1rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--teal);
		background: rgba(0, 0, 0, 0.15);
		border-bottom: 1px solid var(--border-subtle);
	}

	.asset-group {
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}

	.asset-group:last-child {
		border-bottom: none;
	}

	.asset-group-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.asset-group-toggle {
		cursor: pointer;
		transition: background 0.15s;
	}

	.asset-group-toggle:hover {
		background: rgba(255, 255, 255, 0.03);
	}

	.asset-group-title {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.asset-group-count {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.06);
		padding: 0.1rem 0.4rem;
		border-radius: 8px;
	}

	.asset-chevron {
		margin-left: auto;
		font-size: 0.8rem;
		color: var(--text-tertiary);
		transition: transform 0.15s;
		transform: rotate(0deg);
	}

	.asset-chevron.expanded {
		transform: rotate(90deg);
	}

	.asset-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem 1rem 0.75rem;
	}

	.asset-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		width: 80px;
		padding: 0.35rem;
		background: rgba(255, 255, 255, 0.03);
		border: 1px solid transparent;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.asset-item:hover {
		background: rgba(255, 255, 255, 0.07);
		border-color: var(--orange-400);
	}

	.asset-thumb {
		width: 64px;
		height: 48px;
		object-fit: cover;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.3);
	}

	.asset-thumb-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-mono);
		font-size: 0.6rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
	}

	.asset-name {
		font-family: var(--font-mono);
		font-size: 0.55rem;
		color: var(--text-tertiary);
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}

	.asset-item-wrap {
		position: relative;
	}

	.asset-delete {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 16px;
		height: 16px;
		padding: 0;
		background: rgba(0, 0, 0, 0.6);
		border: none;
		border-radius: 50%;
		color: rgba(220, 100, 100, 0.8);
		font-family: var(--font-mono);
		font-size: 0.55rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.15s;
	}

	.asset-item-wrap:hover .asset-delete {
		opacity: 1;
	}

	.asset-delete:hover {
		background: rgba(220, 60, 60, 0.3);
		color: rgb(220, 100, 100);
	}

	/* ─── Trash section ─── */
	.trash-section {
		border-color: rgba(220, 60, 60, 0.2);
	}

	.trash-toggle {
		cursor: pointer;
		border: none;
		width: 100%;
		text-align: left;
		color: inherit;
		font: inherit;
	}

	.trash-toggle:hover {
		background: rgba(220, 60, 60, 0.05);
	}

	.trash-toggle h2 {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.trash-count {
		font-size: 0.62rem;
		font-weight: 400;
		color: rgba(220, 100, 100, 0.8);
		background: rgba(220, 60, 60, 0.15);
		padding: 0.1rem 0.4rem;
		border-radius: 8px;
	}

	.trash-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.inline-form {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
	}
	.slug-input {
		flex: 1;
		padding: 0.35rem 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.78rem;
	}
	.slug-input:focus {
		outline: none;
		border-color: var(--orange-400);
	}
	.disabled {
		opacity: 0.4;
		pointer-events: none;
	}

	.item-col {
		flex-direction: column;
		align-items: stretch;
		gap: 0.35rem;
	}

	.item-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.item-sub {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		padding-left: 0.5rem;
	}

	.sub-link {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		background: rgba(255, 255, 255, 0.04);
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		text-decoration: none;
		transition: all 0.15s;
	}

	.sub-link:hover {
		color: var(--orange-300);
		background: rgba(233, 84, 32, 0.1);
	}

	.meta-link {
		color: var(--text-tertiary);
		text-decoration: none;
	}

	.meta-link:hover {
		color: var(--orange-300);
	}
</style>
