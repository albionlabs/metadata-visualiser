<script lang="ts">
	import type { Snippet } from 'svelte';
	import { parseCoordinate } from '../utils.js';
	import type { VisualiserMetadata } from '../types.js';

	interface Props {
		description?: string | null;
		locationSummary?: string | null;
		metadata?: VisualiserMetadata | null;
		children?: Snippet;
	}

	let { description = null, locationSummary = null, metadata = null, children }: Props = $props();

	type JsonRecord = Record<string, unknown>;
	type LocationNode = JsonRecord & { coordinates?: JsonRecord };
	type CoordinatesRecord = JsonRecord & {
		lat?: unknown;
		latitude?: unknown;
		lng?: unknown;
		longitude?: unknown;
		long?: unknown;
	};

	const locationNode = $derived.by(() => {
		const loc = metadata?.decodedData;
		if (!loc || typeof loc !== 'object') return null;
		const asset = (loc as JsonRecord)?.asset as JsonRecord | undefined;
		return (asset?.location ?? null) as LocationNode | null;
	});

	const coordinatesNode = $derived(
		(locationNode?.coordinates ?? {}) as CoordinatesRecord
	);

	const latitude = $derived(
		parseCoordinate(coordinatesNode.lat ?? coordinatesNode.latitude)
	);

	const longitude = $derived(
		parseCoordinate(coordinatesNode.lng ?? coordinatesNode.longitude ?? coordinatesNode.long)
	);

	const googleMapsUrl = $derived.by(() => {
		if (latitude === null || longitude === null) return null;
		return `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
	});
</script>

<div class="mv-asset-description">
	<p>
		<span class="mv-asset-description__title">Underlying asset.</span>
		{#if description}
			{description}
		{:else}
			No asset description provided.
		{/if}
	</p>
	{#if locationSummary}
		<span class="mv-asset-description__location">
			Location: {locationSummary}
			{#if googleMapsUrl}
				<a
					href={googleMapsUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="mv-asset-description__maps-link"
				>
					View on Google Maps
				</a>
			{/if}
		</span>
	{/if}
	{#if children}
		{@render children()}
	{/if}
</div>

<style>
	.mv-asset-description {
		font-size: 0.875rem;
		color: var(--mv-text-secondary, #475569);
	}

	.mv-asset-description__title {
		font-weight: 600;
		color: var(--mv-text-primary, #0f172a);
	}

	.mv-asset-description__location {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-asset-description__maps-link {
		margin-left: 0.25rem;
		color: var(--mv-accent, #233d80);
	}

	.mv-asset-description__maps-link:hover {
		text-decoration: underline;
	}
</style>
