<script lang="ts">
	import type { FijiMainContent } from '$lib/data/tutorials';
	import WindowChrome from './WindowChrome.svelte';

	let { content }: { content: FijiMainContent } = $props();

	const defaultLogLines = [
		'[fiji-mcp] Bridge started on port 8765',
		'[fiji-mcp] WebSocket server started on port 8765',
		'[fiji-mcp] Client connected: /[0:0:0:0:0:0:0:1]:502'
	];

	const logLines = $derived(content.logLines?.length ? content.logLines : defaultLogLines);
</script>

<div class="fiji-main-container">
	<!-- Fiji main window -->
	<div class="fiji-window">
		<WindowChrome title="(Fiji Is Just) ImageJ" icon="Fj" />
		<div class="fiji-toolbar">
			<div class="toolbar-icons">
				{#each ['□', '○', '⬠', '⌒', '∕', '△', '✛', '↰', 'A', '⌕', '✋', '⊘'] as icon}
					<span class="tool-icon">{icon}</span>
				{/each}
			</div>
			<div class="toolbar-extras">
				<span class="tool-label">Dev</span>
				<span class="tool-label">Stk</span>
				<span class="tool-label">LUT</span>
			</div>
		</div>
		<div class="fiji-statusbar">
			<span class="status-text">"More Tools" menu (switch toolsets or add tools)</span>
			<span class="search-box">Click here to search</span>
		</div>
	</div>

	<!-- Log sub-window, offset below -->
	<div class="log-window">
		<WindowChrome title="Log" />
		<div class="log-body">
			{#each logLines as line}
				<div class="log-line">{line}</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.fiji-main-container {
		position: relative;
		padding: 16px 16px 120px 16px;
		min-height: 300px;
	}

	/* ─── Fiji main window ─── */
	.fiji-window {
		background: var(--bg-secondary);
		border-radius: 8px;
		box-shadow: var(--card-shadow, 0 4px 20px rgba(0, 0, 0, 0.3));
		overflow: hidden;
		max-width: 520px;
		border: 1px solid var(--border-subtle);
	}

	.fiji-toolbar {
		display: flex;
		align-items: center;
		padding: 4px 8px;
		border-top: 1px solid var(--glass-faint);
		border-bottom: 1px solid var(--glass-faint);
		background: var(--bg-hover);
		gap: 8px;
	}

	.toolbar-icons {
		display: flex;
		gap: 2px;
	}

	.tool-icon {
		width: 28px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border-subtle);
		background: var(--glass-highlight);
		font-size: 14px;
		color: var(--text-tertiary);
		cursor: default;
	}

	.toolbar-extras {
		display: flex;
		gap: 2px;
		margin-left: auto;
	}

	.tool-label {
		padding: 2px 8px;
		border: 1px solid var(--border-subtle);
		background: var(--glass-highlight);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-tertiary);
		cursor: default;
		font-family: var(--font-display);
	}

	.fiji-statusbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4px 8px;
		background: var(--bg-secondary);
		font-size: 11px;
		color: var(--text-tertiary);
		font-family: var(--font-display);
	}

	.search-box {
		opacity: 0.6;
		font-style: italic;
	}

	/* ─── Log sub-window ─── */
	.log-window {
		position: absolute;
		left: 120px;
		bottom: 16px;
		width: min(500px, calc(100% - 40px));
		background: var(--bg-secondary);
		border-radius: 8px;
		box-shadow: var(--card-shadow, 0 6px 24px rgba(0, 0, 0, 0.25));
		overflow: hidden;
		border: 1px solid var(--border-subtle);
	}

	.log-body {
		padding: 12px 16px;
		min-height: 80px;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-primary);
		background: var(--bg-terminal);
	}

	.log-line {
		white-space: pre-wrap;
		word-break: break-all;
	}
</style>
