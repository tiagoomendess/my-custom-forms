<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import FormSettings from '$lib/components/builder/FormSettings.svelte';
	import NodeEditor from '$lib/components/builder/NodeEditor.svelte';
	import Preview from '$lib/components/builder/Preview.svelte';
	import {
		itemsToSpec,
		newBreak,
		newQuestion,
		newSplit,
		specToItems,
		type Item
	} from '$lib/forms/builder';
	import { END } from '$lib/forms/types';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	/** Convert ISO → `datetime-local` value in the browser's local timezone. */
	function toDatetimeLocal(iso: string | null): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	/** Convert `datetime-local` → ISO, or empty string when cleared. */
	function fromDatetimeLocal(local: string): string {
		if (!local.trim()) return '';
		const d = new Date(local);
		if (Number.isNaN(d.getTime())) return '';
		return d.toISOString();
	}

	// Ensure each node's flow keeps the default (rule without a condition) last.
	function normalize(items: Item[]): Item[] {
		for (const { node } of items) {
			if (node.kind === 'split') continue;
			const branches = node.next.filter((r) => r.if);
			const def = node.next.find((r) => !r.if) ?? { goTo: END };
			node.next = [...branches, def];
		}
		return items;
	}

	// Seed editor state from load data once (stable for this page's lifetime).
	// svelte-ignore state_referenced_locally
	const initial = data.form;
	const initialItems = normalize(specToItems(initial.spec));
	// svelte-ignore state_referenced_locally
	const locked = data.locked;

	let name = $state(initial.name);
	let items = $state<Item[]>(initialItems);
	let startId = $state(initial.spec.start ?? '');
	let selectedId = $state<string | null>(initialItems[0]?.id ?? null);
	let status = $state(initial.status);
	let coverImageKey = $state<string | null>(initial.coverImageKey);
	let allowSubmitUntilLocal = $state(toDatetimeLocal(initial.allowSubmitUntil));
	let allowMultipleSubmits = $state(initial.allowMultipleSubmits);
	let busy = $state(false);
	let savedMsg = $state<string | null>(null);

	let spec = $derived(itemsToSpec(items, startId));
	let specJson = $derived(JSON.stringify(spec));
	let allowSubmitUntilIso = $derived(fromDatetimeLocal(allowSubmitUntilLocal));
	let published = $derived(status === 'published');
	let publishErrors = $derived(
		form && 'errors' in form ? ((form as { errors?: string[] }).errors ?? null) : null
	);

	function labelFor(item: Item): string {
		if (item.node.kind === 'split') {
			return item.node.title?.trim() || 'A/B split';
		}
		return item.node.title?.trim() || `(untitled ${item.node.kind})`;
	}

	function targetsFor(excludeId: string) {
		const list = items
			.filter((i) => i.id !== excludeId)
			.map((i) => ({ id: i.id, label: labelFor(i) }));
		list.push({ id: END, label: 'End of form' });
		return list;
	}

	function add(kind: 'question' | 'break' | 'split') {
		if (locked) return;
		const id =
			kind === 'question' ? `q_${rand()}` : kind === 'break' ? `b_${rand()}` : `s_${rand()}`;
		const node =
			kind === 'question' ? newQuestion('single') : kind === 'break' ? newBreak() : newSplit();
		items = [...items, { id, node }];
		if (!startId && kind !== 'split') startId = id;
		selectedId = id;
	}

	function rand() {
		return crypto.randomUUID().slice(0, 8);
	}

	function move(index: number, dir: -1 | 1) {
		if (locked) return;
		const j = index + dir;
		if (j < 0 || j >= items.length) return;
		const copy = [...items];
		[copy[index], copy[j]] = [copy[j], copy[index]];
		items = copy;
	}

	function remove(id: string) {
		if (locked) return;
		items = items.filter((i) => i.id !== id);
		if (startId === id) startId = items.find((i) => i.node.kind !== 'split')?.id ?? '';
		if (selectedId === id) selectedId = items[0]?.id ?? null;
	}

	const submit: SubmitFunction = () => {
		busy = true;
		savedMsg = null;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
			const result = form as { ok?: boolean; published?: boolean } | null;
			if (result?.ok) {
				savedMsg =
					result.published === true
						? 'Published'
						: result.published === false
							? 'Unpublished'
							: 'Saved';
				if (result.published === true) status = 'published';
				if (result.published === false) status = 'draft';
			}
		};
	};
</script>

<svelte:head>
	<title>{name} · Builder</title>
</svelte:head>

