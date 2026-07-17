<script lang="ts">
	import { onMount } from 'svelte';
	import { SunOutline, MoonOutline } from 'flowbite-svelte-icons';

	// Initial paint state is set by the inline script in app.html; mirror it here.
	let dark = $state(false);

	onMount(() => {
		dark = document.documentElement.classList.contains('dark');

		// While the user hasn't made an explicit choice, keep following the OS.
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const onChange = (e: MediaQueryListEvent) => {
			if (localStorage.getItem('theme')) return;
			dark = e.matches;
			document.documentElement.classList.toggle('dark', dark);
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	function toggle() {
		dark = !dark;
		document.documentElement.classList.toggle('dark', dark);
		try {
			localStorage.setItem('theme', dark ? 'dark' : 'light');
		} catch {
			// Ignore storage failures (e.g. private mode); the class still applies.
		}
	}
</script>

<button
	type="button"
	class="theme-toggle"
	onclick={toggle}
	aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
	title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
>
	{#if dark}
		<SunOutline class="icon" />
	{:else}
		<MoonOutline class="icon" />
	{/if}
</button>

<style>
	.theme-toggle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
		background: var(--surface);
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
	}
	.theme-toggle:hover {
		background: var(--surface-2);
		color: var(--text);
	}
	.theme-toggle :global(.icon) {
		width: 18px;
		height: 18px;
	}
</style>
