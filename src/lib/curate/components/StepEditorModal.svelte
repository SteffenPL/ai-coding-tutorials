<script lang="ts">
	import type { TraceStep } from '$lib/trace/types';
	import type { Step, WindowStep } from '$lib/data/tutorials';
	import { getWindowIcon } from '$lib/data/tutorials';
	import { traceStepToTutorialStep } from '$lib/trace/convert';
	import { rewriteContent } from '$lib/compose/resolve';
	import { stepLabel } from './step-helpers';
	import StepRenderer from '$lib/components/tutorial/StepRenderer.svelte';
	import WindowChrome from '$lib/components/windows/WindowChrome.svelte';
	import WindowContent from '$lib/components/windows/WindowContent.svelte';
	import AssetPickerDialog from '$lib/components/AssetPickerDialog.svelte';

	let {
		editStep,
		editingStep,
		slug,
		onClose,
		onFileUpload
	}: {
		editStep: TraceStep;
		editingStep: { roundId: string; stepId: string };
		slug: string;
		onClose: () => void;
		onFileUpload: (event: Event, roundId: string, stepId: string) => void;
	} = $props();

	let showAssetPicker = $state(false);

	let previewTick = $state(0);
	function bumpPreview() { previewTick++; }

	function handleAssetPicked(ref: string) {
		showAssetPicker = false;
		if (editStep.inserted && editStep.inserted.type === 'window' && 'src' in editStep.inserted.content) {
			(editStep.inserted.content as { src: string }).src = ref;
		} else if (editStep.overrides) {
			const content = editStep.overrides.content as Record<string, unknown> | undefined;
			if (content && 'src' in content) content.src = ref;
		}
		bumpPreview();
	}

	let previewStep = $derived.by(() => {
		void previewTick;
		const step = traceStepToTutorialStep(editStep);
		if (step && step.type === 'window') {
			return { ...step, content: rewriteContent(slug, step.content) };
		}
		return step;
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			onClose();
		}
	}

	function parseQuestionHtml(html: string): { prompt: string; options: string[] } {
		const olMatch = html.match(/([\s\S]*?)<ol[^>]*>([\s\S]*?)<\/ol>/i);
		if (!olMatch) return { prompt: html.replace(/<[^>]*>/g, '').trim(), options: [] };
		const prompt = olMatch[1].replace(/<[^>]*>/g, '').trim();
		const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
		const options: string[] = [];
		let match;
		while ((match = liRegex.exec(olMatch[2])) !== null) {
			options.push(match[1].replace(/<[^>]*>/g, '').trim());
		}
		return { prompt, options };
	}

	function rebuildQuestionHtml(prompt: string, options: string[]): string {
		if (options.length === 0) return `<p>${prompt}</p>`;
		const lis = options.map(o => `\n  <li>${o}</li>`).join('');
		return `<p>${prompt}</p>\n<ol>${lis}\n</ol>`;
	}

	function noopFocus(_step: WindowStep) {}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="modal-backdrop" onclick={onClose}>
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-container" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<h3>Edit: {stepLabel(editStep)}</h3>
			<div class="modal-header-controls">
				<div class="display-mode-toggle">
					<button
						class="mode-btn"
						class:active={editStep.displayMode === 'full'}
						onclick={() => { editStep.displayMode = 'full'; bumpPreview(); }}
					>Full</button>
					<button
						class="mode-btn"
						class:active={editStep.displayMode === 'normal'}
						onclick={() => { editStep.displayMode = 'normal'; bumpPreview(); }}
					>Normal</button>
					<button
						class="mode-btn"
						class:active={editStep.displayMode === 'compact'}
						onclick={() => { editStep.displayMode = 'compact'; bumpPreview(); }}
					>Compact</button>
				</div>
				<button
					class="mode-btn"
					class:active={editStep.hidden}
					onclick={() => { editStep.hidden = !editStep.hidden; bumpPreview(); }}
				>{editStep.hidden ? 'Hidden' : 'Visible'}</button>
				<button class="btn-close" onclick={onClose}>&times;</button>
			</div>
		</div>

		<div class="modal-body">
			<!-- Left: Edit Fields -->
			<div class="edit-pane">
				{#if editStep.inserted}
					{@render editInsertedStep(editStep)}
				{:else}
					{@render editSourceStep(editStep)}
				{/if}

				<label class="field">
					<span class="field-label">Comment (EN)</span>
					<textarea
						rows="3"
						value={typeof editStep.comment === 'string'
							? editStep.comment
							: editStep.comment?.en ?? ''}
						oninput={(e) => {
							const val = (e.target as HTMLTextAreaElement).value;
							if (!val) {
								editStep.comment = undefined;
							} else {
								const ja = typeof editStep.comment === 'object' ? editStep.comment?.ja : undefined;
								editStep.comment = ja ? { en: val, ja } : val;
							}
							bumpPreview();
						}}
					></textarea>
				</label>
				<label class="field">
					<span class="field-label">Comment (JA) <span class="optional-tag">optional</span></span>
					<textarea
						rows="3"
						value={typeof editStep.comment === 'object'
							? editStep.comment?.ja ?? ''
							: ''}
						oninput={(e) => {
							const ja = (e.target as HTMLTextAreaElement).value;
							const en = typeof editStep.comment === 'string'
								? editStep.comment
								: (typeof editStep.comment === 'object' ? editStep.comment?.en : '') ?? '';
							if (!en && !ja) {
								editStep.comment = undefined;
							} else if (ja) {
								editStep.comment = { en, ja };
							} else {
								editStep.comment = en || undefined;
							}
							bumpPreview();
						}}
					></textarea>
				</label>
			</div>

			<!-- Right: Live Preview -->
			<div class="preview-pane">
				<div class="preview-label">Preview</div>
				<div class="preview-content">
					{#if previewStep}
						{#key previewTick}
							<StepRenderer
								step={previewStep}
								showClaudeLabel={previewStep.type === 'assistant'}
								isLast={false}
								onFocusWindow={noopFocus}
							/>
							{#if previewStep.type === 'window' && !previewStep.compact}
								<div class="preview-window">
									<WindowChrome
										title={previewStep.windowTitle}
										subtitle={previewStep.subtitle}
										icon={previewStep.icon ?? getWindowIcon(previewStep.content)}
									/>
									<WindowContent content={previewStep.content} />
								</div>
							{/if}
						{/key}
					{:else}
						<div class="preview-empty">No preview available</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<AssetPickerDialog
	open={showAssetPicker}
	tutorialSlug={slug}
	selected={editStep.inserted?.type === 'window' && 'src' in editStep.inserted.content
		? (editStep.inserted.content as { src: string }).src
		: undefined}
	onselect={handleAssetPicked}
	onclose={() => (showAssetPicker = false)}
/>

{#snippet editSourceStep(step: TraceStep)}
	{@const o = step.overrides as Record<string, unknown>}
	{@const type = o?.type as string}

	{#if type === 'assistant'}
		<label class="field">
			<span class="field-label">HTML Content</span>
			<textarea
				rows="10"
				value={step.shortenedText ?? (o.html as string)}
				oninput={(e) => {
					step.shortenedText = (e.target as HTMLTextAreaElement).value;
					bumpPreview();
				}}
			></textarea>
		</label>
		<label class="field-check">
			<input
				type="checkbox"
				checked={o.final as boolean ?? false}
				onchange={(e) => {
					o.final = (e.target as HTMLInputElement).checked;
					bumpPreview();
				}}
			/>
			<span>Final answer</span>
		</label>
	{:else if type === 'thinking'}
		<label class="field">
			<span class="field-label">Thinking Text</span>
			<textarea
				rows="10"
				value={step.shortenedText ?? (o.text as string)}
				oninput={(e) => {
					step.shortenedText = (e.target as HTMLTextAreaElement).value;
					bumpPreview();
				}}
			></textarea>
		</label>
	{:else if type === 'tool_call'}
		<label class="field">
			<span class="field-label">Tool Name</span>
			<input
				type="text"
				value={o.toolName as string}
				oninput={(e) => {
					o.toolName = (e.target as HTMLInputElement).value;
					bumpPreview();
				}}
			/>
		</label>
		<label class="field">
			<span class="field-label">Code</span>
			<textarea
				rows="14"
				class="mono"
				value={step.shortenedText ?? (o.code as string)}
				oninput={(e) => {
					step.shortenedText = (e.target as HTMLTextAreaElement).value;
					bumpPreview();
				}}
			></textarea>
		</label>
	{:else if type === 'tool_result'}
		<label class="field">
			<span class="field-label">Result Text</span>
			<textarea
				rows="10"
				class="mono"
				value={step.shortenedText ?? (o.text as string)}
				oninput={(e) => {
					step.shortenedText = (e.target as HTMLTextAreaElement).value;
					bumpPreview();
				}}
			></textarea>
		</label>
	{:else if type === 'question'}
		{@const parsed = parseQuestionHtml(o.html as string)}
		<label class="field">
			<span class="field-label">Question Text</span>
			<input
				type="text"
				value={parsed.prompt}
				oninput={(e) => {
					const val = (e.target as HTMLInputElement).value;
					o.html = rebuildQuestionHtml(val, parsed.options);
					bumpPreview();
				}}
			/>
		</label>
		<div class="field">
			<span class="field-label">Options</span>
			{#each parsed.options as opt, i}
				<div class="question-option-row">
					<input
						type="radio"
						name="question-answer-source"
						checked={String(i + 1) === (o.answer as string)}
						onchange={() => { o.answer = String(i + 1); bumpPreview(); }}
					/>
					<input
						type="text"
						class="question-option-input"
						value={opt}
						oninput={(e) => {
							parsed.options[i] = (e.target as HTMLInputElement).value;
							o.html = rebuildQuestionHtml(parsed.prompt, parsed.options);
							bumpPreview();
						}}
					/>
					<button class="btn-sm btn-icon" onclick={() => {
						parsed.options.splice(i, 1);
						if (parseInt(o.answer as string) > parsed.options.length) o.answer = String(parsed.options.length);
						o.html = rebuildQuestionHtml(parsed.prompt, parsed.options);
						bumpPreview();
					}}>&times;</button>
				</div>
			{/each}
			<button class="btn-sm" onclick={() => {
				parsed.options.push('New option');
				o.html = rebuildQuestionHtml(parsed.prompt, parsed.options);
				bumpPreview();
			}}>+ Add option</button>
		</div>
	{:else if type === 'window'}
		<label class="field">
			<span class="field-label">Window Title</span>
			<input
				type="text"
				value={o.windowTitle as string}
				oninput={(e) => {
					o.windowTitle = (e.target as HTMLInputElement).value;
					bumpPreview();
				}}
			/>
		</label>
		{@const content = o.content as Record<string, unknown> | undefined}
		{#if content && ('src' in content)}
			<div class="field">
				<span class="field-label">Source file</span>
				<div class="file-upload-row">
					<span class="file-ref">{(content.src as string) || '(none)'}</span>
					<button
						class="btn-sm"
						onclick={() => (showAssetPicker = true)}
					>Select / Upload</button>
				</div>
			</div>
		{/if}
	{/if}

	<button
		class="btn-sm"
		onclick={() => {
			step.shortenedText = undefined;
			bumpPreview();
		}}
	>
		Reset to original
	</button>
{/snippet}

{#snippet editInsertedStep(step: TraceStep)}
	{@const ins = step.inserted!}

	{#if ins.type === 'assistant'}
		<label class="field">
			<span class="field-label">HTML</span>
			<textarea
				rows="10"
				bind:value={ins.html}
				oninput={bumpPreview}
			></textarea>
		</label>
		<label class="field-check">
			<input type="checkbox" bind:checked={ins.final} onchange={bumpPreview} />
			<span>Final answer</span>
		</label>
	{:else if ins.type === 'tool_call'}
		<label class="field">
			<span class="field-label">Tool Name</span>
			<input type="text" bind:value={ins.toolName} oninput={bumpPreview} />
		</label>
		<label class="field">
			<span class="field-label">Code</span>
			<textarea rows="14" class="mono" bind:value={ins.code} oninput={bumpPreview}></textarea>
		</label>
	{:else if ins.type === 'tool_result'}
		<label class="field">
			<span class="field-label">Text</span>
			<textarea rows="10" class="mono" bind:value={ins.text} oninput={bumpPreview}></textarea>
		</label>
	{:else if ins.type === 'output'}
		<label class="field">
			<span class="field-label">Terminal Output</span>
			<textarea rows="10" class="mono" bind:value={ins.text} oninput={bumpPreview}></textarea>
		</label>
	{:else if ins.type === 'status'}
		<label class="field">
			<span class="field-label">Status Text</span>
			<input type="text" bind:value={ins.text} oninput={bumpPreview} />
		</label>
		<label class="field">
			<span class="field-label">Variant</span>
			<select bind:value={ins.variant} onchange={bumpPreview}>
				<option value="success">success</option>
				<option value="info">info</option>
				<option value="warning">warning</option>
				<option value="error">error</option>
			</select>
		</label>
	{:else if ins.type === 'question'}
		{@const parsed = parseQuestionHtml(ins.html)}
		<label class="field">
			<span class="field-label">Question Text</span>
			<input
				type="text"
				value={parsed.prompt}
				oninput={(e) => {
					const val = (e.target as HTMLInputElement).value;
					ins.html = rebuildQuestionHtml(val, parsed.options);
					bumpPreview();
				}}
			/>
		</label>
		<div class="field">
			<span class="field-label">Options</span>
			{#each parsed.options as opt, i}
				<div class="question-option-row">
					<input
						type="radio"
						name="question-answer"
						checked={String(i + 1) === ins.answer}
						onchange={() => { ins.answer = String(i + 1); bumpPreview(); }}
					/>
					<input
						type="text"
						class="question-option-input"
						value={opt}
						oninput={(e) => {
							parsed.options[i] = (e.target as HTMLInputElement).value;
							ins.html = rebuildQuestionHtml(parsed.prompt, parsed.options);
							bumpPreview();
						}}
					/>
					<button class="btn-sm btn-icon" onclick={() => {
						parsed.options.splice(i, 1);
						if (parseInt(ins.answer) > parsed.options.length) ins.answer = String(parsed.options.length);
						ins.html = rebuildQuestionHtml(parsed.prompt, parsed.options);
						bumpPreview();
					}}>&times;</button>
				</div>
			{/each}
			<button class="btn-sm" onclick={() => {
				parsed.options.push('New option');
				ins.html = rebuildQuestionHtml(parsed.prompt, parsed.options);
				bumpPreview();
			}}>+ Add option</button>
		</div>
	{:else if ins.type === 'divider'}
		<label class="field">
			<span class="field-label">Label</span>
			<input type="text" bind:value={ins.label} oninput={bumpPreview} />
		</label>
	{:else if ins.type === 'window'}
		<label class="field">
			<span class="field-label">Window Title</span>
			<input type="text" bind:value={ins.windowTitle} oninput={bumpPreview} />
		</label>
		<label class="field">
			<span class="field-label">Subtitle</span>
			<input type="text" bind:value={ins.subtitle} oninput={bumpPreview} />
		</label>
		{#if ins.content.kind === 'fiji-image' || ins.content.kind === 'image' || ins.content.kind === 'video'}
			<div class="field">
				<span class="field-label">Source file</span>
				<div class="file-upload-row">
					<span class="file-ref">{'src' in ins.content ? ins.content.src || '(none)' : '(none)'}</span>
					<button
						class="btn-sm"
						onclick={() => (showAssetPicker = true)}
					>Select / Upload</button>
				</div>
			</div>
			{#if ins.content.kind === 'fiji-image'}
				<label class="field">
					<span class="field-label">Status Bar</span>
					<input
						type="text"
						bind:value={ins.content.statusBar}
						oninput={bumpPreview}
						placeholder="256x254 pixels; 8-bit"
					/>
				</label>
			{/if}
		{:else if ins.content.kind === 'markdown'}
			<label class="field">
				<span class="field-label">Markdown</span>
				<textarea rows="10" bind:value={ins.content.text} oninput={bumpPreview}></textarea>
			</label>
		{:else if ins.content.kind === 'source'}
			<label class="field">
				<span class="field-label">Source Code</span>
				<textarea rows="14" class="mono" bind:value={ins.content.text} oninput={bumpPreview}></textarea>
			</label>
			<label class="field">
				<span class="field-label">Language</span>
				<input type="text" bind:value={ins.content.language} oninput={bumpPreview} placeholder="python" />
			</label>
		{/if}
	{/if}
{/snippet}

<style>
	.modal-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		animation: fadeIn 0.15s ease-out;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.modal-container {
		width: 92vw;
		height: 88vh;
		max-width: 1400px;
		background: rgba(18, 8, 16, 0.98);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 12px;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
	}

	.modal-header h3 {
		font-size: 0.9rem;
		color: var(--orange-300);
		margin: 0;
		font-weight: 600;
	}

	.modal-header-controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.btn-close {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: 1.4rem;
		cursor: pointer;
		padding: 0.1rem 0.4rem;
		border-radius: 4px;
		line-height: 1;
	}

	.btn-close:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}

	.modal-body {
		flex: 1;
		display: flex;
		min-height: 0;
	}

	/* ─── Left: Edit Fields ── */
	.edit-pane {
		flex: 1;
		padding: 1.25rem;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		border-right: 1px solid rgba(255, 255, 255, 0.08);
	}

	/* ─── Right: Preview ── */
	.preview-pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.preview-label {
		padding: 0.5rem 1.25rem;
		font-family: var(--font-mono);
		font-size: 0.65rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-tertiary);
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		flex-shrink: 0;
	}

	.preview-content {
		flex: 1;
		padding: 1.25rem;
		overflow-y: auto;
		background: var(--bg-terminal);
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.65;
	}

	.preview-empty {
		color: var(--text-tertiary);
		font-style: italic;
		text-align: center;
		padding: 2rem;
	}

	.preview-window {
		margin-top: 12px;
		border: 1px solid var(--border-subtle);
		border-radius: 10px;
		overflow: hidden;
		background: var(--bg-secondary);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
	}

	.preview-window :global(img),
	.preview-window :global(video) {
		display: block;
		max-width: 100%;
		max-height: 40vh;
		image-rendering: pixelated;
		background: #000;
	}

	.preview-window :global(.source-body),
	.preview-window :global(.markdown-body),
	.preview-window :global(.folder-body) {
		max-height: 40vh;
	}

	/* ─── Form elements ── */
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field-label {
		font-family: var(--font-mono);
		font-size: 0.65rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.optional-tag {
		font-size: 0.55rem;
		color: var(--text-tertiary);
		opacity: 0.6;
		text-transform: lowercase;
		letter-spacing: 0;
		margin-left: 0.3rem;
	}

	.field input,
	.field textarea,
	.field select {
		padding: 0.45rem 0.6rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 5px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.8rem;
		resize: vertical;
	}

	.field input:focus,
	.field textarea:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	.field-check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.78rem;
		color: var(--text-secondary);
	}

	.field-check input {
		accent-color: var(--accent);
	}

	.mono {
		font-family: var(--font-mono) !important;
	}

	.file-upload-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.file-ref {
		flex: 1;
		padding: 0.45rem 0.6rem;
		background: rgba(0, 0, 0, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 5px;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	/* ─── Display mode toggle ── */
	.display-mode-toggle {
		display: flex;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 5px;
		overflow: hidden;
	}

	.mode-btn {
		padding: 0.3rem 0.7rem;
		background: transparent;
		border: none;
		border-right: 1px solid rgba(255, 255, 255, 0.12);
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.72rem;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.mode-btn:last-child {
		border-right: none;
	}

	.mode-btn:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.04);
	}

	.mode-btn.active {
		background: var(--accent-soft);
		color: var(--orange-300);
	}

	.btn-sm {
		padding: 0.3rem 0.6rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.7rem;
		cursor: pointer;
		align-self: flex-start;
	}

	.btn-sm:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}

	.question-option-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.35rem;
	}

	.question-option-row input[type="radio"] {
		accent-color: var(--accent);
		flex-shrink: 0;
	}

	.question-option-input {
		flex: 1;
		padding: 0.4rem 0.6rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 5px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.question-option-input:focus {
		outline: none;
		border-color: var(--orange-400);
	}

	.btn-icon {
		padding: 0.2rem 0.45rem;
		font-size: 1rem;
		line-height: 1;
	}
</style>
