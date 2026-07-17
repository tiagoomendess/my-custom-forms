<script lang="ts">
	import { page } from '$app/state';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';

	let { children } = $props();
	let isLogin = $derived(page.url.pathname === '/admin/login');
</script>

{#if isLogin}
	{@render children()}
{:else}
	<div class="shell">
		<header class="topbar">
			<a href="/admin" class="brand">Custom Forms</a>
			<div class="topbar-actions">
				<ThemeToggle />
				<form method="POST" action="/admin/logout">
					<button class="btn ghost sm" type="submit">Log out</button>
				</form>
			</div>
		</header>
		<main class="content">
			{@render children()}
		</main>
	</div>
{/if}

<style>
	.shell {
		min-height: 100dvh;
	}
	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.5rem;
		background: var(--surface);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.brand {
		font-weight: 700;
		font-size: 1.05rem;
		color: var(--text);
	}
	.brand:hover {
		text-decoration: none;
	}
	.topbar-actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.content {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem 1.5rem;
	}
</style>
