<script lang="ts">
	import { Toggle } from 'flowbite-svelte';

	let {
		formId,
		coverImageKey = $bindable(null as string | null),
		allowSubmitUntilLocal = $bindable(''),
		allowMultipleSubmits = $bindable(true)
	}: {
		formId: string;
		coverImageKey: string | null;
		/** `datetime-local` value (local wall time), empty = no deadline. */
		allowSubmitUntilLocal: string;
		allowMultipleSubmits: boolean;
	} = $props();

	let uploading = $state(false);
	let uploadError = $state<string | null>(null);

	async function upload(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		uploadError = null;
		try {
			const body = new FormData();
			body.set('file', file);
			const res = await fetch(`/admin/forms/${formId}/upload`, { method: 'POST', body });
			if (!res.ok) throw new Error('upload failed');
			const { key } = (await res.json()) as { key: string };
			coverImageKey = key;
		} catch {
			uploadError = 'Upload failed. Use a JPG, PNG, WEBP or GIF under 5 MB.';
		} finally {
			uploading = false;
			input.value = '';
		}
	}
</script>

<div class="settings">
	<h4>Settings</h4>

	<div class="field">
		<label for="cover">Cover picture</label>
		<p class="hint muted">Used when the form link is shared on social media or chats.</p>
		{#if coverImageKey}
			<div class="image-preview">
				<img src={`/img/${coverImageKey}`} alt="" />
				<button type="button" class="btn ghost sm" onclick={() => (coverImageKey = null)}>
					Remove
				</button>
			</div>
		{/if}
		<input id="cover" type="file" accept="image/*" onchange={upload} disabled={uploading} />
		{#if uploading}<p class="muted">Uploading…</p>{/if}
		{#if uploadError}<p class="alert error">{uploadError}</p>{/if}
	</div>

	<div class="field">
		<label for="deadline">Allow submit until</label>
		<p class="hint muted">After this date and time, the form stops accepting responses. Leave empty for no deadline.</p>
		<input
			id="deadline"
			class="input"
			type="datetime-local"
			bind:value={allowSubmitUntilLocal}
		/>
	</div>

	<div class="field">
		<p class="hint muted">
			When off, the form tries to block people who already finished from submitting again
			(same browser cookie, or matching IP and user agent). Not identity-proof.
		</p>
		<Toggle
			size="small"
			color="indigo"
			checked={allowMultipleSubmits}
			onchange={(e) => (allowMultipleSubmits = e.currentTarget.checked)}
		>
			Allow multiple submits
		</Toggle>
	</div>
</div>

<style>
	.settings {
		margin-top: 1.25rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		padding: 1.25rem;
	}
	.settings h4 {
		margin: 0 0 1rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}
	.hint {
		font-size: 0.8rem;
		margin: 0 0 0.5rem;
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
		object-fit: cover;
	}
</style>
