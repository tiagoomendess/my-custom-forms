<script lang="ts">
	import { Select, Toggle } from 'flowbite-svelte';
	import { PlusOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import FlowEditor from './FlowEditor.svelte';
	import MarkdownEditor from '../MarkdownEditor.svelte';
	import {
		filterValidationsForType,
		newOption,
		newValidation,
		VALIDATION_TYPES,
		validationsForType
	} from '$lib/forms/builder';
	import type { Node, QuestionNode, QuestionType, Validation, ValidationType } from '$lib/forms/types';

	let {
		node = $bindable(),
		nodeId,
		formId,
		targets,
		locked,
		isStart,
		onmakestart
	}: {
		node: Node;
		nodeId: string;
		formId: string;
		targets: { id: string; label: string }[];
		locked: boolean;
		isStart: boolean;
		onmakestart: () => void;
	} = $props();

	let uploading = $state(false);
	let uploadError = $state<string | null>(null);

	let totalWeight = $derived(
		node.kind === 'split'
			? node.variants.reduce((sum, v) => sum + (Number(v.weight) || 0), 0)
			: 0
	);

	function variantLetter(i: number) {
		return String.fromCharCode(65 + i);
	}

	function weightShare(weight: number) {
		if (!totalWeight) return 0;
		return Math.round(((Number(weight) || 0) / totalWeight) * 100);
	}

	const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
		{ value: 'text', label: 'Text' },
		{ value: 'number', label: 'Number' },
		{ value: 'single', label: 'Single choice' },
		{ value: 'multi', label: 'Multiple choice' },
		{ value: 'slider', label: 'Slider' }
	];

	function changeType(q: QuestionNode, type: QuestionType) {
		q.type = type;
		if (type === 'single' || type === 'multi') {
			if (!q.options || q.options.length === 0) {
				q.options = [newOption('Option 1'), newOption('Option 2')];
			}
		} else {
			q.options = undefined;
		}
		if (type !== 'multi') {
			q.allowedCount = undefined;
			q.allowedCountMode = undefined;
			q.noneOfTheAbove = undefined;
		}
		q.autoAdvance = type === 'single' ? (q.autoAdvance ?? true) : false;
		q.range = type === 'slider' ? (q.range ?? { min: 1, max: 100, step: 1 }) : undefined;
		q.validations = filterValidationsForType(q.validations, type);
	}

	type MultiLimitChoice = 'any' | 'upTo:2' | 'upTo:3' | 'exact:2' | 'exact:3';

	function multiLimitValue(q: QuestionNode): MultiLimitChoice {
		if (q.allowedCount !== 2 && q.allowedCount !== 3) return 'any';
		const mode = q.allowedCountMode === 'exact' ? 'exact' : 'upTo';
		return `${mode}:${q.allowedCount}` as MultiLimitChoice;
	}

	function setMultiLimit(q: QuestionNode, choice: MultiLimitChoice) {
		if (choice === 'any') {
			q.allowedCount = undefined;
			q.allowedCountMode = undefined;
			return;
		}
		const [mode, count] = choice.split(':') as ['exact' | 'upTo', '2' | '3'];
		q.allowedCount = Number(count) as 2 | 3;
		q.allowedCountMode = mode;
	}

	function availableValidationTypes(type: QuestionType) {
		return VALIDATION_TYPES.filter((t) => t.forTypes.includes(type));
	}

	function addValidation(q: QuestionNode) {
		const allowed = validationsForType(q.type);
		const first = allowed[0];
		if (!first) return;
		q.validations = [...(q.validations ?? []), newValidation(first)];
	}

	function setValidationType(q: QuestionNode, index: number, type: ValidationType) {
		if (!q.validations) return;
		const prev = q.validations[index];
		const next = newValidation(type);
		if (prev?.message) next.message = prev.message;
		q.validations = q.validations.map((r, i) => (i === index ? next : r));
	}

	function removeValidation(q: QuestionNode, index: number) {
		if (!q.validations) return;
		const next = q.validations.filter((_, i) => i !== index);
		q.validations = next.length ? next : undefined;
	}

	function updateValidation(q: QuestionNode, index: number, patch: Partial<Validation>) {
		if (!q.validations) return;
		q.validations = q.validations.map((r, i) =>
			i === index ? ({ ...r, ...patch } as Validation) : r
		);
	}

	async function upload(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		uploadError = null;
		try {
			const body = new FormData();
			body.append('file', file);
			const res = await fetch(`/admin/forms/${formId}/upload`, { method: 'POST', body });
			if (!res.ok) throw new Error();
			const { key } = (await res.json()) as { key: string };
			if (node.kind !== 'split') node.imageKey = key;
		} catch {
			uploadError = 'Upload failed. Use a JPG, PNG, WEBP or GIF under 5 MB.';
		} finally {
			uploading = false;
			input.value = '';
		}
	}
