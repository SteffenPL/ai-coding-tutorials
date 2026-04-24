<script lang="ts">
	import DropZone from './DropZone.svelte';

	interface Props {
		open: boolean;
		tutorialSlug?: string;
		onclose: () => void;
		onuploaded?: (ref: string) => void;
	}

	let { open, tutorialSlug, onclose, onuploaded }: Props = $props();

	type Target = 'shared' | 'tutorial';
	let target: Target = $state('shared');
	let file: File | null = $state(null);
	let previewUrl: string | null = $state(null);
	let uploading = $state(false);
	let status = $state('');

	$effect(() => {
		if (open) {
			target = tutorialSlug ? 'tutorial' : 'shared';
			file = null;
			previewUrl = null;
			uploading = false;
			status = '';
		}
	});

	function handleFiles(files: File[]) {
		file = files[0];
		status = '';
		if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
			previewUrl = URL.createObjectURL(file);
		} else {
			previewUrl = null;
		}
	}

	async function upload() {
		if (!file) return;
		uploading = true;
		status = '';

		const formData = new FormData();
		formData.append('file', file);

		let url: string;
		if (target === 'shared' || !tutorialSlug) {
			url = '/api/assets/upload';
		} else {
			url = `/api/compose/${tutorialSlug}/upload`;
			formData.append('target', 'tutorial');
		}

		try {
			const res = await fetch(url, { method: 'POST', body: formData });
			const json = await res.json();
			if (json.ok) {
				status = `Uploaded: ${json.filename}`;
				if (previewUrl) URL.revokeObjectURL(previewUrl);
				onuploaded?.(json.filename);
				setTimeout(() => onclose(), 800);
			} else {
				status = `Error: ${json.message ?? 'Upload failed'}`;
			}
		} catch {
			status = 'Upload error';
		}
		uploading = false;
	}

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="backdrop" onclick={handleBackdrop} onkeydown={handleKeydown}>
		<div class="dialog" role="dialog" aria-label="Upload asset">
			<div class="dialog-header">
				<h3>Upload Asset</h3>
				<button class="close-btn" onclick={onclose}>x</button>
			</div>

			<div class="dialog-body">
				<!-- Target selector -->
				<fieldset class="target-selector">
					<legend>Destination</legend>
					<label class="target-option" class:selected={target === 'shared'}>
						<input type="radio" name="target" value="shared" bind:group={target} />
						<div class="target-info">
							<span class="target-label">Shared</span>
							<span class="target-desc">Available to all tutorials</span>
							<span class="target-path">static/assets/</span>
						</div>
					</label>
					{#if tutorialSlug}
						<label class="target-option" class:selected={target === 'tutorial'}>
							<input type="radio" name="target" value="tutorial" bind:group={target} />
							<div class="target-info">
								<span class="target-label">Tutorial: {tutorialSlug}</span>
								<span class="target-desc">Only for this tutorial</span>
								<span class="target-path">static/tutorials/{tutorialSlug}/assets/</span>
							</div>
						</label>
					{/if}
				</fieldset>

				<!-- Drop zone -->
				<DropZone
					accept="image/*,video/*"
					label={file ? file.name : 'Drop image or video here'}
					sublabel={file ? `${(file.size / 1024).toFixed(1)} KB` : 'or click to browse'}
					onfiles={handleFiles}
				/>

				<!-- Preview -->
				{#if previewUrl && file}
					<div class="preview">
						{#if file.type.startsWith('video/')}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video src={previewUrl} class="preview-media" muted loop autoplay></video>
						{:else}
							<img src={previewUrl} alt="Preview" class="preview-media" />
						{/if}
					</div>
				{/if}

				<!-- Actions -->
				<div class="dialog-actions">
					<button class="btn" onclick={onclose}>Cancel</button>
					<button class="btn btn-primary" onclick={upload} disabled={!file || uploading}>
						{uploading ? 'Uploading...' : 'Upload'}
					</button>
				</div>

				{#if status}
					<span class="status-msg" class:error={status.startsWith('Error')}>{status}</span>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--overlay-bg);
		backdrop-filter: blur(4px);
	}

	.dialog {
		width: 90%;
		max-width: 460px;
		background: var(--bg-dialog);
		border: 1px solid var(--border-subtle);
		border-radius: 12px;
		overflow: hidden;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		background: var(--overlay-subtle);
	}

	.dialog-header h3 {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.85rem;
		color: var(--orange-300);
		font-weight: 600;
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		cursor: pointer;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
	}

	.close-btn:hover {
		color: var(--text-primary);
		background: var(--glass-highlight);
	}

	.dialog-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
	}

	/* Target selector */
	.target-selector {
		border: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.target-selector legend {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-bottom: 0.3rem;
	}

	.target-option {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem 0.65rem;
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
		background: var(--overlay-dim);
	}

	.target-option:hover {
		border-color: var(--orange-400);
		background: var(--accent-muted);
	}

	.target-option.selected {
		border-color: var(--orange-400);
		background: var(--accent-soft);
	}

	.target-option input[type='radio'] {
		margin-top: 0.15rem;
		accent-color: var(--orange-500);
	}

	.target-info {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.target-label {
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--text-primary);
		font-weight: 500;
	}

	.target-desc {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-secondary);
	}

	.target-path {
		font-family: var(--font-mono);
		font-size: 0.58rem;
		color: var(--text-tertiary);
	}

	/* Preview */
	.preview {
		display: flex;
		justify-content: center;
		padding: 0.5rem;
		background: var(--overlay-subtle);
		border-radius: 6px;
	}

	.preview-media {
		max-width: 100%;
		max-height: 180px;
		border-radius: 4px;
		object-fit: contain;
	}

	/* Actions */
	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.35rem 0.75rem;
		background: var(--glass-highlight);
		border: 1px solid var(--border-subtle);
		border-radius: 6px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}

	.btn:hover {
		background: var(--glass-highlight-hover);
		border-color: var(--orange-400);
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--accent-soft);
		border-color: var(--orange-500);
		color: var(--orange-300);
	}

	.status-msg {
		font-family: var(--font-mono);
		font-size: 0.72rem;
		color: var(--teal);
		text-align: center;
	}

	.status-msg.error {
		color: var(--red);
	}
</style>
