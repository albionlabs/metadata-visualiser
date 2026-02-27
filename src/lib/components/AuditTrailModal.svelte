<script lang="ts">
	import type { VisualiserMetadata } from '../types.js';
	import { formatTimestamp } from '../utils.js';

	interface Props {
		isOpen: boolean;
		history: VisualiserMetadata[];
		formatAddress?: (address: string) => string;
		onClose: () => void;
	}

	let { isOpen, history, formatAddress, onClose }: Props = $props();

	let selectedEntry = $state<VisualiserMetadata | null>(null);

	function defaultFormatAddress(address: string): string {
		if (!address) return 'Unknown';
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	function displayAddress(address: string): string {
		return formatAddress ? formatAddress(address) : defaultFormatAddress(address);
	}

	function handleClose() {
		selectedEntry = null;
		onClose();
	}

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

{#if isOpen}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<!-- svelte-ignore a11y_interactive_supports_focus -->
	<div
		class="mv-modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="mv-audit-modal-title"
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
	>
		<div class="mv-modal-backdrop" aria-hidden="true"></div>
		<div
			role="none"
			class="mv-modal-container"
			onclick={(e) => {
				if (e.target === e.currentTarget) handleClose();
			}}
		>
			<div class="mv-modal-panel mv-modal-panel--wide">
				<div class="mv-modal-header">
					<h3 id="mv-audit-modal-title" class="mv-modal-title">
						{#if selectedEntry}
							<button
								class="mv-audit-back-btn"
								onclick={() => (selectedEntry = null)}
								aria-label="Back to audit trail list"
							>
								<svg
									class="mv-audit-back-icon"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 19l-7-7 7-7"
									/>
								</svg>
							</button>
							Data Details
						{:else}
							Audit Trail
						{/if}
					</h3>
					<button class="mv-modal-close-btn" aria-label="Close modal" onclick={handleClose}>
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
				<div class="mv-modal-body">
					{#if selectedEntry}
						<!-- Detail View -->
						<div class="mv-audit-detail">
							<div class="mv-audit-detail-grid">
								<div>
									<p class="mv-modal-field-label">Date/Time</p>
									<p class="mv-modal-field-value">
										{formatTimestamp(selectedEntry.timestamp)}
									</p>
								</div>
								<div>
									<p class="mv-modal-field-label">Author</p>
									<p class="mv-modal-field-value mv-modal-mono">{selectedEntry.sender}</p>
								</div>
							</div>
							<div>
								<p class="mv-modal-field-label">Meta Hash</p>
								<p class="mv-modal-field-value mv-modal-mono mv-modal-break-all">
									{selectedEntry.metaHash}
								</p>
							</div>
							{#if selectedEntry.schemaHash}
								<div>
									<p class="mv-modal-field-label">Schema Hash</p>
									<p class="mv-modal-field-value mv-modal-mono mv-modal-break-all">
										{selectedEntry.schemaHash}
									</p>
								</div>
							{/if}
							<div>
								<div class="mv-audit-code-header">
									<p class="mv-modal-field-label">Raw JSON Data</p>
									<div class="mv-audit-code-actions">
										<button
											class="mv-modal-action-btn mv-modal-action-btn--small"
											onclick={() =>
												copyToClipboard(
													JSON.stringify(selectedEntry?.decodedData, null, 2)
												)}
										>
											Copy
										</button>
										<button
											class="mv-modal-action-btn mv-modal-action-btn--small"
											onclick={() => selectedEntry && exportAsJson(selectedEntry)}
										>
											Download
										</button>
									</div>
								</div>
								<pre class="mv-modal-code">{JSON.stringify(
										selectedEntry.decodedData,
										null,
										2
									)}</pre>
							</div>
						</div>
					{:else}
						<!-- List View -->
						<p class="mv-audit-intro">
							Complete history of data updates for this asset, most recent first.
						</p>
						<div class="mv-audit-list">
							{#each history as entry, index (entry.id)}
								<div class="mv-audit-item">
									<div class="mv-audit-item-info">
										<div class="mv-audit-item-row">
											<div class="mv-audit-badge">
												{index === 0 ? 'Latest' : `#${history.length - index}`}
											</div>
											<div>
												<p class="mv-audit-item-date">
													{formatTimestamp(entry.timestamp)}
												</p>
												<p class="mv-audit-item-author" title={entry.sender}>
													By: {displayAddress(entry.sender)}
												</p>
											</div>
										</div>
									</div>
									<button
										class="mv-audit-view-btn"
										onclick={() => (selectedEntry = entry)}
									>
										View Data
									</button>
								</div>
							{/each}
						</div>
					{/if}
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

	.mv-modal-panel--wide {
		max-width: 56rem;
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
		display: flex;
		align-items: center;
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

	.mv-modal-action-btn--small {
		padding: 0.25rem 0.75rem;
		font-size: 0.75rem;
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

	/* Audit-specific styles */

	.mv-audit-back-btn {
		margin-right: 0.5rem;
		color: var(--mv-text-muted, #94a3b8);
		background: transparent;
		border: none;
		cursor: pointer;
	}

	.mv-audit-back-btn:hover {
		color: var(--mv-text-primary, #0f172a);
	}

	.mv-audit-back-icon {
		display: inline;
		width: 1.25rem;
		height: 1.25rem;
	}

	.mv-audit-intro {
		margin-bottom: 1rem;
		font-size: 0.875rem;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-audit-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.mv-audit-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-radius: 0.75rem;
		border: 1px solid var(--mv-border, #e2e8f0);
		background: var(--mv-bg-secondary, #f8fafc);
		padding: 0.75rem 1rem;
		transition: border-color 0.15s;
	}

	.mv-audit-item:hover {
		border-color: var(--mv-text-muted, #94a3b8);
	}

	.mv-audit-item-info {
		flex: 1;
	}

	.mv-audit-item-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.mv-audit-badge {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--mv-accent-bg, rgba(231, 235, 246, 0.4));
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--mv-accent, #233d80);
	}

	.mv-audit-item-date {
		font-size: 0.875rem;
		color: var(--mv-text-primary, #0f172a);
	}

	.mv-audit-item-author {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-audit-view-btn {
		border-radius: 0.5rem;
		border: 1px solid var(--mv-border, #e2e8f0);
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--mv-accent, #233d80);
		background: transparent;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.mv-audit-view-btn:hover {
		background: var(--mv-accent-bg, rgba(231, 235, 246, 0.4));
	}

	.mv-audit-detail {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.mv-audit-detail-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.mv-audit-code-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.mv-audit-code-actions {
		display: flex;
		gap: 0.5rem;
	}
</style>
