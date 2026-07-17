<script lang="ts">
	import { Alert, Button } from 'flowbite-svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
</script>

<svelte:head>
	<title>Custom Forms</title>
</svelte:head>

<div class="theme-corner">
	<ThemeToggle />
</div>

<div class="landing">
	<div class="card box">
		<h1>Custom Forms</h1>
		<p class="muted">
			Build dynamic, branching research forms and collect responses. Manage everything from the
			admin area.
		</p>

		<Alert class="my-4 text-left">
			<span class="font-medium">Flowbite Svelte is ready.</span> You can now build the UI with this
			component library.
		</Alert>

		<Button href="/admin">Go to admin</Button>
	</div>
</div>

<style>
	.theme-corner {
		position: fixed;
		top: 1rem;
		right: 1rem;
		z-index: 10;
	}
	.landing {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}
	.box {
		max-width: 460px;
		padding: 2.5rem;
		text-align: center;
	}
</style>
