<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let deleting = $state(false);
	let selected = $state<PageData['rows'][number] | null>(null);

	function fmt(d: string | Date | null): string {
		if (!d) return '—';
		return new Date(d).toLocaleString();
	}

	function openAnswers(row: PageData['rows'][number]) {
		selected = row;
	}

	function closeAnswers() {
		selected = null;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && selected) closeAnswers();
	}

	const confirmDelete: SubmitFunction = ({ cancel }) => {
		if (!confirm(`Permanently delete all ${data.total} replies for "${data.formName}"? This cannot be undone and will unlock the form for editing.`)) {
			cancel();
			return;
		}
		deleting = true;
		return async ({ update }) => {
			await update();
			deleting = false;
		};
	};
</script>

<svelte:window onkeydown={onKeydown} />

<svelte:head>
	<title>Replies · {data.formName}</title>
</svelte:head>

<div class="head">
	<div>
		<a href={`/admin/forms/${data.formId}`} class="btn ghost sm">← Back to form</a>
		<h1>{data.formName} — replies</h1>
		<p class="muted">{data.total} total · {data.finished} finished · {data.total - data.finished} partial</p>
	</div>
	<div class="head-actions">
		<a class="btn secondary" href={`/admin/forms/${data.formId}/replies/export`} download>
			Export CSV
		</a>
		{#if data.total > 0}
			<form method="POST" action="?/deleteAll" use:enhance={confirmDelete}>
				<button class="btn danger" type="submit" disabled={deleting}>
					{deleting ? 'Deleting…' : 'Delete all replies'}
				</button>
			</form>
		{/if}
	</div>
</div>

{#if data.total === 0}
	<div class="card empty"><p class="muted">No replies yet.</p></div>
{:else}
	<div class="card table-wrap">
		<table>
			<thead>
				<tr>
					<th>Started</th>
					<th>Status</th>
					<th>Source</th>
					<th>IP</th>
					<th>User agent</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.rows as row (row.id)}
					<tr>
						<td class="nowrap">{fmt(row.startedAt)}</td>
						<td>
							<span class="badge {row.status === 'FINISHED' ? 'green' : 'amber'}">
								{row.status}
							</span>
						</td>
						<td>{row.source ?? '—'}</td>
						<td class="nowrap">{row.ip ?? '—'}</td>
						<td class="ua" title={row.userAgent ?? ''}>{row.userAgent ?? '—'}</td>
						<td class="actions">
							<button type="button" class="btn secondary sm" onclick={() => openAnswers(row)}>
								View answers
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if selected}
	<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
	<div class="backdrop" onclick={closeAnswers} role="presentation"></div>
	<div
		class="dialog card"
		role="dialog"
		aria-modal="true"
		aria-labelledby="answers-title"
	>
		<div class="dialog-head">
			<div>
				<h2 id="answers-title">Answers</h2>
				<p class="muted dialog-meta">
					{fmt(selected.startedAt)} · {selected.status}
					{#if selected.source}
						· {selected.source}
					{/if}
				</p>
			</div>
			<button type="button" class="btn ghost sm" onclick={closeAnswers} aria-label="Close">
				Close
			</button>
		</div>
		{#if data.columns.length === 0}
			<p class="muted">No questions in this form.</p>
		{:else}
			<dl class="answers">
				{#each data.columns as col, i (col.id)}
					<div class="answer">
						<dt>{col.title}</dt>
						<dd>{selected.cells[i] || '—'}</dd>
					</div>
				{/each}
			</dl>
		{/if}
	</div>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}
	.head h1 {
		margin-top: 0.5rem;
	}
	.head-actions {
		display: flex;
		gap: 0.6rem;
		align-items: center;
	}
	.empty {
		padding: 2.5rem;
		text-align: center;
	}
	.table-wrap {
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.88rem;
	}
	th,
	td {
		text-align: left;
		padding: 0.6rem 0.85rem;
		border-bottom: 1px solid var(--border);
		vertical-align: top;
	}
	th {
		font-weight: 600;
		color: var(--text-muted);
		white-space: nowrap;
		position: sticky;
		top: 0;
		background: var(--surface);
	}
	.nowrap {
		white-space: nowrap;
	}
	.ua {
		max-width: 220px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.actions {
		text-align: right;
		white-space: nowrap;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 40;
	}
	.dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: 50;
		width: min(560px, calc(100vw - 2rem));
		max-height: min(80dvh, 720px);
		overflow: auto;
		padding: 1.25rem 1.35rem;
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
	}
	.dialog-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.dialog-head h2 {
		margin: 0;
		font-size: 1.15rem;
	}
	.dialog-meta {
		margin: 0.25rem 0 0;
		font-size: 0.85rem;
	}
	.answers {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.answer {
		padding-bottom: 0.85rem;
		border-bottom: 1px solid var(--border);
	}
	.answer:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}
	.answer dt {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-muted);
		margin-bottom: 0.25rem;
	}
	.answer dd {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
