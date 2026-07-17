<script lang="ts">
	import { enhance } from '$app/forms';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let submitting = $state(false);
</script>

<svelte:head>
	<title>Admin login</title>
</svelte:head>

<div class="theme-corner">
	<ThemeToggle />
</div>

<div class="wrap">
	<div class="card box">
		<h1>Admin access</h1>
		<p class="muted">Enter the admin password to manage forms.</p>

		{#if form?.error}
			<div class="alert error">{form.error}</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<input type="hidden" name="redirectTo" value={data.redirectTo} />
			<div class="field">
				<label for="password">Password</label>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					id="password"
					name="password"
					type="password"
					class="input"
					autocomplete="current-password"
					autofocus
					required
				/>
			</div>
			<button class="btn" type="submit" disabled={submitting} style="width: 100%">
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>
	</div>
</div>

<style>
	.theme-corner {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 10;
	}
	.wrap {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}
	.box {
		width: 100%;
		max-width: 380px;
		padding: 2rem;
	}
</style>
