<script lang="ts">
	import type { PageProps } from './$types';
	import type {
		DisplayNode,
		PromptKind,
		Round,
		SubagentView,
		ToolInvocationResult
	} from '$lib/session/viewmodel';
	import {
		settings,
		visibilityFor,
		DETAIL_LEVELS,
		type DetailLevel
	} from '$lib/session/settings.svelte';
	import Nav from '$lib/components/Nav.svelte';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { base } from '$app/paths';

	let { data }: PageProps = $props();
	const view = $derived(data.view);
	const vis = $derived(visibilityFor(settings.detailLevel));

	/** Pretty tool name: mcp__fiji-mcp__run_ij_macro → "fiji · run_ij_macro". */
	function prettyToolName(name: string): string {
		const m = name.match(/^mcp__([^_]+)-mcp__(.+)$/) ?? name.match(/^mcp__(.+?)__(.+)$/);
		return m ? `${m[1]} · ${m[2]}` : name;
	}

	function primaryInputText(name: string, input: Record<string, unknown>): string | null {
		if (name === 'Bash' && typeof input.command === 'string') return input.command;
		if (name.endsWith('run_ij_macro') && typeof input.macro === 'string') return input.macro;
		if (name.endsWith('run_script') && typeof input.script === 'string') return input.script;
		return null;
	}

	function dataUrl(mime: string, data: string): string {
		return `data:${mime};base64,${data}`;
	}

	function promptPreview(text: string, max = 70): string {
		const clean = text.replace(/\s+/g, ' ').trim();
		return clean.length > max ? clean.slice(0, max) + '…' : clean;
	}

	function kindLabel(k: PromptKind): string {
		switch (k) {
			case 'slash':
				return 'slash command';
			case 'command-output':
				return 'command output';
			case 'compaction-summary':
				return 'compaction summary';
			case 'skill-injection':
				return 'skill injection';
			case 'meta':
				return 'meta wrapper';
			default:
				return '';
		}
	}

	const visibleRounds = $derived(
		settings.hideSlashMeta
			? view.rounds.filter((r) => !r.prompt.isMeta && !r.prompt.slashCommand)
			: view.rounds
	);

	/* ─── Round collapse (minimize) state ─────────────────────────── */
	const collapsed = new SvelteSet<string>();

	function toggleRound(anchor: string) {
		if (collapsed.has(anchor)) collapsed.delete(anchor);
		else collapsed.add(anchor);
	}

	/* ─── Active round detection via IntersectionObserver ─────────── */
	let activeAnchor = $state<string | null>(null);
	let stripEl: HTMLDivElement | null = $state(null);

	$effect(() => {
		if (!browser) return;
		// Reactive dep: re-run when the visible round set changes (e.g.
		// after toggling "hide slash / meta"), so the observer watches the
		// current DOM elements.
		const anchors = visibleRounds.map((r) => r.anchor);
		if (anchors.length === 0) {
			activeAnchor = null;
			return;
		}
		if (!activeAnchor || !anchors.includes(activeAnchor)) {
			activeAnchor = anchors[0];
		}
		// rootMargin: treat the upper band of the viewport as the "focus"
		// region — the topmost round intersecting it is the active round.
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
				if (visible.length > 0) {
					activeAnchor = visible[0].target.id;
				}
			},
			{ rootMargin: '-80px 0px -60% 0px' }
		);
		for (const el of document.querySelectorAll<HTMLElement>('.round-window[id]')) {
			observer.observe(el);
		}
		return () => observer.disconnect();
	});

	/* Keep the active chip visible by auto-scrolling the strip. */
	$effect(() => {
		if (!activeAnchor || !stripEl) return;
		const chip = stripEl.querySelector<HTMLElement>(`[data-anchor="${activeAnchor}"]`);
		if (!chip) return;
		const cLeft = chip.offsetLeft;
		const cRight = cLeft + chip.offsetWidth;
		const sLeft = stripEl.scrollLeft;
		const sRight = sLeft + stripEl.clientWidth;
		if (cLeft < sLeft + 20 || cRight > sRight - 20) {
			stripEl.scrollTo({
				left: cLeft - stripEl.clientWidth / 2 + chip.offsetWidth / 2,
				behavior: 'smooth'
			});
		}
	});

	function scrollStrip(dir: -1 | 1) {
		stripEl?.scrollBy({ left: 260 * dir, behavior: 'smooth' });
	}

	const activeIdx = $derived(
		activeAnchor ? visibleRounds.findIndex((r) => r.anchor === activeAnchor) : -1
	);
