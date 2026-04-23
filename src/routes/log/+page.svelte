<script lang="ts">
	import { base } from '$app/paths';
	import Nav from '$lib/components/Nav.svelte';

	let { data } = $props();
</script>

<Nav pageTitle="Session Logs" />

<main class="log-index">
	<h1>Session Logs</h1>
	<ul>
		{#each data.slugs as slug}
			<li>
				<a href="{base}/log/{slug}">{slug}</a>
				<a class="curate-link" href="{base}/curate/{slug}" title="Open in tutorial editor">Curate</a>
			</li>
		{/each}
	</ul>
</main>

<style>
	.log-index {
		max-width: 720px;
		margin: 80px auto 0;
		padding: 24px;
	}

	h1 {
		font-family: var(--font-display);
		font-size: 1.5rem;
		color: var(--text-primary);
		margin-bottom: 24px;
	}

	ul {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	li {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	li a {
		font-family: var(--font-mono);
		font-size: 0.9rem;
		color: var(--accent);
		text-decoration: none;
		padding: 10px 16px;
		border-radius: 8px;
		background: var(--bg-secondary);
		display: block;
		transition: background 0.15s ease;
		flex: 1;
	}

	li a:hover {
		background: var(--bg-tertiary, rgba(255, 255, 255, 0.08));
	}

	.curate-link {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		text-decoration: none;
		padding: 6px 12px;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.03);
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.curate-link:hover {
		color: var(--accent);
		border-color: var(--accent);
		background: rgba(233, 84, 32, 0.08);
	}
</style>
