<script lang="ts">
	import type { FolderContent, FolderEntry } from '$lib/data/tutorials';

	let { content }: { content: FolderContent } = $props();
</script>

{#snippet entryNode(entry: FolderEntry, depth: number)}
	<div class="entry" style="padding-left: {12 + depth * 16}px">
		<span class="entry-icon">
			{#if entry.type === 'folder'}
				<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
					<path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2c-.33-.44-.85-.7-1.4-.7H1.75z" />
				</svg>
			{:else}
				<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
					<path d="M3.75 1.5a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V6H9.75A1.75 1.75 0 0 1 8 4.25V1.5H3.75zm5.75.56v2.19c0 .138.112.25.25.25h2.19L9.5 2.06zM2 1.75C2 .784 2.784 0 3.75 0h5.086c.464 0 .909.184 1.237.513l3.414 3.414c.329.328.513.773.513 1.237v9.086A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25V1.75z" />
				</svg>
			{/if}
		</span>
		<span class="entry-name" class:is-folder={entry.type === 'folder'}>{entry.name}</span>
	</div>
	{#if entry.children}
		{#each entry.children as child}
			{@render entryNode(child, depth + 1)}
		{/each}
	{/if}
{/snippet}

<div class="folder-body">
	{#each content.entries as entry}
		{@render entryNode(entry, 0)}
	{/each}
</div>

<style>
	.folder-body {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
		background: #1e151a;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.5;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-top: 2px;
		padding-bottom: 2px;
		padding-right: 12px;
	}

	.entry:hover {
		background: rgba(255, 255, 255, 0.04);
	}

	.entry-icon {
		color: var(--text-tertiary);
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.entry-name {
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.entry-name.is-folder {
		color: var(--text-primary);
		font-weight: 600;
	}

	.folder-body::-webkit-scrollbar { width: 6px; }
	.folder-body::-webkit-scrollbar-track { background: transparent; }
	.folder-body::-webkit-scrollbar-thumb { background: var(--border-subtle); border-radius: 3px; }
</style>
