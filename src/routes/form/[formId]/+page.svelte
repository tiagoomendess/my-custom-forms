<script lang="ts">
	import QuestionView from '$lib/components/QuestionView.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import type { AnswerValue, PublicNode } from '$lib/forms/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Load data is stable for the lifetime of this page; capture initial values.
	// svelte-ignore state_referenced_locally
	const initialNode = data.firstNode;
	// svelte-ignore state_referenced_locally
	const initialAssignments = data.assignments ?? {};

	type AnswerResponse = {
		submissionId: string | null;
		assignments: Record<string, string>;
		done: boolean;
		node?: PublicNode;
	};

	let history = $state<PublicNode[]>(initialNode ? [initialNode] : []);
	let index = $state(0);
	let values = $state<Record<string, AnswerValue>>({});
	let assignments = $state<Record<string, string>>(initialAssignments);
	let submissionId = $state<string | null>(null);
	let busy = $state(false);
	let finished = $state(false);
	let errorMsg = $state<string | null>(null);
	let linkCopied = $state(false);

	let current = $derived(history[index] ?? null);
	let coverUrl = $derived(
		data.coverImageKey ? `${data.origin}/img/${data.coverImageKey}` : null
	);
	let shareUrl = $derived(
		`${data.origin}/form/${data.formId}?source=after_sumition_share`
	);

	/** Floor for how long the Continue button stays in its loading state. */
	const MIN_ADVANCE_MS = 300;

	function wait(ms: number) {
		return new Promise<void>((resolve) => setTimeout(resolve, ms));
	}

	async function next(value: AnswerValue | undefined) {
		if (!current || busy || data.closed || data.alreadySubmitted) return;
		busy = true;
		errorMsg = null;
		const nodeId = current.id;
		if (value !== undefined) values[nodeId] = value;

		try {
			// Fire the save immediately; keep the spinner up for at least MIN_ADVANCE_MS
			// so the advance feels intentional even when the network is instant.
			const [payload] = await Promise.all([
				(async () => {
					const res = await fetch(`/form/${data.formId}/api`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							submissionId,
							nodeId,
							value: value ?? null,
							source: data.source,
							assignments
						})
					});
					if (!res.ok) throw new Error('Request failed');
					return (await res.json()) as AnswerResponse;
				})(),
				wait(MIN_ADVANCE_MS)
			]);

			submissionId = payload.submissionId ?? submissionId;
			assignments = payload.assignments ?? assignments;

			if (payload.done) {
				finished = true;
				return;
			}
			// Drop any forward history (in case the user had gone back) and advance.
			history = [...history.slice(0, index + 1), payload.node as PublicNode];
			index = history.length - 1;
		} catch {
			errorMsg = 'Ocorreu um erro ao guardar a sua resposta. Por favor, tente novamente.';
		} finally {
			busy = false;
		}
	}

	function back() {
		if (index > 0) index -= 1;
	}

	async function copyShareLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
		} catch {
			const input = document.createElement('input');
			input.value = shareUrl;
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			document.body.removeChild(input);
		}
		linkCopied = true;
		setTimeout(() => {
			linkCopied = false;
		}, 2000);
	}
</script>

<svelte:head>
	<title>{data.formName}</title>
	<meta property="og:title" content={data.formName} />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content={coverUrl ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={data.formName} />
	{#if coverUrl}
		<meta property="og:image" content={coverUrl} />
		<meta name="twitter:image" content={coverUrl} />
	{/if}
</svelte:head>

<div class="runner">
	<!-- Invisible chrome: reserves toggle height so the card never sits under it. -->
	<header class="topbar">
		<ThemeToggle />
	</header>

	<div class="main">
		<div class="card sheet">
			{#if data.closed}
				<div class="done">
					<h2>{data.formName}</h2>
					<p class="muted">Este formulário já não aceita respostas.</p>
				</div>
			{:else if data.alreadySubmitted}
				<div class="done">
					<h2>{data.formName}</h2>
					<p class="muted">Já respondeu a este formulário.</p>
				</div>
			{:else if finished}
				<div class="done">
					<div class="tick">✓</div>
					<h2>Obrigado!</h2>
					<p class="muted">A sua resposta foi registada.</p>
					<div class="share">
						<p class="share-label">Partilhar este formulário</p>
						<div class="share-row">
							<input class="input share-input" type="text" readonly value={shareUrl} />
							<button type="button" class="btn secondary sm" onclick={copyShareLink}>
								{linkCopied ? 'Copiado!' : 'Copiar'}
							</button>
						</div>
					</div>
				</div>
			{:else if !current}
				<div class="done">
					<h2>{data.formName}</h2>
					<p class="muted">Este formulário ainda não tem perguntas.</p>
				</div>
			{:else}
				{#if errorMsg}
					<div class="alert error">{errorMsg}</div>
				{/if}
				{#key current.id}
					<QuestionView
						node={current}
						initialValue={values[current.id]}
						canGoBack={index > 0}
						{busy}
						onnext={next}
						onback={back}
					/>
				{/key}
			{/if}
		</div>
		<p class="footer muted">{data.formName}</p>
	</div>
</div>

<style>
	.runner {
		/* svh avoids iOS first-paint dvh mis-measure that can push content off-screen */
		min-height: 100svh;
		display: flex;
		flex-direction: column;
	}

	@media (min-width: 640px) {
		.runner {
			min-height: 100dvh;
		}
	}

	.topbar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		flex-shrink: 0;
		min-height: 3.25rem;
		padding: 0.75rem 1rem 0;
		/* No background / border — layout only */
	}

	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1rem 1.5rem 1.5rem;
		gap: 1rem;
		min-height: 0;
	}

	.sheet {
		width: 100%;
		max-width: 560px;
		padding: 2.5rem;
	}
	.done {
		text-align: center;
		padding: 1.5rem 0;
	}
	.tick {
		width: 56px;
		height: 56px;
		margin: 0 auto 1rem;
		border-radius: 50%;
		background: var(--success-soft);
		color: var(--success);
		display: grid;
		place-items: center;
		font-size: 1.6rem;
		font-weight: 700;
	}
	.share {
		margin-top: 1.75rem;
		text-align: left;
	}
	.share-label {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		font-weight: 550;
	}
	.share-row {
		display: flex;
		gap: 0.5rem;
		align-items: stretch;
	}
	.share-input {
		flex: 1;
		min-width: 0;
		font-size: 0.85rem;
	}
	.footer {
		font-size: 0.8rem;
	}

	@media (max-width: 640px) {
		.topbar {
			padding: 0.75rem 0.75rem 0;
		}
		.main {
			padding: 0.75rem 0.75rem 1rem;
		}
		.sheet {
			padding: 1.25rem 1rem;
		}
	}
</style>
