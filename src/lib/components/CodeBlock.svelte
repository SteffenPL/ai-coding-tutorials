<script lang="ts">
	import { t } from '$lib/stores/lang.svelte';

	interface Props {
		language: string;
		code: string;
	}

	let { language, code }: Props = $props();
	let copied = $state(false);

	function copyCode() {
		navigator.clipboard.writeText(code).then(() => {
			copied = true;
			setTimeout(() => (copied = false), 2000);
		});
	}
</script>

<div class="code-block">
	<div class="code-block__header">
		<span class="code-block__lang">{language}</span>
		<button class="code-block__copy" class:copied onclick={copyCode}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
				<rect x="9" y="9" width="13" height="13" rx="2" />
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
			</svg>
			{copied ? t({ en: 'Copied!', ja: 'コピー済み' }) : t({ en: 'Copy', ja: 'コピー' })}
		</button>
	</div>
	<pre><code>{code}</code></pre>
</div>

<style>
	.code-block {
		margin-bottom: 20px;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid var(--border-subtle);
		transition: border-color var(--transition-theme);
	}

	.code-block__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 16px;
		background: var(--code-header);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	}

	.code-block__lang {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		font-weight: 500;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.code-block__copy {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 500;
		color: var(--shark-tag-text);
		background: transparent;
		border: 1px solid var(--border-color);
		border-radius: 5px;
		padding: 3px 10px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.code-block__copy:hover {
		background: var(--shark);
		color: #ffffff;
		border-color: var(--shark);
	}

	.code-block__copy.copied {
		background: #2ea043;
		color: #ffffff;
		border-color: #2ea043;
	}

	.code-block__copy svg {
		width: 12px;
		height: 12px;
	}

	pre {
		padding: 16px;
		background: var(--code-bg);
		overflow-x: auto;
		transition: background var(--transition-theme);
	}

	pre code {
		font-family: var(--font-mono);
		font-size: 0.82rem;
		line-height: 1.65;
		color: var(--code-text);
		tab-size: 4;
	}

	@media (max-width: 640px) {
		pre {
			padding: 12px;
		}
		pre code {
			font-size: 0.76rem;
		}
	}
</style>
