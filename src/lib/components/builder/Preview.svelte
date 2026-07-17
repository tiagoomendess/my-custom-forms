<script lang="ts">
	import QuestionView from '../QuestionView.svelte';
	import { advance, isEnd, startNode } from '$lib/forms/engine';
	import { toPublicNode, type AnswerValue, type FormSpec, type PublicNode } from '$lib/forms/types';

	let { spec }: { spec: FormSpec } = $props();

	let history = $state<PublicNode[]>([]);
	let index = $state(0);
	let values = $state<Record<string, AnswerValue>>({});
	let assignments = $state<Record<string, string>>({});
	let finished = $state(false);

	let current = $derived(history[index] ?? null);

	function restart() {
		values = {};
		assignments = {};
		finished = false;
		index = 0;
		const { nodeId, assignments: a } = startNode(spec);
		assignments = a;
		const node = isEnd(nodeId) ? null : toPublicNode(spec.nodes[nodeId], nodeId);
		history = node ? [node] : [];
	}

	// Start once, and recover automatically if the previewed node is edited away.
	let started = $state(false);
	$effect(() => {
		if (!started) {
			started = true;
			restart();
			return;
		}
		if (current && !spec.nodes[current.id]) restart();
	});

	function next(value: AnswerValue | undefined) {
		if (!current) return;
		if (value !== undefined) values[current.id] = value;
		const result = advance(spec, current.id, value, assignments);
		assignments = result.assignments;
		if (isEnd(result.nodeId)) {
			finished = true;
			return;
		}
		const node = toPublicNode(spec.nodes[result.nodeId], result.nodeId);
		history = node ? [...history.slice(0, index + 1), node] : history;
		index = history.length - 1;
	}

	function back() {
		if (index > 0) index -= 1;
	}
</script>

<div class="preview">
	<div class="preview-bar">
		<span class="badge">Live preview</span>
		<button type="button" class="btn ghost sm" onclick={restart}>Restart</button>
	</div>
	<div class="preview-screen">
		{#if finished}
			<div class="done">
				<div class="tick">✓</div>
				<p>End of form</p>
			</div>
		{:else if !current}
			<p class="muted center">Add a question and set a start to preview.</p>
		{:else}
			{#key current.id}
				<QuestionView
					node={current}
					initialValue={values[current.id]}
					canGoBack={index > 0}
					onnext={next}
					onback={back}
				/>
			{/key}
		{/if}
	</div>
</div>

<style>
	.preview-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
	}
	.preview-screen {
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.75rem;
		min-height: 320px;
	}
	.center {
		text-align: center;
		margin-top: 6rem;
	}
	.done {
		text-align: center;
		padding-top: 4rem;
	}
	.tick {
		width: 48px;
		height: 48px;
		margin: 0 auto 0.75rem;
		border-radius: 50%;
		background: #dcfce7;
		color: var(--success);
		display: grid;
		place-items: center;
		font-size: 1.4rem;
		font-weight: 700;
	}
</style>
