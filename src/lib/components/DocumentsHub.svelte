<script lang="ts">
	import { resolveIpfsUrl } from '../utils.js';

	interface Document {
		title?: string;
		description?: string;
		url?: string;
		type?: string;
	}

	interface Props {
		documents?: Document[];
		ipfsGateway?: string;
	}

	let { documents = [], ipfsGateway = undefined }: Props = $props();
</script>

{#if documents.length > 0}
	<div class="mv-docs-hub">
		<ul class="mv-docs-list">
			{#each documents as doc}
				<li class="mv-docs-item">
					<svg class="mv-docs-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
					</svg>
					<div class="mv-docs-info">
						<span class="mv-docs-title">{doc.title ?? 'Untitled Document'}</span>
						{#if doc.description}
							<span class="mv-docs-desc">{doc.description}</span>
						{/if}
						{#if doc.type}
							<span class="mv-docs-type">{doc.type}</span>
						{/if}
					</div>
					{#if doc.url}
						<a
							href={resolveIpfsUrl(doc.url, ipfsGateway)}
							target="_blank"
							rel="noopener noreferrer"
							class="mv-docs-link"
						>
							Open
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{:else}
	<p class="mv-docs-empty">No documents available.</p>
{/if}

<style>
	.mv-docs-hub {
		width: 100%;
	}

	.mv-docs-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.mv-docs-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid var(--mv-border, #e2e8f0);
		background: var(--mv-bg-secondary, #f8fafc);
	}

	.mv-docs-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-docs-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}

	.mv-docs-title {
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--mv-text-primary, #0f172a);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mv-docs-desc {
		font-size: 0.6875rem;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-docs-type {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-docs-link {
		flex-shrink: 0;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--mv-accent, #233d80);
		text-decoration: none;
	}

	.mv-docs-link:hover {
		text-decoration: underline;
	}

	.mv-docs-empty {
		font-size: 0.875rem;
		color: var(--mv-text-muted, #94a3b8);
	}
</style>
