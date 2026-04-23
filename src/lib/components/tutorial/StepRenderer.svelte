<!--
	Renders a single tutorial step, dispatching on `step.type`.

	Pure presentational: all state (timeline position, maximize focus, labels)
	is passed in via props.

	Window steps have dual rendering:
	- Desktop: compact `window-marker` button (the actual window lives in the
	  right-column stack). Clicking maximizes via onFocusWindow.
	- Mobile (<=900px): full inline window with chrome (window-marker is
	  hidden; inline-fiji becomes visible via the mobile override).
-->
<script lang="ts">
	import type { Step, WindowStep } from '$lib/data/tutorials';
	import { getWindowIcon } from '$lib/data/tutorials';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import WindowContent from '$lib/components/windows/WindowContent.svelte';

	let {
		step,
		showClaudeLabel = false,
		isLast = false,
		onFocusWindow
	}: {
		step: Step;
		/** True for the first assistant message in a round (adds the "Claude" label) */
		showClaudeLabel?: boolean;
		/** True for the very last step in the full timeline (adds the blinking cursor) */
		isLast?: boolean;
		onFocusWindow: (step: WindowStep) => void;
	} = $props();

	function compactIcon(type: string): string {
		switch (type) {
			case 'assistant': return '○';
			case 'thinking': return '✧';
			case 'tool_call': return '⚡';
			case 'tool_result': return '←';
			case 'permission': return '⚿';
			case 'question': return '?';
			case 'output': return '$';
			case 'window': return '↗';
			case 'table': return '☷';
			case 'status': return '•';
			default: return '•';
		}
	}

	function compactSummary(s: Step): string {
		switch (s.type) {
			case 'assistant': return stripHtml(s.html).slice(0, 80) + (stripHtml(s.html).length > 80 ? '…' : '');
			case 'thinking': return 'Thinking' + (s.duration ? ` (${s.duration})` : '');
			case 'tool_call': return s.toolName;
			case 'tool_result': return s.text.slice(0, 60) + (s.text.length > 60 ? '…' : '');
			case 'permission': return `${s.tool} — ${s.granted ? 'allowed' : 'denied'}`;
			case 'question': return stripHtml(s.html).slice(0, 60) + '…';
			case 'output': return s.text.split('\n')[0].slice(0, 60) + '…';
			case 'window': return s.windowTitle;
			case 'table': return `Table: ${s.columns.join(', ')}`;
			case 'status': return s.text;
			case 'divider': return s.label;
			default: return '';
		}
	}

	function stripHtml(html: string): string {
		return html.replace(/<[^>]*>/g, '').trim();
	}
</script>

