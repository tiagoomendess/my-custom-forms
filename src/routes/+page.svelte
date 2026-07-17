<script lang="ts">
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
		<p class="muted">You're not supposed to be here, shoo leave!</p>
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
