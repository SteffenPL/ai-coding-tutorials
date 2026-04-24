<script lang="ts">
	import type { TraceBlock } from './types';

	interface TraceInfo {
		slug: string;
		title?: string;
		roundCount: number;
	}

	interface TraceDetail {
		slug: string;
		rounds: { prompt: string }[];
	}

	let {
		availableTraces,
		onAddBlock,
		onClose
	}: {
		availableTraces: TraceInfo[];
		onAddBlock: (block: TraceBlock) => void;
		onClose: () => void;
	} = $props();

	let query = $state('');
	let traceDetails = $state<Map<string, TraceDetail>>(new Map());
	let loading = $state(true);
	let inputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		inputEl?.focus();
	});

	$effect(() => {
		loadTraceDetails();
	});

	async function loadTraceDetails() {
		loading = true;
		const details = new Map<string, TraceDetail>();
		await Promise.all(
			availableTraces.map(async (t) => {
				try {
					const res = await fetch(`/api/traces/${t.slug}`);
					const json = await res.json();
					if (json.exists && json.state) {
						details.set(t.slug, {
							slug: t.slug,
							rounds: json.state.rounds.map((r: { prompt: string }) => ({ prompt: r.prompt }))
						});
					}
				} catch {
					// skip unavailable traces
				}
			})
		);
		traceDetails = details;
		loading = false;
	}

	interface SearchResult {
		type: 'trace' | 'round';
		traceSlug: string;
		roundIndex?: number;
		label: string;
		sublabel: string;
	}

	const results = $derived.by(() => {
		const q = query.toLowerCase().trim();
		const items: SearchResult[] = [];

		for (const trace of availableTraces) {
			const detail = traceDetails.get(trace.slug);
			const traceLabel = trace.title || trace.slug;
			const traceMatches = !q || traceLabel.toLowerCase().includes(q) || trace.slug.toLowerCase().includes(q);

			if (traceMatches) {
				items.push({
					type: 'trace',
					traceSlug: trace.slug,
					label: traceLabel,
					sublabel: `${detail?.rounds.length ?? trace.roundCount} rounds`
				});
			}

			if (detail) {
				for (let i = 0; i < detail.rounds.length; i++) {
					const prompt = detail.rounds[i].prompt;
					const roundMatches = !q || prompt.toLowerCase().includes(q) || trace.slug.toLowerCase().includes(q);
					if (roundMatches) {
						items.push({
							type: 'round',
							traceSlug: trace.slug,
							roundIndex: i,
							label: `R${i + 1}: ${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}`,
							sublabel: trace.slug
						});
					}
				}
			}
		}

		return items;
	});

	function select(item: SearchResult) {
		if (item.type === 'trace') {
			onAddBlock({ kind: 'trace', sourceSlug: item.traceSlug });
		} else {
			onAddBlock({ kind: 'trace', sourceSlug: item.traceSlug, rounds: [item.roundIndex!] });
		}
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="search-backdrop" onpointerdown={onClose}>
	<div class="search-container" onpointerdown={(e) => e.stopPropagation()} onkeydown={handleKeydown}>
		<input
			bind:this={inputEl}
			class="search-input"
			type="text"
			placeholder="Search traces and rounds..."
			bind:value={query}
		/>
		<div class="search-results">
			{#if loading}
				<div class="search-empty">Loading traces...</div>
			{:else if results.length === 0}
				<div class="search-empty">No matches</div>
			{:else}
				{#each results as item}
					<button class="search-item" class:is-trace={item.type === 'trace'} class:is-round={item.type === 'round'} onclick={() => select(item)}>
						<span class="search-item-kind">{item.type === 'trace' ? '⬡' : '○'}</span>
						<span class="search-item-label">{item.label}</span>
						<span class="search-item-sub">{item.sublabel}</span>
					</button>
				{/each}
			{/if}
		</div>
	</div>
</div>

<style>
	.search-backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgba(0, 0, 0, 0.4);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 15vh;
	}
	.search-container {
		width: 100%;
		max-width: 560px;
		background: var(--glass-bg-strong);
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
		overflow: hidden;
	}
	.search-input {
		width: 100%;
		padding: 0.75rem 1rem;
		background: transparent;
		border: none;
		border-bottom: 1px solid var(--border-subtle);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.85rem;
		outline: none;
	}
	.search-input::placeholder {
		color: var(--text-tertiary);
	}
	.search-results {
		max-height: 400px;
		overflow-y: auto;
	}
	.search-empty {
		padding: 1rem;
		text-align: center;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-tertiary);
	}
	.search-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.45rem 1rem;
		background: transparent;
		border: none;
		border-bottom: 1px solid rgba(255, 255, 255, 0.03);
		color: var(--text-primary);
		cursor: pointer;
		text-align: left;
		transition: background 0.1s;
	}
	.search-item:hover {
		background: rgba(255, 255, 255, 0.05);
	}
	.search-item.is-trace {
		border-top: 1px solid rgba(255, 255, 255, 0.06);
	}
	.search-item.is-round {
		padding-left: 2rem;
	}
	.search-item-kind {
		font-size: 0.7rem;
		color: var(--text-tertiary);
		flex-shrink: 0;
		width: 1rem;
		text-align: center;
	}
	.search-item.is-trace .search-item-kind {
		color: var(--orange-300);
	}
	.search-item-label {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.search-item-sub {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		flex-shrink: 0;
	}
</style>