</script>

<div class="editor" class:locked>
	{#if locked}
		<div class="alert info">Questions are locked because this form has replies.</div>
	{/if}

	{#if node.kind === 'split'}
		<div class="row-between">
			<h3>A/B split</h3>
			<span class="badge">{node.variants.length} variants</span>
		</div>
		<div class="field">
			<label for="split-title">Name</label>
			<input
				id="split-title"
				class="input"
				bind:value={
					() => node.title ?? 'A/B split',
					(v) => (node.title = v)
				}
				disabled={locked}
			/>
		</div>
		<p class="muted split-intro">
			Respondents are randomly assigned to one variant by weight. The choice is saved on each reply.
		</p>
		<div class="variants">
			{#each node.variants as variant, i (variant.id)}
				<div class="variant">
					<div class="variant-head">
						<span class="variant-badge">{variantLetter(i)}</span>
						<div class="variant-titles">
							<span class="variant-name">Variant {variantLetter(i)}</span>
							<span class="variant-share">{weightShare(variant.weight)}% of respondents</span>
						</div>
						<button
							type="button"
							class="variant-remove"
							title="Remove variant"
							aria-label="Remove variant"
							disabled={locked || node.variants.length <= 2}
							onclick={() => (node.variants = node.variants.filter((_, idx) => idx !== i))}
						>
							<TrashBinOutline class="h-4 w-4" />
						</button>
					</div>
					<div class="variant-body">
						<label class="vfield">
							<span>Weight</span>
							<input
								class="input sm"
								type="number"
								min="0"
								bind:value={variant.weight}
								disabled={locked}
							/>
						</label>
						<label class="vfield">
							<span>Go to</span>
							<Select
								size="sm"
								placeholder=""
								bind:value={variant.next}
								disabled={locked}
								items={targets.map((t) => ({ value: t.id, name: t.label }))}
							/>
						</label>
					</div>
				</div>
			{/each}
		</div>
		<button
			type="button"
			class="btn secondary sm add-variant"
			disabled={locked}
			onclick={() =>
				(node.variants = [
					...node.variants,
					{ id: `v_${crypto.randomUUID().slice(0, 8)}`, weight: 1, next: 'END' }
				])}
		>
			<PlusOutline class="h-4 w-4" /> Add variant
		</button>
	{:else}
		<div class="row-between">
			<h3>{node.kind === 'break' ? 'Section break' : 'Question'}</h3>
			{#if isStart}
				<span class="badge green">Start</span>
			{:else}
				<button type="button" class="btn ghost sm" onclick={onmakestart} disabled={locked}>
					Set as start
				</button>
			{/if}
		</div>

		<div class="field">
			<label for="title">Title</label>
			<input id="title" class="input" bind:value={node.title} disabled={locked} />
		</div>

		<div class="field">
			<label for="desc">Description (optional)</label>
			<MarkdownEditor
				id="desc"
				bind:value={
					() => node.description ?? '',
					(v) => (node.description = v)
				}
				disabled={locked}
			/>
		</div>

		{#if node.kind === 'question'}
			<div class="field">
				<label for="type">Question type</label>
				<Select
					id="type"
					placeholder=""
					value={node.type}
					disabled={locked}
					onchange={(e) => changeType(node, e.currentTarget.value as QuestionType)}
				>
					{#each QUESTION_TYPES as t (t.value)}
						<option value={t.value}>{t.label}</option>
					{/each}
				</Select>
			</div>

			<div class="toggles">
				<Toggle
					size="small"
					color="indigo"
					checked={node.required === true}
					disabled={locked}
					onchange={(e) => (node.required = e.currentTarget.checked)}
				>
					Required
				</Toggle>
				{#if node.type === 'single'}
					<Toggle
						size="small"
						color="indigo"
						checked={node.autoAdvance === true}
						disabled={locked}
						onchange={(e) => (node.autoAdvance = e.currentTarget.checked)}
					>
						Auto-advance on selection
					</Toggle>
				{/if}
				{#if node.type === 'multi'}
					<Toggle
						size="small"
						color="indigo"
						checked={node.noneOfTheAbove === true}
						disabled={locked}
						onchange={(e) => (node.noneOfTheAbove = e.currentTarget.checked)}
					>
						None of the above
					</Toggle>
				{/if}
			</div>

			{#if node.type === 'single' || node.type === 'multi'}
				<div class="field">
					<label for="options-list">Options</label>
					<div id="options-list" class="options-edit">
						{#each node.options ?? [] as opt (opt.id)}
							<div class="option-row">
								<input class="input" bind:value={opt.label} disabled={locked} />
								{#if (node.options?.length ?? 0) > 1}
									<button
										type="button"
										class="btn ghost sm"
										disabled={locked}
										onclick={() =>
											(node.options = (node.options ?? []).filter((o) => o.id !== opt.id))}
									>
										✕
									</button>
								{/if}
							</div>
						{/each}
					</div>
					<button
						type="button"
						class="btn secondary sm"
						disabled={locked}
						onclick={() => (node.options = [...(node.options ?? []), newOption('')])}
					>
						+ Add option
					</button>
				</div>
			{/if}

			{#if node.type === 'multi'}
				<div class="field">
					<label for="multi-limit">Selection limit</label>
					<p class="muted validations-hint">
						Cap how many options respondents can pick. Conditions still see the full selection.
					</p>
					<Select
						id="multi-limit"
						placeholder=""
						value={multiLimitValue(node)}
						disabled={locked}
						onchange={(e) => setMultiLimit(node, e.currentTarget.value as MultiLimitChoice)}
					>
						<option value="any">Any number</option>
						<option value="upTo:2">Up to 2</option>
						<option value="upTo:3">Up to 3</option>
						<option value="exact:2">Exactly 2</option>
						<option value="exact:3">Exactly 3</option>
					</Select>
				</div>
			{/if}

			{#if node.type === 'slider' && node.range}
				<div class="range-edit">
					<label class="lbl">Min
						<input class="input sm" type="number" bind:value={node.range.min} disabled={locked} />
					</label>
					<label class="lbl">Max
						<input class="input sm" type="number" bind:value={node.range.max} disabled={locked} />
					</label>
					<label class="lbl">Step
						<input class="input sm" type="number" bind:value={node.range.step} disabled={locked} />
					</label>
				</div>
			{/if}

			{#if availableValidationTypes(node.type).length > 0}
				<div class="field">
					<label for="validations-list">Validations</label>
					<p class="muted validations-hint">
						All rules must pass when an answer is provided. Chain as many as you need.
					</p>
					<div id="validations-list" class="validations">
						{#each node.validations ?? [] as rule, i (i)}
							<div class="validation">
								<div class="validation-row">
									<label class="vfield">
										<span>Rule</span>
										<Select
											size="sm"
											placeholder=""
											value={rule.type}
											disabled={locked}
											onchange={(e) =>
												setValidationType(node, i, e.currentTarget.value as ValidationType)}
										>
											{#each availableValidationTypes(node.type) as t (t.value)}
												<option value={t.value}>{t.label}</option>
											{/each}
										</Select>
									</label>

									{#if rule.type === 'regex'}
										<label class="vfield grow">
											<span>Pattern</span>
											<input
												class="input sm"
												type="text"
												value={rule.pattern}
												disabled={locked}
												placeholder="e.g. ^[A-Za-z]+$"
												oninput={(e) =>
													updateValidation(node, i, { pattern: e.currentTarget.value })}
											/>
										</label>
									{:else if rule.type === 'biggerThan' || rule.type === 'lowerThan'}
										<label class="vfield">
											<span>Value</span>
											<input
												class="input sm"
												type="number"
												value={rule.value}
												disabled={locked}
												oninput={(e) =>
													updateValidation(node, i, {
														value: Number(e.currentTarget.value)
													})}
											/>
										</label>
									{/if}

									<button
										type="button"
										class="variant-remove"
										title="Remove validation"
										aria-label="Remove validation"
										disabled={locked}
										onclick={() => removeValidation(node, i)}
									>
										<TrashBinOutline class="h-4 w-4" />
									</button>
								</div>
								<label class="vfield">
									<span>Error message (optional)</span>
									<input
										class="input sm"
										type="text"
										value={rule.message ?? ''}
										disabled={locked}
										placeholder="Shown when this rule fails"
										oninput={(e) =>
											updateValidation(node, i, {
												message: e.currentTarget.value || undefined
											})}
									/>
								</label>
							</div>
						{/each}
					</div>
					<button
						type="button"
						class="btn secondary sm"
						disabled={locked}
						onclick={() => addValidation(node)}
					>
						<PlusOutline class="h-4 w-4" /> Add validation
					</button>
				</div>
			{/if}
		{/if}

		<div class="field">
			<label for="image">Image (optional)</label>
			{#if node.imageKey}
				<div class="image-preview">
					<img src={`/img/${node.imageKey}`} alt="" />
					<button
						type="button"
						class="btn ghost sm"
						disabled={locked}
						onclick={() => (node.imageKey = undefined)}
					>
						Remove
					</button>
				</div>
			{/if}
			{#if !locked}
				<input id="image" type="file" accept="image/*" onchange={upload} disabled={uploading} />
				{#if uploading}<p class="muted">Uploading…</p>{/if}
				{#if uploadError}<p class="alert error">{uploadError}</p>{/if}
			{/if}
		</div>

		<div class="field">
			<label for="flow">Where to go next</label>
			<div id="flow">
				<FlowEditor {node} {targets} allowConditions={node.kind === 'question'} />
			</div>
		</div>
	{/if}
</div>

<style>
	.editor.locked :is(input, button):not(.alert) {
		cursor: not-allowed;
	}
	.editor.locked :global(textarea),
	.editor.locked :global(.md-btn),
	.editor.locked :global(.md-tab) {
		cursor: not-allowed;
	}
	.row-between {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.toggles {
		display: flex;
		gap: 1.25rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		align-items: center;
	}
	.toggles :global(label) {
		font-size: 0.9rem;
		color: var(--text);
		cursor: pointer;
	}
	.options-edit {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.option-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.range-edit {
		display: flex;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.range-edit .lbl {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8rem;
		color: var(--text-muted);
	}
	.input.sm {
		width: auto;
		padding: 0.35rem 0.5rem;
		font-size: 0.85rem;
	}
	.split-intro {
		margin-top: 0;
		font-size: 0.9rem;
	}
	.variants {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1.25rem 0;
	}
	.variant {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.variant-head {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}
	.variant-badge {
		flex: none;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: var(--primary);
		color: var(--primary-contrast);
		font-weight: 700;
		font-size: 0.9rem;
	}
	.variant-titles {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		line-height: 1.25;
	}
	.variant-name {
		font-weight: 600;
		font-size: 0.9rem;
	}
	.variant-share {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.variant-remove {
		flex: none;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border: none;
		border-radius: 7px;
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition:
			background 0.12s ease,
			color 0.12s ease;
	}
	.variant-remove:hover:not(:disabled) {
		background: var(--danger-soft);
		color: var(--danger);
	}
	.variant-remove:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.variant-body {
		display: grid;
		grid-template-columns: 96px 1fr;
		gap: 0.75rem;
		align-items: end;
	}
	.vfield {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		font-size: 0.72rem;
		font-weight: 550;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted);
	}
	.vfield .input.sm {
		width: 100%;
		font-size: 0.9rem;
		text-transform: none;
		letter-spacing: normal;
		color: var(--text);
	}
	.add-variant {
		align-self: flex-start;
	}
	.validations-hint {
		margin: 0 0 0.6rem;
		font-size: 0.85rem;
	}
	.validations {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 0.6rem;
	}
	.validation {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface-2);
	}
	.validation-row {
		display: flex;
		align-items: flex-end;
		gap: 0.65rem;
		flex-wrap: wrap;
	}
	.validation-row .vfield {
		min-width: 140px;
	}
	.validation-row .vfield.grow {
		flex: 1;
		min-width: 160px;
	}
	.image-preview {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}
	.image-preview img {
		max-width: 160px;
		max-height: 100px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--border);
	}
</style>
