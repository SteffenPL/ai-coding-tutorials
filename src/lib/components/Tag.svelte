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
		font-size: 0.65rem;
		font-weight: 500;
		color: var(--tag-text);
		background: var(--tag-bg);
		border: 1px solid var(--tag-border);
		padding: 2px 8px;
		border-radius: 4px;
		white-space: nowrap;
	}
</style>
