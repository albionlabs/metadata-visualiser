<script lang="ts">
	import type { VisualiserMetadata } from '../types.js';
	import { getAssetNode } from '../utils.js';
	import ImageViewer from './ImageViewer.svelte';
	import DocumentsHub from './DocumentsHub.svelte';

	interface Props {
		metadata: VisualiserMetadata | null;
		ipfsGateway?: string;
	}

	let { metadata, ipfsGateway = undefined }: Props = $props();

	type TabId = 'images' | 'documents';
	let activeTab: TabId = $state('images');

	const galleryImages = $derived.by(() => {
		const imgs = getAssetNode(['asset', 'galleryImages'], metadata);
		if (!Array.isArray(imgs)) return [];
		return imgs as { title?: string; caption?: string; url: string }[];
	});

	const coverImage = $derived.by(() => {
		const cover = getAssetNode(['asset', 'coverImage'], metadata);
		return typeof cover === 'string' ? cover : null;
	});

	const render3d = $derived.by(() => {
		const render = getAssetNode(['asset', 'render3d'], metadata);
		return typeof render === 'string' ? render : null;
	});

	const documents = $derived.by(() => {
		const docs = getAssetNode(['asset', 'documents'], metadata);
		if (!Array.isArray(docs)) return [];
		return docs as { title?: string; description?: string; url?: string; type?: string }[];
	});

	const hasImages = $derived(galleryImages.length > 0 || coverImage !== null || true); // always true — fallback render
	const hasDocuments = $derived(documents.length > 0);
</script>

<div class="mv-media-tabs">
	<div class="mv-media-tabs__bar">
		<button
			class="mv-media-tabs__tab"
			class:mv-media-tabs__tab--active={activeTab === 'images'}
			onclick={() => (activeTab = 'images')}
		>
			<svg class="mv-media-tabs__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
			</svg>
			Images
		</button>
		<button
			class="mv-media-tabs__tab"
			class:mv-media-tabs__tab--active={activeTab === 'documents'}
			onclick={() => (activeTab = 'documents')}
		>
			<svg class="mv-media-tabs__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
			</svg>
			Documents
			{#if hasDocuments}
				<span class="mv-media-tabs__count">{documents.length}</span>
			{/if}
		</button>
	</div>

	<div class="mv-media-tabs__content">
		{#if activeTab === 'images'}
			<ImageViewer
				{galleryImages}
				{coverImage}
				{render3d}
				{ipfsGateway}
			/>
		{:else}
			<DocumentsHub {documents} {ipfsGateway} />
		{/if}
	</div>
</div>

<style>
	.mv-media-tabs {
		margin-top: 1.5rem;
		border: 1px solid var(--mv-border, #e2e8f0);
		border-radius: var(--mv-radius, 1rem);
		overflow: hidden;
	}

	.mv-media-tabs__bar {
		display: flex;
		border-bottom: 1px solid var(--mv-border, #e2e8f0);
		background: var(--mv-bg-secondary, #f8fafc);
	}

	.mv-media-tabs__tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		padding: 0.625rem 1rem;
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--mv-text-muted, #94a3b8);
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}

	.mv-media-tabs__tab:hover {
		color: var(--mv-text-secondary, #475569);
	}

	.mv-media-tabs__tab--active {
		color: var(--mv-accent, #233d80);
		border-bottom-color: var(--mv-accent, #233d80);
	}

	.mv-media-tabs__icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.mv-media-tabs__count {
		font-size: 0.625rem;
		font-weight: 700;
		padding: 0 5px;
		border-radius: 9999px;
		background: var(--mv-accent-bg, rgba(231, 235, 246, 0.4));
		color: var(--mv-accent, #233d80);
	}

	.mv-media-tabs__content {
		padding: 1rem;
		background: var(--mv-bg, #ffffff);
	}
</style>
