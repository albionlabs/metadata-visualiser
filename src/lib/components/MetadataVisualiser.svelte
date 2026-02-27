<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { VisualiserMetadata } from '../types.js';
	import { getAssetNode, parseNumber, formatTimestamp } from '../utils.js';
	import TokenRightsBox from './TokenRightsBox.svelte';
	import AssetDescription from './AssetDescription.svelte';
	import StatsGrid from './StatsGrid.svelte';
	import ProductionChart from './ProductionChart.svelte';
	import RawDataModal from './RawDataModal.svelte';
	import AuditTrailModal from './AuditTrailModal.svelte';

	interface Props {
		latest: VisualiserMetadata | null;
		history?: VisualiserMetadata[];
		isLoading?: boolean;
		error?: string | null;

		// Content configuration
		tokenTermsUrl?: string | null;
		firstPaymentDate?: string | null;
		royaltyTooltip?: string | null;
		emptyMessage?: string;
		loadingMessage?: string;

		// Author display
		formatAddress?: (address: string) => string;

		// Callbacks
		onRetry?: () => void;

		// Display toggles
		showRawDataButton?: boolean;

		// Snippet injection points
		headerActions?: Snippet;
		tokenRightsExtra?: Snippet;
		descriptionExtra?: Snippet;
		afterStats?: Snippet;
		afterChart?: Snippet;
	}

	let {
		latest,
		history = [],
		isLoading = false,
		error = null,
		tokenTermsUrl = null,
		firstPaymentDate = null,
		royaltyTooltip = null,
		emptyMessage = 'No data available for this asset.',
		loadingMessage = 'Loading asset data...',
		formatAddress,
		onRetry,
		showRawDataButton = true,
		headerActions,
		tokenRightsExtra,
		descriptionExtra,
		afterStats,
		afterChart
	}: Props = $props();

	let showRawModal = $state(false);
	let showAuditModal = $state(false);

	function defaultFormatAddress(address: string): string {
		if (!address) return 'Unknown';
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	function displayAddress(address: string): string {
		return formatAddress ? formatAddress(address) : defaultFormatAddress(address);
	}

	// Derived metadata fields
	const assetDescription = $derived(
		(getAssetNode(['asset', 'description'], latest) as string) ??
			(latest?.decodedData?.description as string) ??
			null
	);

	const sharePercentage = $derived.by(() => {
		const raw =
			latest?.decodedData?.sharePercentage ?? getAssetNode(['sharePercentage'], latest);
		if (typeof raw === 'number' && raw > 0) return raw;
		if (typeof raw === 'string') {
			const parsed = parseFloat(raw);
			if (parsed > 0) return parsed;
		}
		return null;
	});

	const interestType = $derived.by(() => {
		const raw =
			getAssetNode(['asset', 'assetTerms', 'interestType'], latest) ??
			getAssetNode(['assetTerms', 'interestType'], latest);
		return typeof raw === 'string' && raw.trim().length ? raw : null;
	});

	const locationSummary = $derived.by(() => {
		const location = getAssetNode(['asset', 'location'], latest) as
			| Record<string, unknown>
			| undefined;
		if (!location) return null;
		const parts = [
			location?.county,
			location?.state,
			location?.province,
			location?.region,
			location?.country
		].filter((p): p is string => typeof p === 'string' && p.length > 0);
		return parts.length > 0 ? parts.join(', ') : null;
	});

	// Production metrics
	const plannedProjections = $derived.by(() => {
		const projections = getAssetNode(['asset', 'plannedProduction', 'projections'], latest);
		if (!Array.isArray(projections)) return [];
		return projections
			.map((entry) => {
				const record = entry as Record<string, unknown>;
				const productionValue = record?.production ?? record?.value ?? 0;
				return {
					month: typeof record?.month === 'string' ? record.month : null,
					production: parseNumber(productionValue)
				};
			})
			.filter((e) => e.month && e.production > 0);
	});

	const expectedBarrels = $derived.by(() => {
		const total = plannedProjections.reduce((acc, e) => acc + e.production, 0);
		return total > 0 ? total : null;
	});

	const uptimePercentage = $derived.by(() => {
		const raw = getAssetNode(
			['asset', 'operationalMetrics', 'uptime', 'percentage'],
			latest
		);
		if (typeof raw === 'number' && raw > 0) return raw;
		if (typeof raw === 'string') {
			const parsed = parseFloat(raw);
			if (parsed > 0) return parsed;
		}
		return null;
	});

	const incidentFreeDays = $derived.by(() => {
		const raw = getAssetNode(
			['asset', 'operationalMetrics', 'hseMetrics', 'incidentFreeDays'],
			latest
		);
		if (typeof raw === 'number' && raw > 0) return raw;
		if (typeof raw === 'string') {
			const parsed = parseFloat(raw);
			if (parsed > 0) return parsed;
		}
		return null;
	});
</script>

<div class="mv-root">
	<!-- Header -->
	<div class="mv-header">
		<div>
			<h2 class="mv-title">Asset Information</h2>
			{#if latest && !isLoading}
				<div class="mv-meta-info">
					<span>
						Updated: <span class="mv-meta-value">{formatTimestamp(latest.timestamp)}</span>
					</span>
					<span>
						Author: <span class="mv-meta-value mv-mono" title={latest.sender}
							>{displayAddress(latest.sender)}</span
						>
					</span>
					{#if history.length > 1}
						<button class="mv-audit-link" onclick={() => (showAuditModal = true)}>
							View audit trail ({history.length} updates)
						</button>
					{/if}
				</div>
			{/if}
		</div>
		<div class="mv-header-actions">
			{#if headerActions}
				{@render headerActions()}
			{/if}
			{#if showRawDataButton}
				<button
					class="mv-raw-btn"
					onclick={() => (showRawModal = true)}
					disabled={!latest || isLoading}
				>
					View raw data
				</button>
			{/if}
		</div>
	</div>

	<!-- States -->
	{#if isLoading}
		<p class="mv-loading">{loadingMessage}</p>
	{:else if error}
		<div class="mv-error">
			<div class="mv-error-content">
				<svg
					class="mv-error-icon"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				<div>
					<p class="mv-error-title">Failed to load asset data</p>
					<p class="mv-error-detail">{error}</p>
				</div>
			</div>
			{#if onRetry}
				<button class="mv-retry-btn" onclick={onRetry}>Retry</button>
			{/if}
		</div>
	{:else if !latest || latest.error}
		<p class="mv-empty">{emptyMessage}</p>
	{:else}
		<!-- Content -->
		<div class="mv-content">
			<TokenRightsBox
				{sharePercentage}
				{interestType}
				{tokenTermsUrl}
				{firstPaymentDate}
				{royaltyTooltip}
			>
				{#if tokenRightsExtra}
					{@render tokenRightsExtra()}
				{/if}
			</TokenRightsBox>

			<AssetDescription
				description={assetDescription}
				{locationSummary}
				metadata={latest}
			>
				{#if descriptionExtra}
					{@render descriptionExtra()}
				{/if}
			</AssetDescription>
		</div>

		<StatsGrid {expectedBarrels} {uptimePercentage} {incidentFreeDays} />

		{#if afterStats}
			{@render afterStats()}
		{/if}

		<ProductionChart metadata={latest} />

		{#if afterChart}
			{@render afterChart()}
		{/if}
	{/if}
</div>

<!-- Modals -->
<RawDataModal isOpen={showRawModal} entry={latest} onClose={() => (showRawModal = false)} />
<AuditTrailModal
	isOpen={showAuditModal}
	{history}
	{formatAddress}
	onClose={() => (showAuditModal = false)}
/>

<style>
	.mv-root {
		border-radius: var(--mv-radius, 1rem);
		border: 1px solid var(--mv-border, #e2e8f0);
		background: var(--mv-bg, #ffffff);
		padding: 1.5rem;
	}

	.mv-header {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	@media (min-width: 640px) {
		.mv-header {
			flex-direction: row;
			align-items: flex-start;
			justify-content: space-between;
		}
	}

	.mv-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--mv-text-primary, #0f172a);
	}

	.mv-meta-info {
		margin-top: 0.5rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.25rem 1rem;
		font-size: 0.75rem;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-meta-value {
		color: var(--mv-text-secondary, #475569);
	}

	.mv-mono {
		font-family: monospace;
	}

	.mv-audit-link {
		color: var(--mv-accent, #233d80);
		background: transparent;
		border: none;
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0;
	}

	.mv-audit-link:hover {
		text-decoration: underline;
	}

	.mv-header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mv-raw-btn {
		align-self: flex-start;
		border-radius: 9999px;
		border: 1px solid var(--mv-border, #e2e8f0);
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--mv-accent, #233d80);
		background: transparent;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.mv-raw-btn:hover:not(:disabled) {
		background: var(--mv-accent-bg, rgba(231, 235, 246, 0.4));
	}

	.mv-raw-btn:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	/* States */
	.mv-loading {
		margin-top: 1.5rem;
		font-size: 0.875rem;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-error {
		margin-top: 1.5rem;
		border-radius: 0.5rem;
		background: var(--mv-error-bg, rgba(239, 68, 68, 0.1));
		border: 1px solid color-mix(in srgb, var(--mv-error, #ef4444) 20%, transparent);
		padding: 1rem;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}

	.mv-error-content {
		display: flex;
		align-items: flex-start;
	}

	.mv-error-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		margin-right: 0.75rem;
		color: var(--mv-error, #ef4444);
	}

	.mv-error-title {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--mv-error, #ef4444);
	}

	.mv-error-detail {
		margin-top: 0.25rem;
		font-size: 0.75rem;
		color: color-mix(in srgb, var(--mv-error, #ef4444) 70%, transparent);
	}

	.mv-retry-btn {
		margin-left: 1rem;
		flex-shrink: 0;
		border-radius: 0.375rem;
		background: var(--mv-error-bg, rgba(239, 68, 68, 0.1));
		border: none;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--mv-error, #ef4444);
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.mv-retry-btn:hover {
		background: color-mix(in srgb, var(--mv-error, #ef4444) 20%, transparent);
	}

	.mv-empty {
		margin-top: 1.5rem;
		font-size: 0.875rem;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-content {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
</style>
