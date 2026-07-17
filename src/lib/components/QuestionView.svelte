<script lang="ts">
	import {
		checkMultiSelection,
		multiLimitMode,
		multiSelectionComplete,
		runValidations
	} from '$lib/forms/engine';
	import type { AnswerValue, PublicNode } from '$lib/forms/types';
	import MarkdownContent from './MarkdownContent.svelte';

	let {
		node,
		initialValue = undefined,
		canGoBack = false,
		busy = false,
		imageBase = '/img/',
		onnext,
		onback
	}: {
		node: PublicNode;
		initialValue?: AnswerValue;
		canGoBack?: boolean;
		busy?: boolean;
		imageBase?: string;
		onnext: (value: AnswerValue | undefined) => void;
		onback?: () => void;
	} = $props();

	// A working copy of the answer, reset whenever the displayed node changes.
	let text = $state('');
	let num = $state<number | null>(null);
	let single = $state<string | null>(null);
	let multi = $state<string[]>([]);
	let noneSelected = $state(false);
	let slider = $state<number>(0);
	let validationError = $state<string | null>(null);

	let lastNodeId = $state<string | null>(null);
	let suppressClick = $state(false);
	let suppressClickTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		return () => clearTimeout(suppressClickTimer);
	});

	$effect(() => {
		if (node.id === lastNodeId) return;
		lastNodeId = node.id;
		validationError = null;
		text =
			node.kind === 'question' && node.type === 'text' && typeof initialValue === 'string'
				? initialValue
				: '';
		num =
			typeof initialValue === 'number' && node.kind === 'question' && node.type === 'number'
				? initialValue
				: null;
		single =
			node.kind === 'question' &&
			node.type === 'single' &&
			typeof initialValue === 'string'
				? initialValue
				: null;
		noneSelected =
			node.kind === 'question' && node.type === 'multi' && initialValue === 'none';
		multi =
			node.kind === 'question' && node.type === 'multi' && Array.isArray(initialValue)
				? [...initialValue]
				: [];
		if (node.kind === 'question' && node.type === 'slider') {
			slider =
				typeof initialValue === 'number' ? initialValue : (node.range?.min ?? 0);
		}
	});

	function markTouchHandled(e: PointerEvent) {
		suppressClick = true;
		clearTimeout(suppressClickTimer);
		suppressClickTimer = setTimeout(() => {
			suppressClick = false;
		}, 400);
		e.preventDefault();
	}

	function handleOptionPointerUp(action: () => void, e: PointerEvent) {
		if (busy) return;
		if (e.pointerType !== 'touch') return;
		markTouchHandled(e);
		action();
	}

	function handleOptionClick(action: () => void) {
		if (busy || suppressClick) return;
		action();
	}

	function currentValue(): AnswerValue | undefined {
		if (node.kind === 'break') return undefined;
		switch (node.type) {
			case 'text':
				return text.trim();
			case 'number':
				return num ?? undefined;
			case 'single':
				return single ?? undefined;
			case 'multi':
				return noneSelected ? 'none' : multi;
			case 'slider':
				return slider;
		}
	}

	let answered = $derived.by(() => {
		if (node.kind === 'break') return true;
		switch (node.type) {
			case 'text':
				return text.trim() !== '';
			case 'number':
				return num !== null && !Number.isNaN(num);
			case 'single':
				return single !== null;
			case 'multi':
				return noneSelected || multi.length > 0;
			case 'slider':
				return true;
		}
	});

	let required = $derived(node.kind === 'question' && node.required === true);
	let multiLimit = $derived(
		node.kind === 'question' && node.type === 'multi' ? multiLimitMode(node) : null
	);
	let multiAllowed = $derived(
		node.kind === 'question' && node.type === 'multi' ? (node.allowedCount ?? null) : null
	);
	let multiComplete = $derived(
		node.kind === 'question' && node.type === 'multi'
			? multiSelectionComplete(node, noneSelected ? 'none' : multi)
			: true
	);
	let canContinue = $derived(
		!busy &&
			(node.kind === 'question' && node.type === 'multi'
				? multiComplete
				: !required || answered)
	);
	// Matches MIN_ADVANCE_MS in the form runner page.
	const CONTINUE_PROGRESS_MS = 300;
	// Auto-advance single-choice questions submit on tap, so the Continue button is
	// shown for visual consistency but stays disabled (it only reflects loading state).
	let isAutoAdvance = $derived(
		node.kind === 'question' && node.type === 'single' && node.autoAdvance === true
	);

	let multiHint = $derived.by(() => {
		if (!multiLimit || !multiAllowed) return null;
		if (multiLimit === 'exact') {
			return `Selecione exatamente ${multiAllowed} opções (${multi.length}/${multiAllowed})`;
		}
		return `Selecione até ${multiAllowed} opções (${multi.length}/${multiAllowed})`;
	});
	let needsRequiredHint = $derived(required && !answered && !busy);
	let mobileRequiredTooltipVisible = $state(false);
	let mobileRequiredTooltipTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		if (!needsRequiredHint) {
			mobileRequiredTooltipVisible = false;
			clearTimeout(mobileRequiredTooltipTimer);
		}
		return () => clearTimeout(mobileRequiredTooltipTimer);
	});

	function showMobileRequiredTooltip() {
		if (!needsRequiredHint) return;
		mobileRequiredTooltipVisible = true;
		clearTimeout(mobileRequiredTooltipTimer);
		mobileRequiredTooltipTimer = setTimeout(() => {
			mobileRequiredTooltipVisible = false;
		}, 6000);
	}

	function handleContinuePointerDown(e: PointerEvent) {
		if (!needsRequiredHint || e.pointerType !== 'touch') return;
		showMobileRequiredTooltip();
	}

	function tryAdvance(value: AnswerValue | undefined) {
		if (node.kind === 'question') {
			if (node.type === 'multi') {
				const limitMsg = checkMultiSelection(node, value);
				if (limitMsg) {
					validationError = limitMsg;
					return;
				}
			}
			const msg = runValidations(node.validations, value);
			if (msg) {
				validationError = msg;
				return;
			}
		}
		validationError = null;
		onnext(value);
	}

	function submit() {
		if (!canContinue) return;
		tryAdvance(currentValue());
	}

	function chooseSingle(optionId: string) {
		single = optionId;
		validationError = null;
		if (node.kind === 'question' && node.autoAdvance && !busy) {
			tryAdvance(optionId);
		}
	}

	function toggleMulti(optionId: string) {
		if (noneSelected) return;
		if (multi.includes(optionId)) {
			multi = multi.filter((v) => v !== optionId);
			validationError = null;
			return;
		}
		if (multiAllowed && multi.length >= multiAllowed) {
			validationError =
				multiLimit === 'exact'
					? `Selecione exatamente ${multiAllowed} opções.`
					: `Selecione no máximo ${multiAllowed} opções.`;
			return;
		}
		multi = [...multi, optionId];
		validationError = null;
	}

	function toggleNone() {
		if (noneSelected) {
			noneSelected = false;
		} else {
			noneSelected = true;
			multi = [];
		}
		validationError = null;
	}
