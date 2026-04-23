<script lang="ts">
	import { base } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';

	let { data } = $props();

	let showImport = $state(false);
	let importPath = $state('');
	let importSlug = $state('');
	let importStatus = $state('');
	let importing = $state(false);

	let newTutorialSlug = $state('');
	let showNewTutorial = $state(false);

	let expandedTutorialAssets: Record<string, boolean> = $state({});
	let copyToast = $state('');
	let copyTimeout: ReturnType<typeof setTimeout> | undefined;

	async function copyAssetRef(ref: string) {
		await navigator.clipboard.writeText(ref);
		clearTimeout(copyTimeout);
		copyToast = ref;
		copyTimeout = setTimeout(() => (copyToast = ''), 1500);
	}

	async function uploadSharedAsset(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const formData = new FormData();
		formData.append('file', file);
		const res = await fetch('/api/assets/upload', { method: 'POST', body: formData });
		const json = await res.json();
		if (json.ok) {
			location.reload();
		}
		input.value = '';
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

	async function importSession() {
		if (!importPath || !importSlug) return;
		importing = true;
		importStatus = '';
		try {
			const res = await fetch('/api/sessions/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionPath: importPath, slug: importSlug })
			});
			const json = await res.json();
			if (json.ok) {
				importStatus = `Imported: ${json.kept} events kept, ${json.dropped} dropped, ${json.subagentCount} subagents`;
				setTimeout(() => location.reload(), 1500);
			} else {
				importStatus = `Error: ${json.message ?? 'Import failed'}`;
			}
		} catch (e) {
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
			meta: { slug: newTutorialSlug, title: { en: newTutorialSlug }, tags: [] },
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
</script>

<svelte:head>
	<title>Edit Dashboard</title>
</svelte:head>

<div class="page-bg" aria-hidden="true"></div>

<Nav pageTitle="Edit Dashboard" />

<main class="dashboard">
	<!-- ═══ SESSIONS ═══ -->
	<section class="section">
		<div class="section-header">
			<h2>Sessions</h2>
			<button class="btn" onclick={() => (showImport = !showImport)}>
				{showImport ? 'Cancel' : 'Import Session'}
			</button>
		</div>

		{#if showImport}
			<div class="import-form">
				<label>
					<span>Session JSONL path</span>
					<input type="text" bind:value={importPath} placeholder="~/.claude/projects/.../uuid.jsonl" />
				</label>
				<label>
					<span>Slug</span>
					<input type="text" bind:value={importSlug} placeholder="my-session" />
				</label>
				<div class="import-actions">
					<button class="btn btn-primary" onclick={importSession} disabled={importing || !importPath || !importSlug}>
						{importing ? 'Importing...' : 'Import'}
					</button>
					{#if importStatus}
						<span class="status-msg">{importStatus}</span>
					{/if}
				</div>
			</div>
		{/if}

		{#if data.sessions.length === 0}
			<p class="empty">No sessions imported yet.</p>
		{:else}
			<ul class="item-list">
				{#each data.sessions as session}
					<li class="item">
						<span class="item-slug">{session.slug}</span>
						<div class="item-actions">
							<a class="btn-sm" href="{base}/log/{session.slug}">View</a>
							{#if session.hasTrace}
								<a class="btn-sm" href="{base}/curate/{session.slug}">Edit Trace</a>
							{:else}
								<button class="btn-sm btn-accent" onclick={() => createTrace(session.slug)}>Create Trace</button>
							{/if}
								<button class="btn-sm btn-danger" onclick={() => deleteItem('session', { slug: session.slug })}>Delete</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- ═══ TRACES ═══ -->
	<section class="section">
		<div class="section-header">
			<h2>Traces</h2>
		</div>

		{#if data.traces.length === 0}
			<p class="empty">No traces yet. Create one from a session above.</p>
		{:else}
			<ul class="item-list">
				{#each data.traces as trace}
					<li class="item">
						<div class="item-info">
							<span class="item-slug">{trace.slug}</span>
							{#if trace.title && trace.title !== trace.slug}
								<span class="item-title">{trace.title}</span>
							{/if}
							<span class="item-meta">{trace.roundCount} rounds · from {trace.sessionSlug}</span>
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
	<section class="section">
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
								{#if tutorial.hasComposition}{tutorial.blockCount} blocks{/if}
								{#if tutorial.hasYaml}
									{tutorial.hasComposition ? ' · ' : ''}YAML exported
									{#if tutorial.exportDate}
										· {new Date(tutorial.exportDate).toLocaleDateString()}
									{/if}
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
	<section class="section">
		<div class="section-header">
			<h2>Assets</h2>
			<label class="btn upload-label">
				Upload Shared
				<input type="file" accept="image/*,video/*" onchange={uploadSharedAsset} hidden />
			</label>
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

	.dashboard {
		max-width: 860px;
		margin: 80px auto 0;
		padding: 24px;
		display: flex;
		flex-direction: column;
		gap: 2rem;
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

	/* ─── Assets panel ─── */
	.upload-label {
		cursor: pointer;
	}

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
</style>
