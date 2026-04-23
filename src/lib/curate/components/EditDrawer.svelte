<script lang="ts">
	import type { TraceStep } from '$lib/trace/types';
	import { stepLabel } from './step-helpers';

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
</script>

{#snippet editSourceStep(step: TraceStep)}
	{@const o = step.overrides as Record<string, unknown>}
	{@const type = o?.type as string}

	{#if type === 'assistant'}
		<label class="drawer-field">
			<span>HTML Content</span>
			<textarea
				rows="6"
				value={step.shortenedText ?? (o.html as string)}
				oninput={(e) => {
					step.shortenedText = (e.target as HTMLTextAreaElement).value;
				}}
			></textarea>
		</label>
		<label class="drawer-check">
			<input
				type="checkbox"
				checked={o.final as boolean ?? false}
				onchange={(e) => {
					o.final = (e.target as HTMLInputElement).checked;
				}}
			/>
			<span>Final answer</span>
		</label>
	{:else if type === 'thinking'}
		<label class="drawer-field">
			<span>Thinking Text</span>
			<textarea
				rows="4"
				value={step.shortenedText ?? (o.text as string)}
				oninput={(e) => {
					step.shortenedText = (e.target as HTMLTextAreaElement).value;
				}}
			></textarea>
		</label>
	{:else if type === 'tool_call'}
		<label class="drawer-field">
			<span>Tool Name</span>
			<input
				type="text"
				value={o.toolName as string}
				oninput={(e) => {
					o.toolName = (e.target as HTMLInputElement).value;
				}}
			/>
		</label>
		<label class="drawer-field">
			<span>Code</span>
			<textarea
				rows="8"
				class="mono"
				value={step.shortenedText ?? (o.code as string)}
				oninput={(e) => {
					step.shortenedText = (e.target as HTMLTextAreaElement).value;
				}}
			></textarea>
		</label>
	{:else if type === 'tool_result'}
		<label class="drawer-field">
			<span>Result Text</span>
			<textarea
				rows="6"
				class="mono"
				value={step.shortenedText ?? (o.text as string)}
				oninput={(e) => {
					step.shortenedText = (e.target as HTMLTextAreaElement).value;
				}}
			></textarea>
		</label>
	{:else if type === 'window'}
		<label class="drawer-field">
			<span>Window Title</span>
			<input
				type="text"
				value={o.windowTitle as string}
				oninput={(e) => {
					o.windowTitle = (e.target as HTMLInputElement).value;
				}}
			/>
		</label>
	{/if}

	<button
		class="btn-sm"
		onclick={() => {
			step.shortenedText = undefined;
		}}
	>
		Reset to original
	</button>
{/snippet}

{#snippet editInsertedStep(step: TraceStep)}
	{@const ins = step.inserted!}

	{#if ins.type === 'assistant'}
		<label class="drawer-field">
			<span>HTML</span>
			<textarea
				rows="6"
				bind:value={ins.html}
			></textarea>
		</label>
		<label class="drawer-check">
			<input type="checkbox" bind:checked={ins.final} />
			<span>Final answer</span>
		</label>
	{:else if ins.type === 'tool_call'}
		<label class="drawer-field">
			<span>Tool Name</span>
			<input type="text" bind:value={ins.toolName} />
		</label>
		<label class="drawer-field">
			<span>Code</span>
			<textarea rows="8" class="mono" bind:value={ins.code}></textarea>
		</label>
	{:else if ins.type === 'tool_result'}
		<label class="drawer-field">
			<span>Text</span>
			<textarea rows="6" class="mono" bind:value={ins.text}></textarea>
		</label>
	{:else if ins.type === 'output'}
		<label class="drawer-field">
			<span>Terminal Output</span>
			<textarea rows="6" class="mono" bind:value={ins.text}></textarea>
		</label>
	{:else if ins.type === 'status'}
		<label class="drawer-field">
			<span>Status Text</span>
			<input type="text" bind:value={ins.text} />
		</label>
		<label class="drawer-field">
			<span>Variant</span>
			<select bind:value={ins.variant}>
				<option value="success">success</option>
				<option value="info">info</option>
				<option value="warning">warning</option>
				<option value="error">error</option>
			</select>
		</label>
	{:else if ins.type === 'divider'}
		<label class="drawer-field">
			<span>Label</span>
			<input type="text" bind:value={ins.label} />
		</label>
	{:else if ins.type === 'window'}
		<label class="drawer-field">
			<span>Window Title</span>
			<input type="text" bind:value={ins.windowTitle} />
		</label>
		<label class="drawer-field">
			<span>Subtitle</span>
			<input type="text" bind:value={ins.subtitle} />
		</label>
		{#if ins.content.kind === 'fiji-image' || ins.content.kind === 'image' || ins.content.kind === 'video'}
			<label class="drawer-field">
				<span>Source file</span>
				<div class="file-upload-row">
					<input
						type="text"
						value={'src' in ins.content ? ins.content.src : ''}
						oninput={(e) => {
							if ('src' in ins.content) {
								(ins.content as { src: string }).src = (e.target as HTMLInputElement).value;
							}
						}}
						placeholder="filename.png"
					/>
					<input
						type="file"
						accept="image/*,video/*"
						onchange={(e) => onFileUpload(e, editingStep.roundId, editingStep.stepId)}
					/>
				</div>
			</label>
			{#if ins.content.kind === 'fiji-image'}
				<label class="drawer-field">
					<span>Status Bar</span>
					<input
						type="text"
						bind:value={ins.content.statusBar}
						placeholder="256×254 pixels; 8-bit"
					/>
				</label>
			{/if}
		{:else if ins.content.kind === 'markdown'}
			<label class="drawer-field">
				<span>Markdown</span>
				<textarea rows="6" bind:value={ins.content.text}></textarea>
			</label>
		{:else if ins.content.kind === 'source'}
			<label class="drawer-field">
				<span>Source Code</span>
				<textarea rows="8" class="mono" bind:value={ins.content.text}></textarea>
			</label>
			<label class="drawer-field">
				<span>Language</span>
				<input type="text" bind:value={ins.content.language} placeholder="python" />
			</label>
		{/if}
	{/if}
{/snippet}

<aside class="edit-drawer">
	<div class="drawer-header">
		<h3>Edit: {stepLabel(editStep)}</h3>
		<button class="btn-icon" onclick={onClose}>&#x2715;</button>
	</div>
	<div class="drawer-body">
		{#if editStep.inserted}
			{@render editInsertedStep(editStep)}
		{:else}
			{@render editSourceStep(editStep)}
		{/if}

		<div class="drawer-row">
			<label class="drawer-field" style="flex:1">
				<span>Comment (EN)</span>
				<textarea
					rows="2"
					value={typeof editStep.comment === 'string'
						? editStep.comment
						: editStep.comment?.en ?? ''}
					oninput={(e) => {
						const val = (e.target as HTMLTextAreaElement).value;
						editStep.comment = val || undefined;
					}}
				></textarea>
			</label>
			<div class="drawer-field">
				<span>Display</span>
				<div class="display-mode-toggle">
					<button
						class="mode-btn"
						class:active={editStep.displayMode === 'full'}
						onclick={() => (editStep.displayMode = 'full')}
					>Full</button>
					<button
						class="mode-btn"
						class:active={editStep.displayMode === 'compact'}
						onclick={() => (editStep.displayMode = 'compact')}
					>Compact</button>
				</div>
			</div>
		</div>
	</div>
</aside>

<style>
	/* ─── Edit drawer ─────────────────────────── */
	.edit-drawer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 25;
		max-height: 45vh;
		overflow-y: auto;
		background: rgba(18, 8, 16, 0.96);
		backdrop-filter: blur(18px);
		border-top: 2px solid var(--orange-500);
		box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
		animation: slideUp 0.2s ease-out;
	}
	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
	.drawer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--border-subtle);
		position: sticky;
		top: 0;
		background: rgba(18, 8, 16, 0.98);
		z-index: 1;
	}
	.drawer-header h3 {
		font-size: 0.82rem;
		color: var(--orange-300);
		margin: 0;
		font-weight: 500;
	}
	.drawer-body {
		padding: 0.8rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		max-width: 900px;
	}
	.drawer-field {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.drawer-field > span {
		font-family: var(--font-mono);
		font-size: 0.62rem;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.drawer-field input,
	.drawer-field textarea,
	.drawer-field select {
		padding: 0.35rem 0.5rem;
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		resize: vertical;
	}
	.drawer-field input:focus,
	.drawer-field textarea:focus {
		outline: none;
		border-color: var(--orange-400);
	}
	.drawer-check {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: var(--font-mono);
		font-size: 0.73rem;
		color: var(--text-secondary);
	}
	.drawer-check input {
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
	.file-upload-row input[type='text'] {
		flex: 1;
	}
	.file-upload-row input[type='file'] {
		font-family: var(--font-mono);
		font-size: 0.68rem;
		color: var(--text-secondary);
	}

	/* Display mode toggle in drawer */
	.drawer-row {
		display: flex;
		gap: 0.8rem;
		align-items: flex-start;
	}
	.display-mode-toggle {
		display: flex;
		border: 1px solid var(--border-subtle);
		border-radius: 5px;
		overflow: hidden;
		margin-top: 0.2rem;
	}
	.mode-btn {
		padding: 0.3rem 0.6rem;
		background: transparent;
		border: none;
		border-right: 1px solid var(--border-subtle);
		color: var(--text-tertiary);
		font-family: var(--font-mono);
		font-size: 0.68rem;
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

	/* ─── Buttons ─────────────────────────────── */
	.btn-sm {
		padding: 0.2rem 0.5rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid var(--border-subtle);
		border-radius: 4px;
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 0.65rem;
		cursor: pointer;
	}
	.btn-sm:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--text-primary);
	}
	.btn-icon {
		background: none;
		border: none;
		color: var(--text-tertiary);
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0.15rem 0.3rem;
		border-radius: 3px;
	}
	.btn-icon:hover {
		color: var(--text-primary);
		background: rgba(255, 255, 255, 0.06);
	}
</style>
