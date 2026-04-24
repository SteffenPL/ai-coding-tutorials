<script lang="ts">
	interface Props {
		accept?: string;
		multiple?: boolean;
		label?: string;
		sublabel?: string;
		disabled?: boolean;
		onfiles: (files: File[]) => void;
	}

	let { accept = '*', multiple = false, label = 'Drop files here', sublabel = 'or click to browse', disabled = false, onfiles }: Props = $props();

	let dragging = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();
	let dragCounter = 0;

	function matchesAccept(file: File): boolean {
		if (accept === '*') return true;
		return accept.split(',').some((pat) => {
			const p = pat.trim();
			if (p.startsWith('.')) return file.name.toLowerCase().endsWith(p.toLowerCase());
			if (p.endsWith('/*')) return file.type.startsWith(p.replace('/*', '/'));
			return file.type === p;
		});
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragCounter = 0;
		dragging = false;
		if (disabled) return;
		const files = Array.from(e.dataTransfer?.files ?? []).filter(matchesAccept);
		if (files.length > 0) onfiles(multiple ? files : [files[0]]);
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		dragCounter++;
		dragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		dragCounter--;
		if (dragCounter <= 0) {
			dragCounter = 0;
			dragging = false;
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleClick() {
		if (!disabled) inputEl?.click();
	}

	function handleInput(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		if (files.length > 0) onfiles(multiple ? files : [files[0]]);
		input.value = '';
	}
</script>

<button
	class="dropzone"
	class:dragging
	class:disabled
	type="button"
	ondrop={handleDrop}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondragover={handleDragOver}
	onclick={handleClick}
>
	<input
		bind:this={inputEl}
		type="file"
		{accept}
		{multiple}
		onchange={handleInput}
		hidden
	/>
	<span class="dropzone-icon">{dragging ? '⬇' : '+'}</span>
	<span class="dropzone-label">{label}</span>
	{#if sublabel}
		<span class="dropzone-sublabel">{sublabel}</span>
	{/if}
</button>

<style>
	.dropzone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.3rem;
		padding: 1.25rem 1rem;
		border: 2px dashed var(--border-subtle);
		border-radius: 8px;
		background: var(--overlay-dim);
		cursor: pointer;
		transition: border-color 0.2s, background 0.2s;
		width: 100%;
		font: inherit;
		color: inherit;
	}

	.dropzone:hover {
		border-color: var(--orange-400);
		background: var(--accent-muted);
	}

	.dropzone.dragging {
		border-color: var(--orange-400);
		background: var(--accent-soft);
		border-style: solid;
	}

	.dropzone.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dropzone-icon {
		font-size: 1.4rem;
		color: var(--text-tertiary);
		line-height: 1;
	}

	.dragging .dropzone-icon {
		color: var(--orange-400);
	}

	.dropzone-label {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.dropzone-sublabel {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
	}
</style>
