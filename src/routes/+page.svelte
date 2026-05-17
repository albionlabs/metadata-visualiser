<script lang="ts">
	import MetadataVisualiser from '$lib/components/MetadataVisualiser.svelte';
	import SensitivityMatrix from '$lib/components/SensitivityMatrix.svelte';
	import type { VisualiserMetadata } from '$lib/types.js';
	import { FIXTURE_FLAT_PRODUCTION } from '../../tests/fixtures/tokens';

	// Mock data for development sandbox
	const mockMetadata: VisualiserMetadata = {
		id: 'mock-entry-001',
		metaHash: '0xabc123def456789abc123def456789abc123def456789abc123def456789abcd',
		sender: '0x1234567890abcdef1234567890abcdef12345678',
		subject: '0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12',
		schemaHash: '0xschema123',
		decodedData: {
			sharePercentage: 2.5,
			asset: {
				description:
					'Oil and gas production well located in the Permian Basin, Texas. This well produces light sweet crude oil and associated natural gas from the Wolfcamp formation.',
				location: {
					county: 'Midland',
					state: 'Texas',
					country: 'USA',
					coordinates: {
						lat: 31.9686,
						lng: -102.0779
					}
				},
				assetTerms: {
					interestType: 'royalty'
				},
				operationalMetrics: {
					uptime: { percentage: 97.3 },
					hseMetrics: { incidentFreeDays: 245 }
				},
				plannedProduction: {
					projections: [
						{ month: '2025-01', production: 1200 },
						{ month: '2025-02', production: 1180 },
						{ month: '2025-03', production: 1150 },
						{ month: '2025-04', production: 1120 },
						{ month: '2025-05', production: 1100 },
						{ month: '2025-06', production: 1080 }
					]
				},
				historicalProduction: [
					{ month: '2024-07', production: 1350 },
					{ month: '2024-08', production: 1310 },
					{ month: '2024-09', production: 1290 },
					{ month: '2024-10', production: 1260 },
					{ month: '2024-11', production: 1240 },
					{ month: '2024-12', production: 1220 }
				]
			}
		},
		schema: null,
		raw: {
			id: 'mock-entry-001',
			meta: '',
			sender: '0x1234567890abcdef1234567890abcdef12345678',
			subject: '0x000000000000000000000000abcdef1234567890abcdef1234567890abcdef12',
			metaHash: '0xabc123def456789abc123def456789abc123def456789abc123def456789abcd'
		},
		timestamp: Math.floor(Date.now() / 1000) - 86400
	};

	const mockHistory: VisualiserMetadata[] = [
		mockMetadata,
		{
			...mockMetadata,
			id: 'mock-entry-002',
			sender: '0xfedcba0987654321fedcba0987654321fedcba09',
			timestamp: Math.floor(Date.now() / 1000) - 86400 * 7
		},
		{
			...mockMetadata,
			id: 'mock-entry-003',
			sender: '0x1234567890abcdef1234567890abcdef12345678',
			timestamp: Math.floor(Date.now() / 1000) - 86400 * 30
		}
	];

	let darkMode = $state(false);

	// SensitivityMatrix preview state (Phase 12 verification — D-13)
	let markWti = $state(82);
</script>