</script>

<div class="q">
	{#if node.imageKey}
		<img class="q-image" src={imageBase + node.imageKey} alt="" />
	{/if}

	<h2 class="q-title">{node.title}</h2>
	{#if node.description}
		<MarkdownContent source={node.description} class="q-desc" />
	{/if}

	{#if node.kind === 'question'}
		<div class="q-body">
			{#if node.type === 'text'}
				<textarea
					class="textarea"
					bind:value={text}
					placeholder="Escreva a sua resposta…"
					rows="3"
					oninput={() => (validationError = null)}
				></textarea>
			{:else if node.type === 'number'}
				<input
					class="input"
					type="number"
					bind:value={num}
					placeholder="Introduza um número"
					oninput={() => (validationError = null)}
				/>
			{:else if node.type === 'single'}
				<div class="options">
					{#each node.options ?? [] as opt (opt.id)}
						<button
							type="button"
							class="option"
							class:selected={single === opt.id}
							disabled={busy}
							onpointerup={(e) => handleOptionPointerUp(() => chooseSingle(opt.id), e)}
							onclick={() => handleOptionClick(() => chooseSingle(opt.id))}
						>
							{opt.label}
						</button>
					{/each}
				</div>
			{:else if node.type === 'multi'}
				{#if multiHint}
					<p class="multi-limit-hint">{multiHint}</p>
				{/if}
				<div class="options">
					{#each node.options ?? [] as opt (opt.id)}
						{@const selected = multi.includes(opt.id)}
						{@const atLimit = Boolean(multiAllowed && !selected && multi.length >= multiAllowed)}
						<button
							type="button"
							class="option"
							class:selected
							class:dimmed={atLimit || noneSelected}
							disabled={busy || atLimit || noneSelected}
							onpointerup={(e) => handleOptionPointerUp(() => toggleMulti(opt.id), e)}
							onclick={() => handleOptionClick(() => toggleMulti(opt.id))}
						>
							<span class="check" class:on={selected}></span>
							{opt.label}
						</button>
					{/each}
					{#if node.noneOfTheAbove}
						<button
							type="button"
							class="option"
							class:selected={noneSelected}
							disabled={busy}
							onpointerup={(e) => handleOptionPointerUp(toggleNone, e)}
							onclick={() => handleOptionClick(toggleNone)}
						>
							<span class="check" class:on={noneSelected}></span>
							Nenhuma das anteriores
						</button>
					{/if}
				</div>
			{:else if node.type === 'slider'}
				<div class="slider">
					<input
						type="range"
						min={node.range?.min ?? 0}
						max={node.range?.max ?? 100}
						step={node.range?.step ?? 1}
						bind:value={slider}
						oninput={() => (validationError = null)}
					/>
					<div class="slider-value">{slider}</div>
				</div>
			{/if}
		</div>
	{/if}

	<div class="q-actions">
		{#if canGoBack && onback}
			<button type="button" class="btn secondary" onclick={() => onback?.()} disabled={busy}>
				Voltar
			</button>
		{:else}
			<span></span>
		{/if}

		<span
			class="continue-wrap"
			role="group"
			data-required-hint={needsRequiredHint ? '' : undefined}
			onpointerdown={handleContinuePointerDown}
		>
			<button
				type="button"
				class="btn continue-btn"
				class:loading={busy}
				style={`--continue-progress-ms: ${CONTINUE_PROGRESS_MS}ms`}
				onclick={submit}
				disabled={isAutoAdvance || !canContinue}
				aria-describedby={needsRequiredHint ? 'required-continue-hint' : undefined}
				aria-busy={busy}
			>
				{#if busy}
					<span class="continue-muted" aria-hidden="true"></span>
					<span class="continue-fill" aria-hidden="true"></span>
					<span class="visually-hidden">A carregar…</span>
				{/if}
				<span class="continue-label">Continuar</span>
			</button>
			{#if needsRequiredHint}
				<span
					id="required-continue-hint"
					class="required-tooltip"
					class:visible={mobileRequiredTooltipVisible}
					role="tooltip"
				>
					Esta pergunta é obrigatória.
				</span>
			{/if}
		</span>
	</div>

	{#if validationError}
		<p class="hint error">{validationError}</p>
	{:else if node.kind === 'question' && node.type === 'multi' && multiLimit === 'exact' && multiAllowed && multi.length > 0 && multi.length !== multiAllowed}
		<p class="hint muted">Selecione exatamente {multiAllowed} opções para continuar.</p>
	{/if}
</div>

<style>
	.q {
		display: flex;
		flex-direction: column;
		animation: q-enter 250ms ease-out;
	}

	@keyframes q-enter {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.q {
			animation: none;
		}
	}

	/*
	 * Large touch-friendly controls for the public form runner.
	 * font-size stays >= 16px so mobile Safari never zooms the viewport on focus.
	 */
	.q :global(.input),
	.q :global(.textarea) {
		font-size: 1.125rem;
		padding: 0.9rem 1rem;
		border-radius: var(--radius);
	}
	.q :global(.input) {
		min-height: 3.25rem;
	}
	.q :global(.textarea) {
		min-height: 6rem;
	}
	.q :global(.btn) {
		font-size: 1.0625rem;
		padding: 0.9rem 1.6rem;
		min-height: 3.25rem;
		border-radius: var(--radius);
	}
	.q-image {
		width: 100%;
		max-height: 260px;
		object-fit: cover;
		border-radius: var(--radius);
		margin-bottom: 1.25rem;
	}
	.q-title {
		font-size: 1.5rem;
	}
	.q :global(.q-desc) {
		margin-top: -0.25rem;
	}
	.q-body {
		margin: 1.25rem 0;
	}
	.multi-limit-hint {
		margin: 0 0 0.75rem;
		font-size: 0.95rem;
		color: var(--text-muted);
	}
	.options {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-align: left;
		padding: 1.1rem 1.15rem;
		min-height: 3.5rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--surface);
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background 0.15s ease,
			opacity 0.15s ease;
		font-size: 1.125rem;
	}
	.option:hover:not(:disabled) {
		border-color: var(--primary);
		background: var(--surface-2);
	}
	.option.selected {
		border-color: var(--primary);
		background: var(--primary-soft);
	}
	.option.dimmed,
	.option:disabled:not(.selected) {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.check {
		width: 22px;
		height: 22px;
		border-radius: 6px;
		border: 1.5px solid var(--border);
		flex-shrink: 0;
		position: relative;
	}
	.check.on {
		background: var(--primary);
		border-color: var(--primary);
	}
	.check.on::after {
		content: '';
		position: absolute;
		left: 7px;
		top: 2px;
		width: 6px;
		height: 11px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
	}
	.slider {
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.slider input {
		flex: 1;
		height: 2rem;
		accent-color: var(--primary);
	}
	.slider-value {
		min-width: 3rem;
		text-align: center;
		font-weight: 650;
		font-size: 1.25rem;
		color: var(--primary);
	}
	.q-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		margin-top: 1rem;
	}
	.continue-wrap {
		position: relative;
		display: inline-flex;
	}
	.continue-wrap[data-required-hint] .btn:disabled {
		pointer-events: none;
	}
	.continue-btn {
		position: relative;
		overflow: hidden;
		isolation: isolate;
	}
	.continue-btn.loading:disabled {
		opacity: 1;
		cursor: wait;
		background: transparent;
	}
	.continue-muted,
	.continue-fill {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
	}
	.continue-muted {
		background: var(--primary);
		opacity: 0.55;
		z-index: 0;
	}
	.continue-fill {
		background: var(--primary);
		transform: scaleX(0);
		transform-origin: left center;
		z-index: 1;
	}
	.continue-btn.loading .continue-fill {
		animation: continue-progress var(--continue-progress-ms, 300ms) linear forwards;
	}
	.continue-label {
		position: relative;
		z-index: 2;
	}
	@keyframes continue-progress {
		to {
			transform: scaleX(1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.continue-btn.loading .continue-fill {
			animation: none;
			transform: scaleX(1);
		}
	}
	.required-tooltip {
		position: absolute;
		right: 0;
		bottom: calc(100% + 0.5rem);
		z-index: 20;
		width: max-content;
		max-width: min(18rem, 90vw);
		padding: 0.45rem 0.65rem;
		font-size: 0.85rem;
		line-height: 1.35;
		color: var(--text);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
		transition:
			opacity 0.15s ease,
			visibility 0.15s ease;
	}
	.required-tooltip.visible {
		opacity: 1;
		visibility: visible;
	}
	@media (hover: hover) and (pointer: fine) {
		.continue-wrap[data-required-hint]:hover .required-tooltip {
			opacity: 1;
			visibility: visible;
		}
	}
	.hint {
		font-size: 0.85rem;
		margin-top: 0.5rem;
	}
	.hint.error {
		color: var(--danger);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