{#if step.compact}
	<div class="compact-step">
		<span class="compact-type">{compactIcon(step.type)}</span>
		<span class="compact-text">{compactSummary(step)}</span>
	</div>

{:else if step.type === 'assistant'}
	<div class="assistant-block" class:final={step.final}>
		{#if showClaudeLabel}
			<div class="assistant-label">Claude</div>
		{/if}
		<div class="assistant-text">
			{@html step.html}
		</div>
		{#if isLast}
			<span class="cursor"></span>
		{/if}
	</div>

{:else if step.type === 'thinking'}
	<div class="thinking-block">
		<details>
			<summary class="thinking-summary">
				<span class="thinking-icon">&#x2727;</span>
				Thinking{#if step.duration}<span class="thinking-duration">{step.duration}</span>{/if}
			</summary>
			<div class="thinking-text">{step.text}</div>
		</details>
	</div>

{:else if step.type === 'question'}
	<div class="question-block">
		<div class="question-text">{@html step.html}</div>
		<div class="question-answer">
			<span class="answer-chevron">&#8250;</span>
			<span class="answer-text">{step.answer}</span>
		</div>
	</div>

{:else if step.type === 'tool_call'}
	<div class="tool-call">
		<div class="tool-name">&#9889; {step.toolName}</div>
		<code>{step.code}</code>
	</div>

{:else if step.type === 'tool_result'}
	<div class="tool-result">
		{step.text}
	</div>

{:else if step.type === 'permission'}
	<div class="permission-block">
		<div class="permission-header">
			<span class="permission-tool">{step.tool}</span>
			<span class="permission-desc">{step.description}</span>
		</div>
		<div class="permission-response" class:granted={step.granted} class:denied={!step.granted}>
			{step.granted ? '\u2713 Allowed' : '\u2717 Denied'}
		</div>
	</div>

{:else if step.type === 'output'}
	<div class="output-block" class:stderr={step.stream === 'stderr'}>
		<pre>{step.text}</pre>
	</div>

{:else if step.type === 'status'}
	<div class="status-badge" class:success={step.variant === 'success'} class:info={step.variant === 'info'} class:warning={step.variant === 'warning'} class:error={step.variant === 'error'}>
		{step.text}
	</div>

{:else if step.type === 'window'}
	<!-- Desktop: compact marker in terminal; window itself lives in the right panel -->
	<button type="button" class="window-marker" onclick={() => onFocusWindow(step)} title="Maximize {step.windowTitle}">
		<span class="marker-icon" aria-hidden="true">&#8599;</span>
		<span class="marker-title">{step.windowTitle}</span>
		{#if step.subtitle}<span class="marker-sub">{step.subtitle}</span>{/if}
	</button>
	<!-- Mobile: full inline window -->
	<div class="inline-fiji">
		<WindowChrome
			title={step.windowTitle}
			subtitle={step.subtitle}
			icon={step.icon ?? getWindowIcon(step.content)}
			onMaximize={() => onFocusWindow(step)}
		/>
		<WindowContent content={step.content} />
	</div>

{:else if step.type === 'table'}
	<table class="results-table">
		<thead>
			<tr>
				{#each step.columns as col}
					<th>{col}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each step.rows as row}
				<tr>
					{#each row as cell}
						<td>{cell}</td>
					{/each}
				</tr>
			{/each}
			{#if step.moreRows}
				<tr>
					<td style="color:var(--text-tertiary)">&hellip;</td>
					<td colspan={step.columns.length - 1} style="color:var(--text-tertiary)">{step.moreRows} more rows</td>
				</tr>
			{/if}
		</tbody>
	</table>

{:else if step.type === 'divider'}
	<div class="step-divider">{step.label}</div>
{/if}

<style>
	/* ── Compact one-line summary ── */
	.compact-step {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 3px 14px;
		font-size: 11px;
		color: var(--text-tertiary);
		border-left: 2px solid var(--border-subtle);
		margin: 2px 0;
		opacity: 0.7;
	}

	.compact-type {
		flex-shrink: 0;
		width: 14px;
		text-align: center;
		font-size: 11px;
	}

	.compact-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Assistant messages (default: plain) ── */
	.assistant-block {
		margin: 12px 0;
		padding: 10px 14px;
		border-left: 3px solid transparent;
		border-radius: 0 6px 6px 0;
	}

	/* ── Final answer: highlighted with teal ── */
	.assistant-block.final {
		background: rgba(112, 200, 184, 0.14);
		border-left-color: var(--teal);
		border-left-width: 4px;
	}

	.assistant-label {
		color: var(--text-secondary);
		font-weight: 700;
		font-size: 11px;
		letter-spacing: 1px;
		text-transform: uppercase;
		margin-bottom: 8px;
	}

	.assistant-text {
		color: var(--text-secondary);
		line-height: 1.7;
	}

	.assistant-text :global(p) {
		margin-bottom: 10px;
	}

	.assistant-text :global(.inline-code) {
		background: rgba(255, 255, 255, 0.1);
		color: var(--text-primary);
		padding: 1px 5px;
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 0.9em;
	}

	/* ── Tool calls + results ── */
	.tool-call {
		border-left: 3px solid var(--peach);
		border-radius: 0;
		padding: 8px 14px;
		margin: 8px 0;
		font-size: 12px;
		transition: background 0.15s;
	}

	.tool-call:hover {
		background: rgba(232, 160, 112, 0.04);
	}

	.tool-name {
		color: var(--text-secondary);
		font-weight: 600;
		font-size: 10px;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		margin-bottom: 4px;
	}

	.tool-call code {
		display: block;
		color: var(--text-secondary);
		white-space: pre-wrap;
		word-break: break-all;
		font-size: 12px;
		line-height: 1.5;
	}

	.tool-result {
		border-left: 2px solid var(--border-subtle);
		border-radius: 0;
		padding: 6px 14px;
		margin: 4px 0 8px 0;
		font-size: 11px;
		color: var(--text-secondary);
		background: rgba(255, 255, 255, 0.015);
	}

	/* ── Thinking ── */
	.thinking-block {
		margin: 8px 0;
		border-left: 3px solid var(--mauve);
		border-radius: 0 6px 6px 0;
		background: rgba(122, 69, 104, 0.1);
	}

	.thinking-summary {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		font-size: 11px;
		font-weight: 600;
		color: var(--mauve);
		letter-spacing: 0.3px;
		cursor: pointer;
		user-select: none;
		list-style: none;
	}

	.thinking-summary::-webkit-details-marker { display: none; }

	.thinking-summary::after {
		content: '\25B6';
		font-size: 8px;
		margin-left: auto;
		transition: transform 0.2s;
		color: var(--text-tertiary);
	}

	details[open] > .thinking-summary::after {
		transform: rotate(90deg);
	}

	.thinking-icon {
		font-size: 13px;
	}

	.thinking-duration {
		font-weight: 400;
		font-size: 10px;
		color: var(--text-tertiary);
		margin-left: 4px;
	}

	.thinking-text {
		padding: 4px 14px 10px;
		font-size: 12px;
		line-height: 1.6;
		color: var(--text-tertiary);
		white-space: pre-wrap;
	}

	/* ── Question (Claude asks, user answers) ── */
	.question-block {
		margin: 12px 0;
	}

	.question-text {
		padding: 10px 14px;
		color: var(--text-secondary);
		line-height: 1.7;
		font-size: 13px;
	}

	.question-text :global(p) {
		margin-bottom: 10px;
	}

	.question-answer {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 8px 14px;
		background: rgba(233, 84, 32, 0.10);
		border-right: 2px solid var(--accent);
		border-radius: 4px 0 0 4px;
		margin: 4px 0;
	}

	.answer-chevron {
		color: var(--accent);
		font-weight: 700;
		font-size: 16px;
		line-height: 1.3;
		flex-shrink: 0;
	}

	.answer-text {
		color: var(--text-secondary);
		font-size: 12px;
		line-height: 1.5;
	}

	/* ── Permission request ── */
	.permission-block {
		margin: 8px 0;
		border: 1px solid rgba(233, 84, 32, 0.25);
		border-radius: 6px;
		padding: 8px 12px;
		background: rgba(233, 84, 32, 0.05);
	}

	.permission-header {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
	}

	.permission-tool {
		font-weight: 700;
		color: var(--orange-300);
		font-size: 10px;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		background: rgba(233, 84, 32, 0.15);
		padding: 1px 6px;
		border-radius: 3px;
	}

	.permission-desc {
		color: var(--text-secondary);
		font-size: 12px;
		word-break: break-all;
	}

	.permission-response {
		margin-top: 6px;
		font-size: 11px;
		font-weight: 600;
	}

	.permission-response.granted {
		color: var(--green);
	}

	.permission-response.denied {
		color: var(--red);
	}

	/* ── Terminal output ── */
	.output-block {
		margin: 4px 0;
		padding: 6px 14px;
		font-size: 12px;
	}

	.output-block pre {
		margin: 0;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.5;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.output-block.stderr pre {
		color: var(--red);
	}

	/* ── Status badge ── */
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 8px 0;
		padding: 4px 12px;
		font-size: 11px;
		font-weight: 500;
		border-radius: 12px;
		background: rgba(255, 255, 255, 0.04);
		color: var(--text-tertiary);
	}

	.status-badge.success { color: var(--green); background: rgba(112, 200, 184, 0.08); }
	.status-badge.info    { color: var(--mauve); background: rgba(180, 140, 200, 0.08); }
	.status-badge.warning { color: var(--orange-300); background: rgba(233, 84, 32, 0.08); }
	.status-badge.error   { color: var(--red); background: rgba(200, 60, 60, 0.10); }

	/* ── Table ── */
	.results-table {
		margin: 12px 0;
		border-collapse: collapse;
		font-size: 11px;
		width: 100%;
	}

	.results-table th {
		color: var(--orange-300);
		text-align: left;
		padding: 4px 10px 4px 0;
		border-bottom: 1px solid rgba(240, 160, 80, 0.2);
		font-weight: 500;
	}

	.results-table td {
		color: var(--text-tertiary);
		padding: 3px 10px 3px 0;
		font-variant-numeric: tabular-nums;
	}

	.results-table tr:nth-child(even) td {
		background: rgba(255, 255, 255, 0.015);
	}

	/* ── Divider ── */
	.step-divider {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 28px 0 20px 0;
		color: var(--text-tertiary);
		font-size: 11px;
		letter-spacing: 1px;
	}

	.step-divider::before,
	.step-divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--border-color), transparent);
	}

	/* ── Window marker (desktop) and inline-fiji (mobile) ── */
	.inline-fiji {
		display: none;
	}

	.window-marker {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 8px 0;
		padding: 8px 14px;
		background: none;
		border: none;
		border-left: 2px solid var(--border-subtle);
		border-radius: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--text-secondary);
		cursor: pointer;
		width: 100%;
		text-align: left;
		transition: background 0.15s, border-color 0.15s, color 0.15s;
	}

	.window-marker:hover {
		background: rgba(255, 255, 255, 0.03);
		border-left-color: var(--orange-300);
		color: var(--text-primary);
	}

	.marker-icon {
		color: var(--orange-300);
		font-size: 12px;
		font-weight: 700;
		flex-shrink: 0;
		line-height: 1;
	}

	.marker-title {
		font-weight: 600;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.marker-sub {
		color: var(--text-tertiary);
		font-size: 10px;
		margin-left: auto;
		white-space: nowrap;
	}

	/* ── Cursor ── */
	@keyframes cursorBlink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}

	.cursor {
		display: inline-block;
		width: 8px;
		height: 16px;
		background: var(--text-primary);
		animation: cursorBlink 1s steps(1) infinite;
		vertical-align: text-bottom;
		margin-left: 2px;
	}

	/* ── Mobile overrides ── */
	@media (max-width: 900px) {
		.tool-call { padding: 8px 10px; font-size: 11px; }
		.tool-call code { font-size: 11px; }
		.tool-result { padding: 6px 10px; font-size: 10px; }
		.results-table { font-size: 10px; }

		/* On mobile, hide the desktop marker — full inline window shown instead */
		.window-marker { display: none; }

		.inline-fiji {
			display: inline-flex;
			flex-direction: column;
			margin: 12px 0;
			max-width: 100%;
			border-radius: 10px;
			overflow: hidden;
			border: 1px solid var(--border-subtle);
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
			background: var(--bg-secondary);
		}

		.inline-fiji :global(img),
		.inline-fiji :global(video) {
			display: block;
			max-width: 100%;
			max-height: 30vh;
			max-height: 30dvh;
			image-rendering: pixelated;
			background: #000;
		}

		.inline-fiji :global(.source-body),
		.inline-fiji :global(.markdown-body),
		.inline-fiji :global(.folder-body) {
			max-height: 30vh;
			max-height: 30dvh;
		}
	}
</style>
