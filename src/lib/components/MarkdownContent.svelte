<script lang="ts">
	import { renderMarkdown } from '$lib/markdown';

	let {
		source,
		class: className = ''
	}: {
		source: string;
		class?: string;
	} = $props();

	let html = $derived(renderMarkdown(source));
</script>

{#if html}
	<div class="markdown {className}">{@html html}</div>
{/if}
