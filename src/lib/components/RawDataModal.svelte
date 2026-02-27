<script lang="ts">
	import type { VisualiserMetadata } from '../types.js';

	interface Props {
		isOpen: boolean;
		entry: VisualiserMetadata | null;
		onClose: () => void;
	}

	let { isOpen, entry, onClose }: Props = $props();

	$effect(() => {
		if (isOpen) {
			document.body.style.overflow = 'hidden';
			return () => {
				document.body.style.overflow = '';
			};
		}
	});

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch (err) {
			console.error('Failed to copy:', err);
		}
	}

	function exportAsJson(data: VisualiserMetadata) {
		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `asset-data-${data.id.slice(0, 8)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

{#if isOpen && entry}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="mv-modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="mv-raw-modal-title"
		onkeydown={(e) => e.key === 'Escape' && onClose()}
	>
		<div class="mv-modal-backdrop" aria-hidden="true"></div>
		<div
			role="none"
			class="mv-modal-container"
			onclick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div class="mv-modal-panel">
				<div class="mv-modal-header">
					<h3 id="mv-raw-modal-title" class="mv-modal-title">Raw Data</h3>
					<div class="mv-modal-actions">
						<button
							class="mv-modal-action-btn"
							onclick={() => copyToClipboard(JSON.stringify(entry, null, 2))}
						>
							Copy
						</button>
						<button class="mv-modal-action-btn" onclick={() => entry && exportAsJson(entry)}>
							Export
						</button>
						<button class="mv-modal-close-btn" aria-label="Close modal" onclick={onClose}>
							<svg class="mv-modal-close-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				</div>
				<div class="mv-modal-body">
					<div class="mv-modal-field">
						<p class="mv-modal-field-label">Editor</p>
						<p class="mv-modal-field-value mv-modal-mono">{entry.sender}</p>
					</div>
					<div class="mv-modal-field">
						<p class="mv-modal-field-label">Meta Hash</p>
						<p class="mv-modal-field-value mv-modal-mono mv-modal-break-all">{entry.metaHash}</p>
					</div>
					{#if entry.schemaHash}
						<div class="mv-modal-field">
							<p class="mv-modal-field-label">Schema Hash</p>
							<p class="mv-modal-field-value mv-modal-mono mv-modal-break-all">
								{entry.schemaHash}
							</p>
						</div>
					{/if}
					<div class="mv-modal-field">
						<p class="mv-modal-field-label">Decoded Data</p>
						<pre class="mv-modal-code">{JSON.stringify(entry.decodedData, null, 2)}</pre>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.mv-modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		overflow-y: auto;
	}

	.mv-modal-backdrop {
		position: fixed;
		inset: 0;
		background: var(--mv-backdrop, rgba(0, 0, 0, 0.5));
		backdrop-filter: blur(4px);
	}

	.mv-modal-container {
		position: relative;
		display: flex;
		min-height: 100%;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.mv-modal-panel {
		position: relative;
		width: 100%;
		max-width: 48rem;
		border-radius: var(--mv-radius, 1rem);
		border: 1px solid var(--mv-border, #e2e8f0);
		background: var(--mv-bg, #ffffff);
		box-shadow:
			0 20px 25px -5px rgba(0, 0, 0, 0.1),
			0 8px 10px -6px rgba(0, 0, 0, 0.1);
	}

	.mv-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid var(--mv-border, #e2e8f0);
		padding: 1rem 1.5rem;
	}

	.mv-modal-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--mv-text-primary, #0f172a);
	}

	.mv-modal-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mv-modal-action-btn {
		border-radius: 0.5rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.875rem;
		color: var(--mv-accent, #233d80);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.mv-modal-action-btn:hover {
		background: var(--mv-accent-bg, rgba(231, 235, 246, 0.4));
	}

	.mv-modal-close-btn {
		border-radius: 0.5rem;
		padding: 0.5rem;
		color: var(--mv-text-muted, #94a3b8);
		background: transparent;
		border: none;
		cursor: pointer;
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.mv-modal-close-btn:hover {
		background: var(--mv-bg-secondary, #f8fafc);
		color: var(--mv-text-primary, #0f172a);
	}

	.mv-modal-close-icon {
		width: 1.25rem;
		height: 1.25rem;
	}

	.mv-modal-body {
		max-height: 60vh;
		overflow-y: auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.mv-modal-field-label {
		margin-bottom: 0.25rem;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-modal-field-value {
		font-size: 0.875rem;
		color: var(--mv-text-primary, #0f172a);
	}

	.mv-modal-mono {
		font-family: monospace;
	}

	.mv-modal-break-all {
		word-break: break-all;
	}

	.mv-modal-code {
		margin-top: 0.5rem;
		max-height: 20rem;
		overflow: auto;
		border-radius: 0.5rem;
		background: var(--mv-bg-tertiary, #f1f5f9);
		padding: 1rem;
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--mv-text-secondary, #475569);
	}
</style>
