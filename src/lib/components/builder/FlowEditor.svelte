<script lang="ts">
	import { Select } from 'flowbite-svelte';
	import { END, type BreakNode, type Condition, type QuestionNode } from '$lib/forms/types';
	import { CONDITION_OPS } from '$lib/forms/builder';

	let {
		node,
		targets,
		allowConditions
	}: {
		node: QuestionNode | BreakNode;
		targets: { id: string; label: string }[];
		allowConditions: boolean;
	} = $props();

	let question = $derived(node.kind === 'question' ? node : null);
	let branches = $derived(node.next.slice(0, -1));
	let defaultGoTo = $derived(node.next[node.next.length - 1]?.goTo ?? END);
	let hasBranches = $derived(allowConditions && branches.length > 0);

	function commit(nextBranches: typeof branches, def: string | typeof END) {
		node.next = [...nextBranches, { goTo: def }];
	}

	function opsForType(): Condition['op'][] {
		if (!question) return ['answered'];
		switch (question.type) {
			case 'single':
			case 'multi':
				return ['eq', 'neq', 'contains', 'answered'];
			case 'number':
			case 'slider':
				return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'answered'];
			case 'text':
				return ['eq', 'neq', 'answered'];
		}
	}

	function defaultCondition(): Condition {
		if (!question) return { op: 'answered' };
		if (question.type === 'single' || question.type === 'multi') {
			return { op: 'eq', value: question.options?.[0]?.id ?? '' };
		}
		if (question.type === 'number' || question.type === 'slider') {
			return { op: 'gt', value: 0 };
		}
		return { op: 'eq', value: '' };
	}

	function addBranch() {
		commit([...branches, { if: defaultCondition(), goTo: END }], defaultGoTo);
	}
	function removeBranch(i: number) {
		commit(
			branches.filter((_, idx) => idx !== i),
			defaultGoTo
		);
	}
	function setBranchGoTo(i: number, goTo: string) {
		commit(
			branches.map((b, idx) => (idx === i ? { ...b, goTo } : b)),
			defaultGoTo
		);
	}
	function setBranchOp(i: number, op: Condition['op']) {
		commit(
			branches.map((b, idx) => {
				if (idx !== i) return b;
				const cond: Condition =
					op === 'answered'
						? { op }
						: op === 'contains'
							? { op, value: String((b.if as { value?: unknown }).value ?? '') }
							: op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte'
								? { op, value: Number((b.if as { value?: unknown }).value ?? 0) }
								: { op, value: (b.if as { value?: string | number }).value ?? '' };
				return { ...b, if: cond };
			}),
			defaultGoTo
		);
	}
	function setBranchValue(i: number, value: string | number) {
		commit(
			branches.map((b, idx) => {
				if (idx !== i || !b.if || b.if.op === 'answered') return b;
				return { ...b, if: { ...b.if, value } as Condition };
			}),
			defaultGoTo
		);
	}
</script>

