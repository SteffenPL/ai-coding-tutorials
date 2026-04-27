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
	import { getStepStyle, compactSummary } from './step-colors';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import WindowContent from '$lib/components/windows/WindowContent.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';

	const FOLD_LINES = 5;

	let {
		step,
		showClaudeLabel = false,
		isLast = false,
		onFocusWindow
	}: {
		step: Step;
		showClaudeLabel?: boolean;
		isLast?: boolean;
		onFocusWindow: (step: WindowStep) => void;
	} = $props();

	let codeExpanded = $state(false);
	let resultExpanded = $state(false);
	let assistantHtml = $state('');
	let questionPromptHtml = $state('');
	let questionOptions = $state<{ label: string; selected: boolean }[]>([]);

	$effect(() => {
		if (step.type !== 'assistant') return;
		let cancelled = false;
		(async () => {
			const rendered = await renderMessageMarkdown(step.html);
			if (!cancelled) assistantHtml = rendered;
		})();
		return () => { cancelled = true; };
	});

	$effect(() => {
		if (step.type !== 'question') return;
		let cancelled = false;
		(async () => {
			const parsed = parseQuestion(step.html, step.answer);
			const renderedPrompt = await renderMessageMarkdown(parsed.prompt);
			if (!cancelled) {
				questionPromptHtml = renderedPrompt;
				questionOptions = parsed.options;
			}
		})();
		return () => { cancelled = true; };
	});

	/* ── JSON-aware tool call/result parsing ── */

	type ParsedField = { key: string; value: string; isCode: boolean };
	type ParsedJson = { subtitle: string; fields: ParsedField[] } | null;

	function tryParseJson(raw: string): ParsedJson {
		const trimmed = raw.trim();
		if (!trimmed.startsWith('{')) return null;
		try {
			const obj = JSON.parse(trimmed);
			if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
			const keys = Object.keys(obj);
			if (keys.length === 0) return null;
			const subtitle = summarizeValue(keys[0], obj[keys[0]]);
			const fields: ParsedField[] = keys.map(k => {
				const v = obj[k];
				const str = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
				const isCode = typeof v === 'string' && (str.includes('\n') || str.length > 120);
				return { key: k, value: str, isCode };
			});
			return { subtitle, fields };
		} catch {
			return null;
		}
	}

	/* ── Question option parsing ── */

	function parseQuestion(html: string, answer: string): { prompt: string; options: { label: string; selected: boolean }[] } {
		const olMatch = html.match(/([\s\S]*?)<ol[^>]*>([\s\S]*?)<\/ol>/i);
		if (!olMatch) {
			return { prompt: html, options: [{ label: answer, selected: true }] };
		}
		const prompt = olMatch[1].trim();
		const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
		const options: { label: string; selected: boolean }[] = [];
		let match;
		let index = 1;
		while ((match = liRegex.exec(olMatch[2])) !== null) {
			const label = match[1].replace(/<[^>]*>/g, '').trim();
			options.push({ label, selected: String(index) === answer.trim() });
			index++;
		}
		if (options.length === 0) {
			return { prompt: html, options: [{ label: answer, selected: true }] };
		}
		return { prompt, options };
	}

	function summarizeValue(key: string, val: unknown): string {
		if (typeof val === 'string') {
			const short = val.replace(/\n/g, ' ').slice(0, 60);
			return `${key}: ${short}${val.length > 60 ? '…' : ''}`;
		}
		return key;
	}

	function shouldFold(text: string): boolean {
		return text.split('\n').length > FOLD_LINES;
	}

	function foldedPreview(text: string): { preview: string; hiddenCount: number } {
		const lines = text.split('\n');
		return { preview: lines.slice(0, FOLD_LINES).join('\n'), hiddenCount: lines.length - FOLD_LINES };
	}

	async function renderMessageMarkdown(text: string): Promise<string> {
		return renderMarkdown(text);
	}

	function tryParseJsonResult(raw: string): ParsedJson {
		const trimmed = raw.trim();
		if (!trimmed.startsWith('{')) return null;
		try {
			const obj = JSON.parse(trimmed);
			if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
			const keys = Object.keys(obj);
			if (keys.length === 0) return null;
			const subtitle = summarizeValue(keys[0], obj[keys[0]]);
			const fields: ParsedField[] = [];
			for (const k of keys) {
				const v = obj[k];
				if (v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
				const str = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
				const isCode = typeof v === 'string' && (str.includes('\n') || str.length > 120);
				fields.push({ key: k, value: str, isCode });
			}
			return { subtitle, fields };
		} catch {
			return null;
		}
	}
</script>

{#snippet codeBlock(text: string, expanded: boolean, toggle: () => void)}
	{#if shouldFold(text) && !expanded}
		{@const folded = foldedPreview(text)}
		<pre class="code-block">{folded.preview}</pre>
		<button type="button" class="fold-toggle" onclick={toggle}>
			▾ show {folded.hiddenCount} more lines
		</button>
	{:else}
		<pre class="code-block">{text}</pre>
		{#if shouldFold(text)}
			<button type="button" class="fold-toggle" onclick={toggle}>
				▴ collapse
			</button>
		{/if}
	{/if}
{/snippet}

{#if step.type === 'assistant'}
	<div class="assistant-block" class:final={step.final}>
		<span class="assistant-dot" class:final-dot={step.final}>●</span>
		<div class="assistant-content">
			<div class="assistant-text">
				{@html assistantHtml}
			</div>
			{#if isLast}
				<span class="cursor"></span>
			{/if}
		</div>
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
		<div class="question-text">{@html questionPromptHtml}</div>
		<div class="question-options">
			{#each questionOptions as opt}
				<div class="question-option" class:selected={opt.selected}>
					<span class="option-check">{opt.selected ? '[x]' : '[ ]'}</span>
					<span class="option-label">{opt.label}</span>
				</div>
			{/each}
		</div>
	</div>

{:else if step.type === 'tool_call'}
	{@const parsed = tryParseJson(step.code)}
	<div class="tool-call">
		<div class="tool-name">
			<span>&#9889; {step.toolName}</span>
			{#if parsed}<span class="tool-subtitle">{parsed.subtitle}</span>{/if}
		</div>
		{#if parsed}
			<div class="tool-fields">
				{#each parsed.fields as field}
					{#if field.isCode}
						<div class="tool-field">
							<span class="field-key">{field.key}</span>
							{@render codeBlock(field.value, codeExpanded, () => codeExpanded = !codeExpanded)}
						</div>
					{:else}
						<div class="tool-field-inline">
							<span class="field-key">{field.key}</span>
							<span class="field-value">{field.value}</span>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			{@render codeBlock(step.code, codeExpanded, () => codeExpanded = !codeExpanded)}
		{/if}
	</div>

{:else if step.type === 'tool_result'}
	{@const parsed = tryParseJsonResult(step.text)}
	<div class="tool-result">
		{#if parsed}
			<div class="tool-fields">
				{#each parsed.fields as field}
					{#if field.isCode}
						<div class="tool-field">
							<span class="field-key">{field.key}</span>
							{@render codeBlock(field.value, resultExpanded, () => resultExpanded = !resultExpanded)}
						</div>
					{:else}
						<div class="tool-field-inline">
							<span class="field-key">{field.key}</span>
							<span class="field-value">{field.value}</span>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<span class="result-text">{step.text}</span>
		{/if}
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
	{@const hasMarker = /^[✓✗✱✔✕⚠ℹ●◌•→←↻▸▾]/.test(step.text.trim())}
	<div class="status-badge" class:success={step.variant === 'success'} class:info={step.variant === 'info'} class:warning={step.variant === 'warning'} class:error={step.variant === 'error'}>
		{#if !hasMarker}<span class="status-marker">✱</span>{/if} {step.text}
	</div>

{:else if step.type === 'window'}
	{#if step.content.kind === 'window-collection'}
		<!-- Desktop: collapsible marker with sub-window list -->
		<details class="collection-marker">
			<summary class="window-marker" role="button">
				<span class="marker-icon" aria-hidden="true">⊞</span>
				<span class="marker-title">{step.windowTitle}</span>
				{#if step.subtitle}<span class="marker-sub">{step.subtitle}</span>{/if}
				<span class="marker-count">{step.content.windows.length}</span>
			</summary>
			<div class="collection-children">
				{#each step.content.windows as entry}
					<button type="button" class="window-marker window-marker--child" onclick={() => onFocusWindow(step)}>
						<span class="marker-icon" aria-hidden="true">&#8599;</span>
						<span class="marker-title">{entry.title}</span>
					</button>
				{/each}
			</div>
		</details>
	{:else}
		<!-- Desktop: compact marker in terminal; window itself lives in the right panel -->
		<button type="button" class="window-marker" onclick={() => onFocusWindow(step)} title="Maximize {step.windowTitle}">
			<span class="marker-icon" aria-hidden="true">&#8599;</span>
			<span class="marker-title">{step.windowTitle}</span>
			{#if step.subtitle}<span class="marker-sub">{step.subtitle}</span>{/if}
		</button>
	{/if}
	<!-- Mobile: full inline window -->
	{#if step.content.kind === 'window-collection'}
		<div class="inline-collection">
			<WindowContent content={step.content} />
		</div>
	{:else}
		<div class="inline-fiji">
			<WindowChrome
				title={step.windowTitle}
				subtitle={step.subtitle}
				icon={step.icon ?? getWindowIcon(step.content)}
				onMaximize={() => onFocusWindow(step)}
			/>
			<WindowContent content={step.content} />
		</div>
	{/if}

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
	/* ── Compact one-line summary (fallback for non-grouped compact steps) ── */
	.compact-step {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		font-size: 0.72rem;
		font-family: var(--font-mono);
		color: var(--chip-accent);
		background: color-mix(in srgb, var(--chip-accent) 8%, transparent);
		border: 1px solid color-mix(in srgb, var(--chip-accent) 20%, transparent);
		border-radius: 14px;
		margin: 2px 2px;
	}

	.compact-type {
		flex-shrink: 0;
		width: 14px;
		text-align: center;
		font-size: 0.75rem;
	}

	.compact-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 220px;
	}

	/* ── Assistant messages (default: plain) ── */
	.assistant-block {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin: 16px 0;
		padding: 0;
	}

	.assistant-dot {
		flex-shrink: 0;
		color: var(--text-tertiary);
		font-size: 10px;
		line-height: 1.95;
		user-select: none;
		width: 14px;
		text-align: center;
	}

	.assistant-dot.final-dot {
		color: var(--teal);
	}

	.assistant-content {
		flex: 1;
		min-width: 0;
	}

	/* ── Final answer: highlighted with teal ── */
	.assistant-block.final {
		padding: 10px 14px 10px 0;
		border-left: 3px solid var(--teal);
		padding-left: 10px;
		background: var(--step-teal-bg);
		border-radius: 0 4px 4px 0;
	}

	.assistant-block.final .assistant-dot {
		margin-left: -2px;
	}

	.assistant-text {
		color: var(--text-secondary);
		line-height: 1.7;
		font-size: 13px;
	}

	.assistant-text :global(p) {
		margin: 0 0 10px 0;
	}

	.assistant-text :global(p:last-child) {
		margin-bottom: 0;
	}

	.assistant-text :global(h1),
	.assistant-text :global(h2),
	.assistant-text :global(h3),
	.assistant-text :global(h4) {
		margin: 10px 0 4px 0;
		color: var(--orange-300);
		font-size: 13px;
		line-height: 1.4;
	}

	.assistant-text :global(strong) {
		color: var(--text-primary);
		font-weight: 600;
	}

	.assistant-text :global(em) {
		font-style: italic;
		color: var(--text-primary);
	}

	.assistant-text :global(code),
	.assistant-text :global(.inline-code) {
		background: var(--glass-ultra);
		color: var(--text-primary);
		padding: 2px 6px;
		border-radius: 4px;
		font-family: var(--font-mono);
		font-size: 0.85em;
		border: 1px solid var(--glass-highlight);
	}

	.assistant-text :global(.decorative-rule) {
		display: block;
		background: none;
		border: none;
		padding: 0;
		margin: 12px 0 4px 0;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--mauve);
		letter-spacing: 0.5px;
		opacity: 0.7;
	}

	.assistant-text :global(.md-heading) {
		display: block;
		font-weight: 700;
		color: var(--orange-300);
		font-size: 13px;
		margin: 10px 0 4px 0;
	}

	.assistant-text :global(ul),
	.assistant-text :global(ol) {
		margin: 6px 0 10px 0;
		padding-left: 20px;
	}

	.assistant-text :global(li) {
		margin-bottom: 4px;
	}

	.assistant-text :global(li::marker) {
		color: var(--text-tertiary);
	}

	.assistant-text :global(hr) {
		border: none;
		border-top: 1px solid var(--border-subtle);
		margin: 16px 0;
	}

	.assistant-text :global(a) {
		color: var(--orange-300);
		text-decoration: none;
	}

	.assistant-text :global(a:hover) {
		text-decoration: underline;
	}

	.assistant-text :global(pre) {
		background: var(--step-badge-bg);
		border: 1px solid var(--glass-highlight);
		border-radius: 6px;
		padding: 10px 14px;
		margin: 8px 0;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-primary);
		text-align: left;
	}

	.assistant-text :global(pre code),
	.assistant-text :global(pre .inline-code) {
		background: none;
		border: none;
		padding: 0;
		font-size: inherit;
		border-radius: 0;
	}

	.assistant-text :global(blockquote) {
		border-left: 3px solid var(--border-subtle);
		margin: 8px 0;
		padding: 4px 14px;
		color: var(--text-tertiary);
	}

	.assistant-text :global(table) {
		border-collapse: collapse;
		margin: 8px 0;
		font-size: 12px;
		width: 100%;
	}

	.assistant-text :global(th) {
		text-align: left;
		padding: 4px 10px;
		border-bottom: 1px solid var(--border-subtle);
		color: var(--text-primary);
		font-weight: 600;
		font-size: 11px;
	}

	.assistant-text :global(td) {
		padding: 3px 10px;
		color: var(--text-secondary);
		border-bottom: 1px solid var(--glass-divider);
	}

	/* ── Tool calls + results ── */
	.tool-call {
		border-left: 2px solid var(--peach);
		border-radius: 0;
		padding: 6px 14px;
		margin: 6px 0;
		margin-left: 4px;
		font-size: 12px;
		overflow: hidden;
		transition: background 0.15s;
	}

	.tool-call:hover {
		background: var(--step-tool-bg);
	}

	.tool-name {
		display: flex;
		align-items: baseline;
		gap: 8px;
		color: var(--text-secondary);
		font-weight: 600;
		font-size: 10px;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		margin-bottom: 4px;
	}

	.tool-subtitle {
		font-weight: 400;
		font-size: 11px;
		text-transform: none;
		letter-spacing: 0;
		color: var(--text-tertiary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.tool-fields {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.tool-field {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tool-field-inline {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}

	.field-key {
		flex-shrink: 0;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.3px;
	}

	.field-value {
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 12px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.code-block {
		margin: 0;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: break-word;
	}

	.fold-toggle {
		display: block;
		margin-top: 4px;
		padding: 2px 0;
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 11px;
		cursor: pointer;
		transition: color 0.15s;
	}

	.fold-toggle:hover {
		color: var(--orange-300);
	}

	.tool-result {
		border-left: 2px solid var(--border-subtle);
		border-radius: 0;
		padding: 6px 14px;
		margin: 2px 0 6px 4px;
		font-size: 11px;
		color: var(--text-secondary);
		overflow: hidden;
	}

	.tool-result .tool-fields { gap: 2px; }
	.tool-result .field-key { font-size: 9px; }
	.tool-result .field-value { font-size: 11px; }
	.tool-result .code-block { font-size: 11px; }

	.result-text {
		overflow-wrap: break-word;
	}

	/* ── Thinking ── */
	.thinking-block {
		margin: 6px 0;
		margin-left: 4px;
		border-left: 2px solid var(--mauve);
		border-radius: 0;
		background: var(--step-mauve-bg);
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
		padding: 10px 14px 4px;
		color: var(--text-secondary);
		line-height: 1.7;
		font-size: 13px;
	}

	.question-text :global(p) {
		margin-bottom: 6px;
	}

	.question-options {
		padding: 2px 14px 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.question-option {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 3px 8px;
		border-radius: 4px;
		font-size: 12.5px;
		color: var(--text-muted, #888);
		line-height: 1.5;
	}

	.question-option.selected {
		color: var(--text-secondary);
		background: var(--step-prompt-bg);
	}

	.option-check {
		font-family: 'JetBrains Mono', monospace;
		font-size: 12px;
		flex-shrink: 0;
		color: var(--text-muted, #888);
	}

	.question-option.selected .option-check {
		color: var(--accent);
	}

	.option-label {
		line-height: 1.5;
	}

	/* ── Permission request ── */
	.permission-block {
		margin: 6px 0;
		margin-left: 4px;
		border-left: 2px solid var(--orange-300);
		border-radius: 0;
		padding: 6px 12px;
		background: var(--step-prompt-answer);
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
		background: var(--step-prompt-glow);
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
		margin-left: 4px;
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
		gap: 4px;
		margin: 10px 0;
		padding: 0;
		font-size: 12px;
		font-weight: 400;
		font-family: var(--font-mono);
		color: var(--text-tertiary);
	}

	.status-marker {
		font-size: 11px;
	}

	.status-badge.success { color: var(--green); }
	.status-badge.info    { color: var(--mauve); }
	.status-badge.warning { color: var(--orange-300); }
	.status-badge.error   { color: var(--red); }

	/* ── Table ── */
	.results-table {
		margin: 12px 0;
		margin-left: 4px;
		border-collapse: collapse;
		font-size: 11px;
		width: calc(100% - 4px);
	}

	.results-table th {
		color: var(--orange-300);
		text-align: left;
		padding: 4px 10px 4px 0;
		border-bottom: 1px solid var(--step-prompt-border);
		font-weight: 500;
	}

	.results-table td {
		color: var(--text-tertiary);
		padding: 3px 10px 3px 0;
		font-variant-numeric: tabular-nums;
	}

	.results-table tr:nth-child(even) td {
		background: var(--step-question-bg);
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

	/* ── Window marker (desktop) and inline-fiji/collection (mobile) ── */
	.inline-fiji,
	.inline-collection {
		display: none;
	}

	.window-marker {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 6px 0 6px 4px;
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
		background: var(--step-table-bg);
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

	/* ── Multi-window marker ── */
	.collection-marker {
		margin: 6px 0 6px 4px;
	}

	.collection-marker > summary {
		list-style: none;
	}

	.collection-marker > summary::-webkit-details-marker {
		display: none;
	}

	.collection-marker > summary .marker-icon {
		transition: transform 0.2s ease;
	}

	.collection-marker[open] > summary .marker-icon {
		transform: rotate(90deg);
	}

	.marker-count {
		font-size: 10px;
		font-weight: 600;
		color: var(--orange-300);
		background: var(--accent-hover);
		padding: 1px 6px;
		border-radius: 8px;
		flex-shrink: 0;
	}

	.collection-children {
		padding-left: 16px;
		border-left: 1px solid var(--border-subtle);
		margin-left: 12px;
	}

	.window-marker--child {
		margin: 2px 0;
		padding: 4px 10px;
		font-size: 11px;
	}

	.window-marker--child .marker-title {
		font-weight: 500;
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
		.assistant-text :global(pre),
		.code-block { font-size: 10.5px; }
		.tool-call { padding: 8px 10px; font-size: 11px; }
		.tool-call .code-block { font-size: 10.5px; }
		.tool-result { padding: 6px 10px; font-size: 10px; }
		.results-table { font-size: 10px; }

		/* On mobile, hide the desktop marker — full inline window shown instead */
		.window-marker { display: none; }
		.collection-marker { display: none; }

		.inline-fiji {
			display: inline-flex;
			flex-direction: column;
			margin: 12px 0;
			max-width: 100%;
			border-radius: 10px;
			overflow: hidden;
			border: 1px solid var(--border-subtle);
			box-shadow: var(--shadow-md);
			background: var(--bg-secondary);
		}

		.inline-fiji :global(img),
		.inline-fiji :global(video) {
			display: block;
			width: 100%;
			height: auto;
			image-rendering: pixelated;
			background: #000;
		}

		.inline-fiji :global(.source-body),
		.inline-fiji :global(.markdown-body),
		.inline-fiji :global(.folder-body) {
			max-height: 30vh;
			max-height: 30dvh;
		}

		.inline-collection {
			display: block;
			margin: 12px 0;
			max-width: 100%;
		}
	}
</style>