<div class="sandbox" class:dark={darkMode}>
	<div class="controls">
		<h1>Metadata Visualiser — Dev Sandbox</h1>
		<label>
			<input type="checkbox" bind:checked={darkMode} />
			Dark mode
		</label>
	</div>

	<div
		class="demo-wrapper"
		style={darkMode
			? `
			--mv-bg: rgba(13,27,58,0.5);
			--mv-bg-secondary: rgba(10,21,40,0.5);
			--mv-bg-tertiary: rgba(15,23,42,1);
			--mv-text-primary: #ffffff;
			--mv-text-secondary: rgba(255,255,255,0.7);
			--mv-text-muted: rgba(255,255,255,0.4);
			--mv-border: rgba(255,255,255,0.1);
			--mv-accent: #08bccc;
			--mv-accent-bg: rgba(8,188,204,0.1);
			--mv-accent-border: rgba(8,188,204,0.3);
			--mv-chart-actual: #10b981;
			--mv-chart-forecast: #38bdf8;
			--mv-chart-grid: rgba(255,255,255,0.1);
			--mv-chart-text: rgba(255,255,255,0.5);
			--mv-backdrop: rgba(0,0,0,0.75);
			--mv-error: #ef4444;
			--mv-error-bg: rgba(239,68,68,0.1);
		`
			: ''}
	>
		<MetadataVisualiser
			latest={mockMetadata}
			history={mockHistory}
			tokenTermsUrl="https://example.com/token-terms"
			firstPaymentDate="January 2024"
			royaltyTooltip="A royalty share means distributions are paid before operating costs."
			formatAddress={(addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`}
		>
			{#snippet headerActions()}
				<button
					style="
					border-radius: 9999px;
					border: 1px solid var(--mv-accent, #233d80);
					background: var(--mv-accent-bg, rgba(231,235,246,0.4));
					padding: 0.5rem 1rem;
					font-size: 0.875rem;
					font-weight: 600;
					color: var(--mv-accent, #233d80);
					cursor: pointer;
				"
				>
					Update
				</button>
			{/snippet}
		</MetadataVisualiser>
	</div>

	<section class="demo-section">
		<h2>SensitivityMatrix preview (Phase 12)</h2>
		<label>
			markWti:
			<input type="number" bind:value={markWti} min="40" max="120" step="1" />
		</label>

		<div class="albion-sensitivity-mount">
			<SensitivityMatrix
				tokenMetadata={FIXTURE_FLAT_PRODUCTION}
				mintedSupply={100_000}
				tokenPrice={1.0}
				discountRate={0.1}
				{markWti}
			/>
		</div>
	</section>
</div>

<style>
	.sandbox {
		min-height: 100vh;
		padding: 2rem;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
		background: #f8fafc;
		color: #0f172a;
	}

	.sandbox.dark {
		background: #0d1b3a;
		color: #ffffff;
	}

	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 2rem;
	}

	.controls h1 {
		font-size: 1.5rem;
		font-weight: 700;
	}

	.controls label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.demo-wrapper {
		max-width: 56rem;
		margin: 0 auto;
	}

	.demo-section {
		max-width: 56rem;
		margin: 32px auto 0;
		padding: 24px;
		background: #080e1a;
		color: #f1f5f9;
		border-radius: 16px;
	}

	.demo-section h2 {
		font-family: system-ui, sans-serif;
		font-size: 18px;
		font-weight: 600;
		margin: 0 0 12px;
	}

	.demo-section label {
		display: block;
		margin-bottom: 16px;
		font-family: system-ui, sans-serif;
		font-size: 12px;
		color: #94a3b8;
	}

	.demo-section input {
		margin-left: 8px;
		padding: 4px 8px;
		font-size: 12px;
		background: #131c2e;
		color: #f1f5f9;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 6px;
	}

	/* Phase 10 token mapping per UI-SPEC §"Consumer overrides".
	   albion.dex Phase 14 will reapply these via theme() in Tailwind. */
	.albion-sensitivity-mount {
		--mv-sens-cell: #f1f5f9;
		--mv-sens-hot: #4ade80;
		--mv-sens-hot-bg: rgba(74, 222, 128, 0.06);
		--mv-sens-cold: #f87171;
		--mv-sens-cold-bg: rgba(248, 113, 113, 0.06);
		--mv-sens-mark: #d4a853;
		--mv-sens-mark-bg: rgba(212, 168, 83, 0.14);
		--mv-sens-mark-border: #8a6f37;
		--mv-sens-avg-text: #64748b;
		--mv-sens-line: rgba(255, 255, 255, 0.06);
		--mv-sens-hdr-bg: rgba(19, 32, 64, 0.5);
		--mv-text-muted: #94a3b8;
		--mv-text-primary: #f1f5f9;
		--mv-font-sans: 'Inter Tight', system-ui, sans-serif;
		--mv-font-mono: 'IBM Plex Mono', ui-monospace, monospace;
	}
</style>