<div class="toolbar">
	<div class="left">
		<a href="/admin" class="btn ghost sm">← Forms</a>
		<input class="input name-input" bind:value={name} disabled={locked} aria-label="Form name" />
		<span class="badge {published ? 'green' : status === 'archived' ? 'gray' : 'amber'}">{status}</span>
	</div>
	<form method="POST" use:enhance={submit} class="actions">
		<input type="hidden" name="name" value={name} />
		<input type="hidden" name="spec" value={specJson} />
		<input type="hidden" name="coverImageKey" value={coverImageKey ?? ''} />
		<input type="hidden" name="allowSubmitUntil" value={allowSubmitUntilIso} />
		<input type="hidden" name="allowMultipleSubmits" value={allowMultipleSubmits ? 'true' : 'false'} />
		{#if savedMsg}<span class="saved">{savedMsg}</span>{/if}
		<button class="btn secondary" type="submit" formaction="?/save" disabled={busy}>
			Save
		</button>
		{#if published}
			<button class="btn secondary" type="submit" formaction="?/unpublish" disabled={busy}>
				Unpublish
			</button>
		{:else}
			<button class="btn" type="submit" formaction="?/publish" disabled={busy}>Publish</button>
		{/if}
	</form>
</div>

{#if form?.error}
	<div class="alert error">
		{form.error}
		{#if publishErrors}
			<ul>
				{#each publishErrors as e (e)}<li>{e}</li>{/each}
			</ul>
		{/if}
	</div>
{/if}

{#if published}
	<div class="alert info share">
		Live at <a href={data.shareUrl} target="_blank" rel="noreferrer">{data.shareUrl}</a>. Add
		<code>?source=…</code> to tag where replies come from.
	</div>
{/if}

<div class="grid">
	<aside class="col nodes">
		<h4>Questions</h4>
		<ul class="items">
			{#each items as item, i (item.id)}
				<li class="row" class:active={selectedId === item.id}>
					<button
						type="button"
						class="item"
						onclick={() => (selectedId = item.id)}
					>
						<span class="item-title">
							{labelFor(item)}
							{#if item.id === startId}<span class="dot" title="Start"></span>{/if}
						</span>
						<span class="item-kind">{item.node.kind}</span>
					</button>
					<div class="item-tools">
						<button type="button" class="mini" title="Move up" aria-label="Move up" disabled={locked || i === 0} onclick={() => move(i, -1)}>↑</button>
						<button
							type="button"
							class="mini"
							title="Move down"
							aria-label="Move down"
							disabled={locked || i === items.length - 1}
							onclick={() => move(i, 1)}
						>↓</button>
						<button type="button" class="mini danger" title="Delete" aria-label="Delete" disabled={locked} onclick={() => remove(item.id)}>✕</button>
					</div>
				</li>
			{/each}
		</ul>
		{#if !locked}
			<div class="add">
				<button type="button" class="btn secondary sm" onclick={() => add('question')}>+ Question</button>
				<button type="button" class="btn secondary sm" onclick={() => add('break')}>+ Break</button>
				<button type="button" class="btn secondary sm" onclick={() => add('split')}>+ A/B split</button>
			</div>
		{/if}
	</aside>

	<section class="col main">
		{#if selectedId}
			{@const selectedIndex = items.findIndex((i) => i.id === selectedId)}
			{#if selectedIndex >= 0}
				{#key selectedId}
					<NodeEditor
						bind:node={items[selectedIndex].node}
						nodeId={selectedId}
						formId={data.form.id}
						targets={targetsFor(selectedId)}
						{locked}
						isStart={selectedId === startId}
						onmakestart={() => (startId = selectedId!)}
					/>
				{/key}
			{/if}
		{:else}
			<p class="muted">Add a question to get started.</p>
		{/if}
	</section>

	<section class="col preview-col">
		<Preview {spec} />
		<FormSettings
			formId={data.form.id}
			bind:coverImageKey
			bind:allowSubmitUntilLocal
			bind:allowMultipleSubmits
		/>
	</section>
</div>

<style>
	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}
	.left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.name-input {
		width: auto;
		min-width: 240px;
		font-weight: 600;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.saved {
		color: var(--success);
		font-size: 0.85rem;
		font-weight: 600;
	}
	.share code {
		background: rgba(0, 0, 0, 0.05);
		padding: 0.05rem 0.3rem;
		border-radius: 4px;
	}
	.grid {
		display: grid;
		grid-template-columns: 260px 1fr 380px;
		gap: 1.25rem;
		align-items: start;
	}
	.nodes h4 {
		margin-bottom: 0.75rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
	.items {
		list-style: none;
		margin: 0 0 1rem;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		border-radius: var(--radius-sm);
		border-left: 3px solid transparent;
		padding-left: 0.35rem;
		padding-right: 0.5rem;
		transition:
			background 0.12s ease,
			border-color 0.12s ease;
	}
	.row:hover {
		background: var(--surface-2);
	}
	.row.active {
		background: var(--primary-soft);
		border-left-color: var(--primary);
	}
	.item {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.1rem;
		text-align: left;
		padding: 0.5rem 0.4rem;
		border: none;
		background: transparent;
		cursor: pointer;
	}
	.item-title {
		font-weight: 550;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.row.active .item-title {
		color: var(--primary-hover);
	}
	.item-kind {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--success);
	}
	.item-tools {
		display: flex;
		gap: 0.15rem;
		opacity: 0;
		transition: opacity 0.12s ease;
	}
	.row:hover .item-tools,
	.row.active .item-tools {
		opacity: 1;
	}
	.mini {
		border: none;
		background: transparent;
		border-radius: 5px;
		width: 24px;
		height: 24px;
		cursor: pointer;
		font-size: 0.8rem;
		line-height: 1;
		color: var(--text-muted);
	}
	.mini:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--text);
	}
	.mini.danger:hover:not(:disabled) {
		background: var(--danger-soft);
		color: var(--danger);
	}
	.mini:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.add {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.main {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.5rem;
	}
	@media (max-width: 1024px) {
		.grid {
			grid-template-columns: 1fr;
		}
	}
</style>
