<script lang="ts">
	import { resolveIpfsUrl } from '../utils.js';
	import { DEFAULT_RENDER_3D_CID } from '../constants.js';

	interface GalleryImage {
		title?: string;
		caption?: string;
		url: string;
	}

	interface Props {
		galleryImages?: GalleryImage[];
		coverImage?: string | null;
		render3d?: string | null;
		ipfsGateway?: string;
	}

	let {
		galleryImages = [],
		coverImage = null,
		render3d = null,
		ipfsGateway = undefined
	}: Props = $props();

	let lightboxOpen = $state(false);
	let lightboxIndex = $state(0);

	// Build a unified list of all images, with the 3D render first
	const allImages = $derived.by(() => {
		const images: { title: string; caption: string; url: string; isRender?: boolean }[] = [];

		// 3D render (from metadata or default fallback)
		const renderCid = render3d || DEFAULT_RENDER_3D_CID;
		images.push({
			title: '3D Render',
			caption: 'Isometric 3D render of the asset facility',
			url: resolveIpfsUrl(renderCid, ipfsGateway),
			isRender: true
		});

		// Gallery images
		for (const img of galleryImages) {
			if (img.url) {
				images.push({
					title: img.title ?? 'Photo',
					caption: img.caption ?? '',
					url: resolveIpfsUrl(img.url, ipfsGateway)
				});
			}
		}

		// Cover image (if not already in gallery)
		if (coverImage) {
			const coverUrl = resolveIpfsUrl(coverImage, ipfsGateway);
			const alreadyIncluded = images.some((img) => img.url === coverUrl);
			if (!alreadyIncluded) {
				images.push({
					title: 'Cover',
					caption: 'Asset cover image',
					url: coverUrl
				});
			}
		}

		return images;
	});

	function openLightbox(index: number) {
		lightboxIndex = index;
		lightboxOpen = true;
	}

	function closeLightbox() {
		lightboxOpen = false;
	}

	function prevImage() {
		lightboxIndex = (lightboxIndex - 1 + allImages.length) % allImages.length;
	}

	function nextImage() {
		lightboxIndex = (lightboxIndex + 1) % allImages.length;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!lightboxOpen) return;
		if (e.key === 'Escape') closeLightbox();
		if (e.key === 'ArrowLeft') prevImage();
		if (e.key === 'ArrowRight') nextImage();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if allImages.length > 0}
	<div class="mv-image-viewer">
		<div class="mv-image-grid">
			{#each allImages as img, i}
				<button class="mv-image-thumb" class:mv-image-thumb--render={img.isRender} onclick={() => openLightbox(i)} aria-label="View {img.title}">
					<img src={img.url} alt={img.title} loading="lazy" />
					{#if img.isRender}
						<span class="mv-image-badge">3D</span>
					{/if}
					<span class="mv-image-title">{img.title}</span>
				</button>
			{/each}
		</div>
	</div>
{:else}
	<p class="mv-image-empty">No images available.</p>
{/if}

<!-- Lightbox / Full-page viewer -->
{#if lightboxOpen}
	<div class="mv-lightbox" role="dialog" aria-modal="true" aria-label="Image viewer">
		<button class="mv-lightbox-backdrop" onclick={closeLightbox} aria-label="Close"></button>
		<div class="mv-lightbox-content">
			<div class="mv-lightbox-header">
				<span class="mv-lightbox-title">{allImages[lightboxIndex].title}</span>
				<span class="mv-lightbox-counter">{lightboxIndex + 1} / {allImages.length}</span>
				<button class="mv-lightbox-close" onclick={closeLightbox} aria-label="Close">
					<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<div class="mv-lightbox-image-wrap">
				{#if allImages.length > 1}
					<button class="mv-lightbox-nav mv-lightbox-nav--prev" onclick={prevImage} aria-label="Previous">
						<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
						</svg>
					</button>
				{/if}
				<img
					src={allImages[lightboxIndex].url}
					alt={allImages[lightboxIndex].title}
					class="mv-lightbox-image"
				class:mv-lightbox-image--render={allImages[lightboxIndex].isRender}
				/>
				{#if allImages.length > 1}
					<button class="mv-lightbox-nav mv-lightbox-nav--next" onclick={nextImage} aria-label="Next">
						<svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
						</svg>
					</button>
				{/if}
			</div>
			{#if allImages[lightboxIndex].caption}
				<p class="mv-lightbox-caption">{allImages[lightboxIndex].caption}</p>
			{/if}
		</div>
	</div>
{/if}

<style>
	.mv-image-viewer {
		width: 100%;
	}

	.mv-image-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.mv-image-thumb {
		position: relative;
		aspect-ratio: 4 / 3;
		border-radius: 0.5rem;
		overflow: hidden;
		border: 1px solid var(--mv-border, #e2e8f0);
		background: var(--mv-bg-secondary, #f8fafc);
		cursor: pointer;
		padding: 0;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.mv-image-thumb:hover {
		border-color: var(--mv-accent, #233d80);
		box-shadow: 0 0 0 1px var(--mv-accent, #233d80);
	}

	.mv-image-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.mv-image-thumb--render {
		background: var(--mv-bg, #ffffff);
	}

	.mv-image-thumb--render img {
		object-fit: contain;
		mask-image: radial-gradient(ellipse 85% 80% at center, black 50%, transparent 100%);
		-webkit-mask-image: radial-gradient(ellipse 85% 80% at center, black 50%, transparent 100%);
	}

	.mv-image-badge {
		position: absolute;
		top: 6px;
		left: 6px;
		padding: 1px 6px;
		border-radius: 4px;
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		background: var(--mv-accent, #233d80);
		color: #ffffff;
	}

	.mv-image-title {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 4px 6px;
		font-size: 0.625rem;
		font-weight: 600;
		color: #ffffff;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
		text-align: left;
	}

	.mv-image-empty {
		font-size: 0.875rem;
		color: var(--mv-text-muted, #94a3b8);
	}

	/* Lightbox */
	.mv-lightbox {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.mv-lightbox-backdrop {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.85);
		border: none;
		cursor: pointer;
	}

	.mv-lightbox-content {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		max-width: 90vw;
		max-height: 90vh;
	}

	.mv-lightbox-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		color: rgba(255, 255, 255, 0.9);
	}

	.mv-lightbox-title {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.mv-lightbox-counter {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.5);
	}

	.mv-lightbox-close {
		margin-left: auto;
		padding: 4px;
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		transition: background 0.15s;
	}

	.mv-lightbox-close:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.mv-lightbox-image-wrap {
		position: relative;
		display: flex;
		align-items: center;
	}

	.mv-lightbox-image {
		max-width: 85vw;
		max-height: 75vh;
		object-fit: contain;
		border-radius: 0.5rem;
	}

	.mv-lightbox-image--render {
		mask-image: radial-gradient(ellipse 90% 85% at center, black 55%, transparent 100%);
		-webkit-mask-image: radial-gradient(ellipse 90% 85% at center, black 55%, transparent 100%);
	}

	.mv-lightbox-nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		padding: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		color: rgba(255, 255, 255, 0.8);
		cursor: pointer;
		transition: background 0.15s;
		z-index: 1;
	}

	.mv-lightbox-nav:hover {
		background: rgba(255, 255, 255, 0.25);
	}

	.mv-lightbox-nav--prev {
		left: -48px;
	}

	.mv-lightbox-nav--next {
		right: -48px;
	}

	.mv-lightbox-caption {
		margin-top: 0.5rem;
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.6);
		text-align: center;
	}

	@media (max-width: 768px) {
		.mv-image-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.mv-lightbox-nav--prev {
			left: 8px;
		}

		.mv-lightbox-nav--next {
			right: 8px;
		}

		.mv-lightbox-image {
			max-width: 95vw;
		}
	}
</style>