</script>

<svelte:head>
	<title>{view.customTitle ?? view.slug} · session log</title>
</svelte:head>

<div class="page-bg" aria-hidden="true"></div>

<Nav showBack pageTitle={view.customTitle ?? view.slug} />

<main class="page">
	<!-- ─── Sticky settings panel ───────────────────────────────── -->
	<section class="settings-panel" aria-label="View settings">
		<div class="panel-head">
			<div class="title-block">
				<div class="breadcrumb">session log</div>
				<h1>{view.customTitle ?? view.slug}</h1>
			</div>
			<div class="stats-line">
				<span class="sess-id">{view.sessionId}</span>
				<span class="sep">·</span>
				<span><strong>{view.stats.rounds}</strong> rounds</span>
				<span><strong>{view.stats.toolInvocations}</strong> tools</span>
				<span><strong>{view.stats.assistantMessages}</strong> messages</span>
				<span><strong>{view.stats.thinkingBlocks}</strong> thinking</span>
				{#if view.stats.subagents > 0}
					<span><strong>{view.stats.subagents}</strong> subagent</span>
				{/if}
				{#if view.stats.compactions > 0}
					<span><strong>{view.stats.compactions}</strong> compact</span>
				{/if}
				<span class="sep">·</span>
				<a class="curate-link" href="{base}/curate/{view.slug}">Curate ↗</a>
			</div>
		</div>

		<div class="panel-controls">
			<!-- Detail slider: 4 discrete steps -->
			<div
				class="detail-slider"
				role="radiogroup"
				aria-label="Detail level"
				style="--level: {settings.detailLevel}"
			>
				{#each DETAIL_LEVELS as lvl (lvl.level)}
					<button
						class="step"
						class:active={settings.detailLevel === lvl.level}
						class:passed={settings.detailLevel > lvl.level}
						onclick={() => (settings.detailLevel = lvl.level)}
						aria-pressed={settings.detailLevel === lvl.level}
					>
						<span class="tick"></span>
						<span class="label">{lvl.label}</span>
					</button>
				{/each}
			</div>

			<!-- Orthogonal hide toggles (filled = hidden) -->
			<div class="hides" role="group" aria-label="Hide filters">
				<span class="hides-label">hide</span>
				<button
					type="button"
					class="hide-pill"
					class:active={settings.hideSlashMeta}
					aria-pressed={settings.hideSlashMeta}
					onclick={() => (settings.hideSlashMeta = !settings.hideSlashMeta)}
				>
					<span class="pill-dot"></span>slash / meta
				</button>
				<button
					type="button"
					class="hide-pill"
					class:active={settings.hideThinking}
					aria-pressed={settings.hideThinking}
					onclick={() => (settings.hideThinking = !settings.hideThinking)}
				>
					<span class="pill-dot"></span>thinking
				</button>
				<button
					type="button"
					class="hide-pill"
					class:active={settings.hideToolResults}
					aria-pressed={settings.hideToolResults}
					onclick={() => (settings.hideToolResults = !settings.hideToolResults)}
				>
					<span class="pill-dot"></span>tool output
				</button>
			</div>
		</div>
	</section>

	<!-- ─── Large terminal container ───────────────────────────── -->
	<section class="terminal" aria-label="Session transcript">
		<div class="terminal-bar">
			<span class="terminal-bar-dot" aria-hidden="true"></span>
			<span class="terminal-bar-label">session · {view.sessionId}</span>
		</div>

		{#if view.preamble.length > 0}
			<section class="preamble">
				<div class="section-label">preamble (before first prompt)</div>
				{#each view.preamble as node (node.uuid + '-' + nodeKey(node))}
					{@render renderNode(node, 0)}
				{/each}
			</section>
		{/if}

		{#each visibleRounds as round (round.anchor)}
			{@render renderRoundWindow(round)}
		{/each}

		{#if view.orphanSubagents.length > 0 && vis.showSubagentBody}
			<div class="orphans-label">orphan subagents</div>
			{#each view.orphanSubagents as sub (sub.agentId)}
				{@render renderOrphanWindow(sub)}
			{/each}
		{/if}
	</section>
</main>

<!-- ─── Bottom round toolbar (fixed) ────────────────────────────────── -->
<nav class="round-toolbar" aria-label="Round navigation">
	<button
		class="tb-btn"
		type="button"
		aria-label="Scroll round strip left"
		onclick={() => scrollStrip(-1)}
	>◀</button>
	<div class="tb-strip" bind:this={stripEl}>
		{#each visibleRounds as r (r.anchor)}
			<a
				href="#{r.anchor}"
				class="tb-chip"
				class:active={activeAnchor === r.anchor}
				class:slash={r.prompt.kind === 'slash'}
				class:meta={r.prompt.kind === 'meta'}
				class:injection={r.prompt.kind !== 'normal'}
				data-anchor={r.anchor}
				title={r.prompt.kind === 'normal'
					? promptPreview(r.prompt.text, 140)
					: `${kindLabel(r.prompt.kind)} — ${promptPreview(r.prompt.text, 100)}`}
			>
				<span class="dot"></span>
				R{r.index}
			</a>
		{/each}
	</div>
	<button
		class="tb-btn"
		type="button"
		aria-label="Scroll round strip right"
		onclick={() => scrollStrip(1)}
	>▶</button>
	<span class="tb-indicator">
		{activeIdx >= 0 ? activeIdx + 1 : '—'} / {visibleRounds.length}
	</span>
</nav>

<!-- ───────────────────── Round window ──────────────────────── -->
{#snippet renderRoundWindow(round: Round)}
	{@const isMin = collapsed.has(round.anchor)}
	{@const isInjection = round.prompt.kind !== 'normal'}
	<article
		class="round-window"
		class:slash={round.prompt.kind === 'slash'}
		class:meta={round.prompt.kind === 'meta'}
		class:injection={isInjection}
		class:minimized={isMin}
		id={round.anchor}
	>
		<WindowChrome
			title={`R${round.index} · ${promptPreview(round.prompt.text, 70)}`}
			subtitle={isInjection ? kindLabel(round.prompt.kind) : undefined}
			icon="&#8250;_"
			variant="primary"
			isMinimized={isMin}
			onMinimize={() => toggleRound(round.anchor)}
			onRestoreMin={() => toggleRound(round.anchor)}
			onHeaderClick={isMin ? () => toggleRound(round.anchor) : undefined}
		/>
		{#if !isMin}
			<div class="round-body">
				{#if isInjection}
					<details class="injected-prompt" open={vis.injectedPromptOpen}>
						<summary>
							<span class="kind-tag">{kindLabel(round.prompt.kind)}</span>
							<span class="kind-meta">{round.prompt.text.length.toLocaleString()} chars</span>
						</summary>
						<pre class="prompt-text">{round.prompt.text}</pre>
					</details>
				{:else}
					<pre class="prompt-text">{round.prompt.text}</pre>
				{/if}
				{#each round.nodes as node (node.uuid + '-' + nodeKey(node))}
					{@render renderNode(node, 0)}
				{/each}
			</div>
		{/if}
	</article>
{/snippet}

<!-- ───────────────────── Orphan subagent window ──────────── -->
{#snippet renderOrphanWindow(sub: SubagentView)}
	<article class="round-window orphan-window">
		<WindowChrome
			title={`subagent · ${sub.agentType}`}
			subtitle={sub.description}
			icon="&#8599;"
			variant="primary"
		/>
		<div class="round-body">
			{#each sub.nodes as child (child.uuid + '-' + nodeKey(child))}
				{@render renderNode(child, 0)}
			{/each}
		</div>
	</article>
{/snippet}

<!-- ───────────────────── Node dispatcher ──────────────────── -->
{#snippet renderNode(node: DisplayNode, depth: number)}
	{#if node.kind === 'user-text'}
		{#if vis.showUserText}
			<article class="node user-text" style="--depth: {depth}">
				<div class="gutter">user</div>
				<pre>{node.text}</pre>
			</article>
		{/if}
	{:else if node.kind === 'assistant-text'}
		{#if vis.showAllAssistant || node.isFinal}
			<article class="node assistant-text" class:final={node.isFinal} style="--depth: {depth}">
				<div class="head">
					<span class="label">{node.isFinal ? 'assistant · final' : 'assistant'}</span>
					{#if node.model}<span class="id">{node.model}</span>{/if}
				</div>
				<pre>{node.text}</pre>
			</article>
		{/if}
	{:else if node.kind === 'thinking'}
		{#if vis.showThinking && !settings.hideThinking}
			{#if node.text.length > 0}
				<details class="node thinking" style="--depth: {depth}">
					<summary>extended thinking ({node.text.length} chars)</summary>
					<pre>{node.text}</pre>
				</details>
			{:else}
				<div
					class="node thinking-marker"
					style="--depth: {depth}"
					title="Claude used extended thinking here — content is not stored in plaintext"
				>
					⋯ extended thinking
				</div>
			{/if}
		{/if}
	{:else if node.kind === 'tool-invocation'}
		{#if vis.showTools}
			{@render renderToolInvocation(node, depth)}
		{/if}
	{:else if node.kind === 'compact'}
		<div class="node compact" style="--depth: {depth}">
			<span>
				— context compacted{node.trigger ? ` (${node.trigger})` : ''}{node.preTokens
					? ` · ${node.preTokens.toLocaleString()} tokens before`
					: ''} —
			</span>
		</div>
	{/if}
{/snippet}

<!-- ───────────────────── Tool invocation ──────────────────── -->
{#snippet renderToolInvocation(
	node: Extract<DisplayNode, { kind: 'tool-invocation' }>,
	depth: number
)}
	<details
		class="node tool"
		class:error={node.result?.isError}
		open={vis.toolBodyOpen}
		style="--depth: {depth}"
	>
		<summary class="tool-summary">
			<span class="status">
				{#if node.result?.isError}✗{:else if node.result}✓{:else}⋯{/if}
			</span>
			<span class="tool-name">{prettyToolName(node.name)}</span>
			<span class="tool-brief">{toolBrief(node.name, node.input)}</span>
			{#if node.subagent && vis.showSubagentBadge}
				<span class="subagent-badge">↳ subagent {node.subagent.nodes.length}</span>
			{/if}
		</summary>
		<div class="tool-body">
			<div class="pane">
				<div class="pane-label">input</div>
				<pre class="code">{primaryInputText(node.name, node.input) ??
						JSON.stringify(node.input, null, 2)}</pre>
			</div>
			{#if node.result && (!settings.hideToolResults || node.result.isError)}
				<div class="pane" class:err={node.result.isError}>
					<div class="pane-label">{node.result.isError ? 'error' : 'output'}</div>
					{@render renderResultContent(node.result.content)}
				</div>
			{/if}
			{#if node.subagent && vis.showSubagentBody}
				{@render renderSubagent(node.subagent, depth + 1)}
			{/if}
		</div>
	</details>
{/snippet}

{#snippet renderResultContent(content: ToolInvocationResult['content'])}
	{#if typeof content === 'string'}
		<pre>{content}</pre>
	{:else}
		{#each content as part, i (i)}
			{#if part.type === 'text'}
				<pre>{part.text}</pre>
			{:else if part.type === 'image'}
				<img
					class="tool-image"
					src={dataUrl(part.source.media_type, part.source.data)}
					alt="tool output"
					loading="lazy"
				/>
			{:else if part.type === 'tool_reference'}
				<div class="tool-ref">→ tool <code>{part.tool_name}</code></div>
			{/if}
		{/each}
	{/if}
{/snippet}

{#snippet renderSubagent(sub: SubagentView, depth: number)}
	<details class="subagent" open style="--depth: {depth}">
		<summary class="subagent-summary">
			<span class="label">subagent</span>
			<span class="tool-name">{sub.agentType}</span>
			<span class="desc">{sub.description}</span>
			<span class="id">{sub.nodes.length} nodes</span>
		</summary>
		<div class="subagent-body">
			{#each sub.nodes as child (child.uuid + '-' + nodeKey(child))}
				{@render renderNode(child, depth)}
			{/each}
		</div>
	</details>
{/snippet}

<script lang="ts" module>
	import type { DisplayNode as DN } from '$lib/session/viewmodel';

	export function nodeKey(node: DN): string {
		switch (node.kind) {
			case 'tool-invocation':
				return `tu-${node.toolUseId}`;
			case 'assistant-text':
				return `at-${node.text.length}-${node.text.slice(0, 8)}`;
			case 'thinking':
				return `th-${node.text.length}`;
			default:
				return node.kind;
		}
	}

	export function toolBrief(name: string, input: Record<string, unknown>): string {
		const get = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : undefined);
		if (name === 'Read' || name === 'Edit' || name === 'Write' || name === 'NotebookEdit') {
			const p = get('file_path');
			return p ? trimPath(p) : '';
		}
		if (name === 'Bash') return (get('command') ?? '').slice(0, 60);
		if (name === 'Grep') return `"${get('pattern') ?? ''}"`;
		if (name === 'Glob') return get('pattern') ?? '';
		if (name === 'Agent') return get('description') ?? '';
		if (name.endsWith('run_ij_macro') || name.endsWith('run_script')) {
			const src = get('macro') ?? get('script') ?? '';
			return src.split('\n')[0].slice(0, 60);
		}
		const d = get('description') ?? get('query') ?? '';
		return d.slice(0, 60);
	}

	function trimPath(p: string): string {
		if (p.length <= 60) return p;
		const parts = p.split('/');
		return '…/' + parts.slice(-3).join('/');
	}
</script>

<style>
	/* ─── Page background (wallpaper) ────────────────────────── */
	.page-bg {
		position: fixed;
		inset: 0;
		z-index: -1;
		background:
			radial-gradient(ellipse 75% 60% at 10% 90%, rgba(233, 84, 32, 0.38) 0%, transparent 70%),
			radial-gradient(ellipse 50% 45% at 35% 80%, rgba(240, 120, 40, 0.2) 0%, transparent 55%),
			radial-gradient(ellipse 50% 60% at 30% 55%, rgba(180, 40, 100, 0.16) 0%, transparent 65%),
			radial-gradient(ellipse 60% 50% at 88% 12%, rgba(140, 60, 160, 0.2) 0%, transparent 60%),
			radial-gradient(ellipse 80% 30% at 65% 70%, rgba(240, 140, 40, 0.14) 0%, transparent 60%),
			radial-gradient(ellipse 45% 55% at 80% 85%, rgba(100, 40, 120, 0.14) 0%, transparent 55%),
			radial-gradient(ellipse 55% 50% at 85% 10%, rgba(233, 84, 32, 0.28) 0%, transparent 60%),
			radial-gradient(ellipse 90% 70% at 50% 50%, rgba(60, 15, 42, 0.6) 0%, transparent 70%),
			linear-gradient(
				150deg,
				#2c001e 0%,
				#380a28 20%,
				#42122e 40%,
				#3a0e26 60%,
				#30051f 80%,
				#2c001e 100%
			);
		filter: blur(40px) saturate(1.35);
	}

	/* Height of the site Nav component (fixed at top of viewport).
	   Keep in sync with src/lib/components/Nav.svelte: 56px desktop, 52px mobile. */
	:global(:root) {
		--log-nav-h: 56px;
	}
	@media (max-width: 720px) {
		:global(:root) {
			--log-nav-h: 52px;
		}
	}

	.page {
		max-width: 1040px;
		margin: 0 auto;
		/* Top padding clears the fixed Nav; extra 0.5rem breathing room. */
		padding: calc(var(--log-nav-h) + 0.5rem) 1.25rem 6rem;
		color: var(--text-primary);
		font-family: var(--font-body);
	}

	/* ─── Sticky settings panel ──────────────────────────────── */
	.settings-panel {
		position: sticky;
		/* Sit right under the fixed Nav. */
		top: var(--log-nav-h);
		z-index: 5;
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		background: rgba(24, 12, 20, 0.75);
		backdrop-filter: blur(18px);
		padding: 0.8rem 1.1rem;
		margin-bottom: 1rem;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
	}
	.panel-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.title-block .breadcrumb {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.title-block h1 {
		margin: 0.1rem 0 0;
		font-size: 1.3rem;
		color: var(--orange-300);
		font-weight: 500;
	}
	.stats-line {
		display: flex;
		gap: 0.55rem;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--text-secondary);
		flex-wrap: wrap;
		align-items: center;
	}
	.stats-line strong {
		color: var(--text-primary);
		font-weight: 600;
	}
	.stats-line .sess-id {
		color: var(--text-tertiary);
	}
	.stats-line .sep {
		color: var(--text-tertiary);
		margin: 0 -0.25rem;
	}
	.curate-link {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--orange-300);
		text-decoration: none;
		padding: 0.15rem 0.5rem;
		border-radius: 4px;
		border: 1px solid rgba(233, 84, 32, 0.3);
		transition: all 0.15s ease;
	}
	.curate-link:hover {
		background: rgba(233, 84, 32, 0.12);
		border-color: var(--orange-400);
	}

	.panel-controls {
		display: flex;
		gap: 2rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 0.8rem;
	}

	/* ─── Detail slider ──────────────────────────────────────── */
	.detail-slider {
		position: relative;
		display: flex;
		flex: 1;
		min-width: 280px;
		max-width: 520px;
		padding: 0.2rem 0.75rem 0.1rem;
	}
	/* base track */
	.detail-slider::before {
		content: '';
		position: absolute;
		top: calc(0.2rem + 4px);
		left: calc(0.75rem + 12.5%);
		right: calc(0.75rem + 12.5%);
		height: 2px;
		background: var(--border-subtle);
		z-index: 0;
		border-radius: 1px;
	}
	/* filled portion */
	.detail-slider::after {
		content: '';
		position: absolute;
		top: calc(0.2rem + 4px);
		left: calc(0.75rem + 12.5%);
		width: calc((var(--level, 0) / 3) * (100% - 1.5rem - 25%));
		height: 2px;
		background: var(--accent);
		z-index: 0;
		border-radius: 1px;
		transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.step {
		background: transparent;
		border: none;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
		cursor: pointer;
		flex: 1;
		padding: 0.1rem 0;
		min-width: 0;
	}
	.tick {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--bg-secondary);
		border: 2px solid var(--border-subtle);
		position: relative;
		z-index: 1;
		transition: all 0.2s;
	}
	.step:hover .tick {
		border-color: var(--orange-400);
	}
	.step.passed .tick,
	.step.active .tick {
		background: var(--accent);
		border-color: var(--accent);
	}
	.step.active .tick {
		box-shadow: 0 0 0 3px var(--accent-soft);
		transform: scale(1.15);
	}
	.step .label {
		font-size: 0.65rem;
		color: var(--text-tertiary);
		text-transform: lowercase;
		font-family: var(--font-mono);
		letter-spacing: 0.02em;
		transition: color 0.15s;
	}
	.step:hover .label {
		color: var(--text-primary);
	}
	.step.active .label {
		color: var(--orange-300);
		font-weight: 600;
	}

	/* ─── Hide toggles (pill buttons — filled = currently hiding) ─ */
	.hides {
		display: flex;
		gap: 0.35rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.hides-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.12em;
		margin-right: 0.2rem;
	}
	.hide-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.22rem 0.6rem;
		background: transparent;
		border: 1px solid var(--border-subtle);
		border-radius: 999px;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}
	.hide-pill:hover {
		border-color: var(--orange-400);
		color: var(--text-primary);
	}
	.hide-pill .pill-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: transparent;
		border: 1.5px solid currentColor;
		flex-shrink: 0;
		transition:
			background 0.15s,
			border-color 0.15s,
			box-shadow 0.15s;
	}
	.hide-pill.active {
		background: var(--accent-soft);
		border-color: var(--orange-500);
		color: var(--orange-300);
	}
	.hide-pill.active .pill-dot {
		background: var(--accent);
		border-color: var(--accent);
		box-shadow: 0 0 4px rgba(233, 84, 32, 0.55);
	}

	/* ─── Terminal container + rounds (unchanged from prior) ─── */
	.terminal {
		border: 1px solid rgba(0, 0, 0, 0.55);
		border-radius: 12px;
		background: #120810;
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.45),
			inset 0 0 0 1px rgba(255, 255, 255, 0.03);
		padding: 0 0 1rem;
		overflow: hidden;
	}
	.terminal-bar {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.55rem 0.9rem;
		background: rgba(0, 0, 0, 0.3);
		border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	}
	.terminal-bar-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 6px rgba(233, 84, 32, 0.6);
	}
	.terminal-bar-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--text-tertiary);
		letter-spacing: 0.04em;
	}
	.preamble {
		padding: 0.8rem 1rem 0;
	}
	.section-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 0.4rem;
	}
	.orphans-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--orange-300);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 1rem 1rem 0.35rem;
		margin-top: 0.5rem;
		border-top: 1px dashed var(--border-subtle);
	}

	/* ─── Round window ───────────────────────────────────────── */
	.round-window {
		margin: 1rem 1rem 0;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 8px;
		background: var(--bg-surface);
		overflow: hidden;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
		/* Anchor-click should land the round just below the sticky settings
		   panel, which sits below the fixed Nav. Nav 56px + panel ~170px. */
		scroll-margin-top: calc(var(--log-nav-h) + 11rem);
	}
	.round-window.injection :global(.window-header) {
		opacity: 0.75;
	}
	.round-window.slash :global(.window-header) {
		opacity: 0.7;
	}
	.round-window.meta :global(.window-header) {
		opacity: 0.55;
	}
	.round-window.injection {
		background: rgba(28, 16, 23, 0.55);
	}

	/* ─── Collapsible prompt for injected/system-generated content ─ */
	.injected-prompt {
		margin: 0 0 0.3rem;
		border: 1px dashed var(--border-subtle);
		border-radius: 5px;
		background: rgba(0, 0, 0, 0.22);
		font-family: var(--font-mono);
	}
	.injected-prompt > summary {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
		font-size: 0.72rem;
		color: var(--text-secondary);
		list-style: none;
	}
	.injected-prompt > summary::-webkit-details-marker {
		display: none;
	}
	.injected-prompt > summary::before {
		content: '▸';
		font-size: 0.7rem;
		color: var(--text-tertiary);
		transition: transform 0.15s;
		display: inline-block;
	}
	.injected-prompt[open] > summary::before {
		transform: rotate(90deg);
	}
	.injected-prompt .kind-tag {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.64rem;
		color: var(--orange-300);
	}
	.injected-prompt .kind-meta {
		color: var(--text-tertiary);
		font-size: 0.66rem;
		margin-left: auto;
	}
	.injected-prompt .prompt-text {
		margin: 0;
		padding: 0.55rem 0.75rem;
		background: transparent;
		border-left: 3px solid var(--aubergine-400);
		border-radius: 0 4px 4px 0;
		border-top: 1px dashed var(--border-subtle);
		font-size: 0.76rem;
		color: var(--text-secondary);
		max-height: 28rem;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.round-window.minimized {
		box-shadow: none;
	}
	.orphan-window {
		border-color: rgba(233, 84, 32, 0.3);
	}
	.round-body {
		padding: 0.85rem 1rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.prompt-text {
		margin: 0 0 0.3rem;
		padding: 0.55rem 0.75rem;
		background: rgba(233, 84, 32, 0.05);
		border-left: 3px solid var(--orange-500);
		border-radius: 0 4px 4px 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-family: var(--font-mono);
		font-size: 0.82rem;
		color: var(--text-primary);
		line-height: 1.5;
	}

	/* ─── Nodes ──────────────────────────────────────────────── */
	.node {
		border-radius: 5px;
		padding: 0.5rem 0.7rem;
		background: rgba(0, 0, 0, 0.2);
		border: 1px solid var(--border-color);
		font-family: var(--font-mono);
		font-size: 0.78rem;
		margin-left: calc(var(--depth, 0) * 1.3rem);
	}
	.node pre {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--text-primary);
		line-height: 1.45;
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		margin-bottom: 0.3rem;
		font-size: 0.68rem;
	}
	.label {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-tertiary);
	}
	.tool-name {
		color: var(--orange-300);
		font-weight: 500;
	}
	.id {
		font-size: 0.64rem;
		color: var(--text-tertiary);
		margin-left: auto;
	}
	.desc {
		color: var(--text-secondary);
	}
	.user-text {
		border-left: 3px solid var(--mauve);
		display: flex;
		gap: 0.5rem;
	}
	.user-text .gutter {
		color: var(--mauve);
	}
	.assistant-text {
		border-left: 3px solid var(--teal);
	}
	.assistant-text.final {
		border-left-width: 4px;
		background: rgba(112, 200, 184, 0.06);
	}
	.assistant-text.final .label {
		color: var(--teal);
	}

	.thinking {
		border-left: 3px solid var(--aubergine-400);
		background: rgba(122, 69, 104, 0.1);
	}
	.thinking summary {
		cursor: pointer;
		color: var(--text-secondary);
		font-size: 0.74rem;
	}
	.thinking pre {
		margin-top: 0.45rem;
		color: var(--text-secondary);
		font-size: 0.74rem;
	}
	.thinking-marker {
		padding: 0.2rem 0.65rem;
		background: transparent;
		border: none;
		border-left: 3px solid var(--aubergine-400);
		color: var(--text-tertiary);
		font-size: 0.7rem;
		font-style: italic;
		letter-spacing: 0.02em;
		cursor: help;
	}

	/* ─── Tool invocation ───────────────────────────────────── */
	.tool {
		border-left: 3px solid var(--peach);
		padding: 0;
		overflow: hidden;
	}
	.tool.error {
		border-left-color: var(--red);
	}
	.tool-summary {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		padding: 0.45rem 0.75rem;
		cursor: pointer;
		font-size: 0.76rem;
	}
	.tool[open] .tool-summary {
		border-bottom: 1px dashed var(--border-subtle);
	}
	.status {
		color: var(--peach);
		font-size: 0.7rem;
		width: 0.9rem;
		text-align: center;
	}
	.tool.error .status {
		color: var(--red);
	}
	.tool-brief {
		color: var(--text-secondary);
		font-size: 0.72rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	.subagent-badge {
		font-size: 0.66rem;
		color: var(--orange-300);
		background: var(--accent-soft);
		padding: 0.08rem 0.35rem;
		border-radius: 3px;
	}
	.tool-body {
		padding: 0.5rem 0.75rem 0.6rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.pane .pane-label {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-bottom: 0.25rem;
	}
	.pane.err .pane-label {
		color: var(--red);
	}
	.pane pre,
	.code {
		background: rgba(0, 0, 0, 0.35);
		padding: 0.4rem 0.55rem;
		border-radius: 4px;
		font-size: 0.73rem;
		margin: 0;
		max-height: 20rem;
		overflow: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.tool-image {
		max-width: 100%;
		border-radius: 4px;
	}
	.tool-ref {
		font-size: 0.73rem;
		color: var(--text-secondary);
	}

	.compact {
		text-align: center;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.68rem;
		padding: 0.4rem 0;
		border: none;
		background: transparent;
	}
	.compact span {
		display: inline-block;
		padding: 0.3rem 0.75rem 0;
		border-top: 1px dashed var(--border-subtle);
	}

	/* ─── Subagent (nested) ──────────────────────────────────── */
	.subagent {
		margin-top: 0.4rem;
		margin-left: calc(var(--depth, 0) * 1.3rem);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.25);
	}
	.subagent-summary {
		display: flex;
		gap: 0.45rem;
		align-items: baseline;
		padding: 0.35rem 0.6rem;
		cursor: pointer;
		font-size: 0.72rem;
	}
	.subagent-summary .label {
		color: var(--orange-300);
	}
	.subagent[open] .subagent-summary {
		border-bottom: 1px dashed var(--border-subtle);
	}
	.subagent-body {
		padding: 0.45rem 0.55rem 0.55rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	/* ─── Bottom round toolbar ───────────────────────────────── */
	.round-toolbar {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 10;
		background: rgba(20, 10, 18, 0.88);
		backdrop-filter: blur(18px);
		border-top: 1px solid var(--border-subtle);
		padding: 0.5rem 0.8rem;
		display: flex;
		gap: 0.45rem;
		align-items: center;
		box-shadow: 0 -4px 18px rgba(0, 0, 0, 0.35);
	}
	.tb-btn {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		padding: 0.25rem 0.55rem;
		color: var(--text-secondary);
		cursor: pointer;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		flex-shrink: 0;
		line-height: 1;
	}
	.tb-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
		border-color: var(--orange-500);
	}
	.tb-strip {
		display: flex;
		gap: 0.25rem;
		flex: 1;
		overflow-x: auto;
		scroll-behavior: smooth;
		scrollbar-width: none;
		padding: 0.1rem 0;
	}
	.tb-strip::-webkit-scrollbar {
		display: none;
	}
	.tb-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.5rem;
		background: var(--bg-hover);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 4px;
		text-decoration: none;
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--text-secondary);
		flex-shrink: 0;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}
	.tb-chip .dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--text-tertiary);
		transition: background 0.15s, box-shadow 0.15s;
	}
	.tb-chip:hover {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}
	.tb-chip.active {
		background: var(--accent-soft);
		border-color: var(--orange-500);
		color: var(--orange-300);
	}
	.tb-chip.active .dot {
		background: var(--accent);
		box-shadow: 0 0 5px rgba(233, 84, 32, 0.7);
	}
	.tb-chip.injection {
		opacity: 0.75;
	}
	.tb-chip.slash {
		opacity: 0.7;
	}
	.tb-chip.meta {
		opacity: 0.5;
	}
	.tb-indicator {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--text-tertiary);
		flex-shrink: 0;
		padding: 0 0.4rem 0 0.6rem;
		border-left: 1px solid var(--border-subtle);
		min-width: 4.5rem;
		text-align: right;
	}
</style>
