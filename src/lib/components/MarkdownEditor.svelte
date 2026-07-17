<script lang="ts">
	import MarkdownContent from './MarkdownContent.svelte';
	import {
		LetterBoldOutline,
		LetterItalicOutline,
		LinkOutline,
		ListOutline,
		OrderedListOutline
	} from 'flowbite-svelte-icons';

	let {
		id,
		value = $bindable(''),
		disabled = false
	}: {
		id: string;
		value?: string;
		disabled?: boolean;
	} = $props();

	let mode = $state<'write' | 'preview'>('write');
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	function update(next: string) {
		value = next;
	}

	function insert(before: string, after: string, placeholder: string) {
		const el = textareaEl;
		if (!el || disabled) return;

		const start = el.selectionStart;
		const end = el.selectionEnd;
		const current = value ?? '';
		const selected = current.slice(start, end) || placeholder;
		const next = current.slice(0, start) + before + selected + after + current.slice(end);
		update(next);

		const cursor = start + before.length + selected.length;
		queueMicrotask(() => {
			el.focus();
			el.setSelectionRange(cursor, cursor);
		});
	}

	function prefixLines(prefix: string) {
		const el = textareaEl;
		if (!el || disabled) return;

		const current = value ?? '';
		const start = el.selectionStart;
		const end = el.selectionEnd;
		const blockStart = current.lastIndexOf('\n', start - 1) + 1;
		const blockEnd = current.indexOf('\n', end);
		const sliceEnd = blockEnd === -1 ? current.length : blockEnd;
		const block = current.slice(blockStart, sliceEnd);
		const lines = block.split('\n');
		const prefixed = lines.map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`)).join('\n');
		const next = current.slice(0, blockStart) + prefixed + current.slice(sliceEnd);
		update(next);

		queueMicrotask(() => {
			el.focus();
			el.setSelectionRange(blockStart, blockStart + prefixed.length);
		});
	}

	function wrapBold() {
		insert('**', '**', 'bold text');
	}

	function wrapItalic() {
		insert('*', '*', 'italic text');
	}

	function insertLink() {
		insert('[', '](https://)', 'link text');
	}

	function bulletList() {
		prefixLines('- ');
	}

	function orderedList() {
		prefixLines('1. ');
	}
</script>

<div class="md-editor" class:disabled>
	<div class="md-toolbar">
		<div class="md-tabs" role="tablist" aria-label="Description editor mode">
			<button
				type="button"
				class="md-tab"
				class:active={mode === 'write'}
				role="tab"
				aria-selected={mode === 'write'}
				{disabled}
				onclick={() => (mode = 'write')}
			>
				Write
			</button>
			<button
				type="button"
				class="md-tab"
				class:active={mode === 'preview'}
				role="tab"
				aria-selected={mode === 'preview'}
				{disabled}
				onclick={() => (mode = 'preview')}
			>
				Preview
			</button>
		</div>

		{#if mode === 'write'}
			<div class="md-actions" aria-label="Formatting">
				<button type="button" class="md-btn" title="Bold" aria-label="Bold" {disabled} onclick={wrapBold}>
					<LetterBoldOutline class="h-4 w-4" />
				</button>
				<button
					type="button"
					class="md-btn"
					title="Italic"
					aria-label="Italic"
					{disabled}
					onclick={wrapItalic}
				>
					<LetterItalicOutline class="h-4 w-4" />
				</button>
				<button type="button" class="md-btn" title="Link" aria-label="Link" {disabled} onclick={insertLink}>
					<LinkOutline class="h-4 w-4" />
				</button>
				<button
					type="button"
					class="md-btn"
					title="Bullet list"
					aria-label="Bullet list"
					{disabled}
					onclick={bulletList}
				>
					<ListOutline class="h-4 w-4" />
				</button>
				<button
					type="button"
					class="md-btn"
					title="Numbered list"
					aria-label="Numbered list"
					{disabled}
					onclick={orderedList}
				>
					<OrderedListOutline class="h-4 w-4" />
				</button>
			</div>
		{/if}
	</div>

	{#if mode === 'write'}
		<textarea
			{id}
			class="textarea md-textarea"
			value={value ?? ''}
			{disabled}
			placeholder="Add a description… Markdown supported."
			rows="4"
			bind:this={textareaEl}
			oninput={(e) => update(e.currentTarget.value)}
		></textarea>
	{:else}
		<div class="md-preview" aria-live="polite">
			{#if value?.trim()}
				<MarkdownContent source={value} />
			{:else}
				<p class="muted md-empty">Nothing to preview yet.</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.md-editor {
		display: flex;
		flex-direction: column;
		gap: 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		overflow: hidden;
	}
	.md-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.35rem 0.4rem;
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
		flex-wrap: wrap;
	}
	.md-tabs {
		display: inline-flex;
		gap: 0.15rem;
		padding: 0.15rem;
		border-radius: var(--radius-sm);
		background: var(--surface);
		border: 1px solid var(--border);
	}
	.md-tab {
		border: none;
		background: transparent;
		color: var(--text-muted);
		font-size: 0.8rem;
		font-weight: 550;
		padding: 0.3rem 0.65rem;
		border-radius: calc(var(--radius-sm) - 2px);
		cursor: pointer;
	}
	.md-tab.active {
		background: var(--primary-soft);
		color: var(--primary);
	}
	.md-tab:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.md-actions {
		display: flex;
		align-items: center;
		gap: 0.15rem;
	}
	.md-btn {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
	}
	.md-btn:hover:not(:disabled) {
		background: var(--surface);
		color: var(--text);
	}
	.md-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.md-textarea {
		border: none;
		border-radius: 0;
		box-shadow: none;
		min-height: 6.5rem;
	}
	.md-textarea:focus {
		box-shadow: none;
	}
	.md-preview {
		min-height: 6.5rem;
		padding: 0.75rem;
	}
	.md-empty {
		margin: 0;
		font-size: 0.9rem;
	}
	.md-editor.disabled {
		opacity: 0.85;
	}
</style>