<div class="flow">
	{#if hasBranches && question}
		<section class="flow-section">
			<header class="flow-head">
				<span class="flow-title">Conditions</span>
				<span class="flow-hint">Checked first, top to bottom — first match wins</span>
			</header>

			<ol class="branches">
				{#each branches as branch, i (i)}
					<li class="branch">
						<span class="step" aria-hidden="true">{i + 1}</span>
						<span class="lbl">If answer</span>
						<Select
							size="sm"
							placeholder=""
							class="w-auto"
							classes={{ select: 'w-auto' }}
							value={branch.if?.op}
							onchange={(e) => setBranchOp(i, e.currentTarget.value as Condition['op'])}
						>
							{#each opsForType() as op (op)}
								<option value={op}>{CONDITION_OPS.find((o) => o.value === op)?.label}</option>
							{/each}
						</Select>

						{#if branch.if && branch.if.op !== 'answered'}
							{#if question.type === 'single' || question.type === 'multi'}
								<Select
									size="sm"
									placeholder=""
									class="w-auto"
									classes={{ select: 'w-auto' }}
									value={String(branch.if.value)}
									onchange={(e) => setBranchValue(i, e.currentTarget.value)}
								>
									{#each question.options ?? [] as opt (opt.id)}
										<option value={opt.id}>{opt.label || opt.id}</option>
									{/each}
									{#if question.type === 'multi' && question.noneOfTheAbove}
										<option value="none">Nenhuma das anteriores</option>
									{/if}
								</Select>
							{:else if question.type === 'number' || question.type === 'slider'}
								<input
									class="input sm"
									type="number"
									value={branch.if.value}
									oninput={(e) => setBranchValue(i, Number(e.currentTarget.value))}
								/>
							{:else}
								<input
									class="input sm"
									type="text"
									value={branch.if.value}
									oninput={(e) => setBranchValue(i, e.currentTarget.value)}
								/>
							{/if}
						{/if}

						<span class="lbl">→</span>
						<Select
							size="sm"
							placeholder=""
							class="w-auto"
							classes={{ select: 'w-auto' }}
							value={String(branch.goTo)}
							onchange={(e) => setBranchGoTo(i, e.currentTarget.value)}
						>
							{#each targets as t (t.id)}
								<option value={t.id}>{t.label}</option>
							{/each}
						</Select>

						<button type="button" class="btn ghost sm" onclick={() => removeBranch(i)}>✕</button>
					</li>
				{/each}
			</ol>

			<button type="button" class="btn secondary sm" onclick={addBranch}>+ Add condition</button>
		</section>

		<section class="flow-section fallback">
			<header class="flow-head">
				<span class="flow-title">Otherwise</span>
				<span class="flow-hint">Used only if no condition matches</span>
			</header>
			<div class="branch default">
				<span class="lbl">Go to</span>
				<Select
					size="sm"
					placeholder=""
					class="w-auto"
					classes={{ select: 'w-auto' }}
					value={String(defaultGoTo)}
					onchange={(e) => commit(branches, e.currentTarget.value)}
				>
					{#each targets as t (t.id)}
						<option value={t.id}>{t.label}</option>
					{/each}
				</Select>
			</div>
		</section>
	{:else}
		<div class="branch default simple">
			<span class="lbl">Go to</span>
			<Select
				size="sm"
				placeholder=""
				class="w-auto"
				classes={{ select: 'w-auto' }}
				value={String(defaultGoTo)}
				onchange={(e) => commit(branches, e.currentTarget.value)}
			>
				{#each targets as t (t.id)}
					<option value={t.id}>{t.label}</option>
				{/each}
			</Select>
		</div>

		{#if allowConditions && question}
			<p class="flow-hint alone">
				Optional: add conditions to branch based on the answer. Conditions are checked first; this
				destination is the fallback.
			</p>
			<button type="button" class="btn secondary sm" onclick={addBranch}>+ Add condition</button>
		{/if}
	{/if}
</div>

<style>
	.flow {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.flow-section {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}
	.flow-section.fallback {
		padding-top: 0.75rem;
		border-top: 1px dashed var(--border);
	}
	.flow-head {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.flow-title {
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--text);
	}
	.flow-hint {
		font-size: 0.8rem;
		color: var(--text-muted);
		line-height: 1.35;
		margin: 0;
	}
	.flow-hint.alone {
		margin-top: -0.25rem;
	}
	.branches {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.branch {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.branch.default.simple {
		padding-top: 0;
		border-top: none;
	}
	.step {
		display: grid;
		place-items: center;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--border);
		font-size: 0.7rem;
		font-weight: 650;
		color: var(--text-muted);
		flex: none;
	}
	.lbl {
		font-size: 0.85rem;
		color: var(--text-muted);
	}
	.input.sm {
		width: auto;
		padding: 0.35rem 0.5rem;
		font-size: 0.85rem;
		max-width: 120px;
	}
</style>
