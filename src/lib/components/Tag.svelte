<script lang="ts">
	interface Props {
		label: string;
	}

	let { label }: Props = $props();
</script>

<span class="tag">{label}</span>

<style>
	.tag {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		font-weight: 500;
		padding: 3px 10px;
		border-radius: 6px;
		background: var(--shark-tag-bg);
		border: 1px solid var(--shark-tag-border);
		color: var(--shark-tag-text);
		transition: all var(--transition-theme);
		white-space: nowrap;
	}
</style>
