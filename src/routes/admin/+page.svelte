<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function statusClass(status: string) {
		if (status === 'published') return 'green';
		if (status === 'archived') return 'gray';
		return 'amber';
	}
</script>

<svelte:head>
	<title>Forms · Admin</title>
</svelte:head>

<div class="head">
	<div>
		<h1>Forms</h1>
		<p class="muted">Build and manage your research forms.</p>
	</div>
	<form method="POST" action="?/create" use:enhance>
		<button class="btn" type="submit">New form</button>
	</form>
</div>

{#if data.forms.length === 0}
	<div class="card empty">
		<p class="muted">No forms yet. Create your first one.</p>
	</div>
{:else}
	<div class="card list">
		{#each data.forms as form (form.id)}
			<div class="row">
				<div class="info">
					<a class="name" href={`/admin/forms/${form.id}`}>{form.name}</a>
					<div class="meta">
						<span class="badge {statusClass(form.status)}">{form.status}</span>
						<span class="muted">{form.submissionCount} replies</span>
					</div>
				</div>
				<div class="actions">
					<a class="btn secondary sm" href={`/admin/forms/${form.id}`}>Edit</a>
					<a class="btn ghost sm" href={`/admin/forms/${form.id}/replies`}>Replies</a>
					<form method="POST" action="?/duplicate" use:enhance>
						<input type="hidden" name="id" value={form.id} />
						<button class="btn ghost sm" type="submit">Duplicate</button>
					</form>
					{#if form.status === 'archived'}
						<form method="POST" action="?/restore" use:enhance>
							<input type="hidden" name="id" value={form.id} />
							<button class="btn ghost sm" type="submit">Restore</button>
						</form>
					{:else}
						<form method="POST" action="?/archive" use:enhance>
							<input type="hidden" name="id" value={form.id} />
							<button class="btn ghost sm" type="submit">Archive</button>
						</form>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}
	.empty {
		padding: 2.5rem;
		text-align: center;
	}
	.list {
		overflow: hidden;
	}
	.row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid var(--border);
	}
	.row:last-child {
		border-bottom: none;
	}
	.name {
		font-weight: 600;
		font-size: 1.05rem;
		color: var(--text);
	}
	.meta {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		margin-top: 0.3rem;
		font-size: 0.85rem;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.actions form {
		display: inline;
	}
</style>
