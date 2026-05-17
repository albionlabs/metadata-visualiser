<script lang="ts">
	import { computeSensitivityMatrix } from '../returns.js';
	import type {
		ReturnsMetadata,
		SensitivityMatrixOutput,
		SensitivityCell
	} from '../returns.js';

	interface Props {
		tokenMetadata: ReturnsMetadata;
		mintedSupply: number;
		tokenPrice: number;
		/** DECIMAL (e.g. 0.10 for 10%); converted ×100 internally for the calc API. */
		discountRate: number;
		markWti?: number | null;
		markHoldYears?: number;
		wtiBuckets?: readonly number[];
		holdPeriods?: readonly number[];
		hotThreshold?: number;
		coldThreshold?: number;
		numberOfTokens?: number;
	}

	let {
		tokenMetadata,
		mintedSupply,
		tokenPrice,
		discountRate,
		markWti = null,
		markHoldYears = 6,
		wtiBuckets = [60, 70, 80, 90, 100],
		holdPeriods = [2, 4, 6, 8],
		hotThreshold = 14,
		coldThreshold = 8,
		numberOfTokens = 1
	}: Props = $props();

	type Computed =
		| { ok: true; out: SensitivityMatrixOutput }
		| { ok: false; error: string };

	const computed: Computed = $derived.by(() => {
		try {
			const out = computeSensitivityMatrix({
				tokenMetadata,
				mintedSupply,
				tokenPrice,
				discountRate: discountRate * 100, // UNIT: decimal→percent for calc API
				wtiBuckets,
				holdPeriods,
				numberOfTokens
			});
			return { ok: true, out };
		} catch {
			return {
				ok: false,
				error: 'Unable to compute sensitivity matrix. Check token metadata.'
			};
		}
	});

	// Closest-bucket rounding for the mark cell. Ties broken by lowest WTI
	// (first iteration of the array wins because we only replace on strictly-less).
	const markBucket: number = $derived.by(() => {
		if (markWti == null || !Number.isFinite(markWti)) {
			return wtiBuckets.includes(80)
				? 80
				: wtiBuckets[Math.floor(wtiBuckets.length / 2)];
		}
		let best = wtiBuckets[0];
		let bestDiff = Math.abs(wtiBuckets[0] - markWti);
		for (const b of wtiBuckets) {
			const d = Math.abs(b - markWti);
			if (d < bestDiff) {
				best = b;
				bestDiff = d;
			}
		}
		return best;
	});

	function cellClass(cell: SensitivityCell): string {
		if (cell.wti === markBucket && cell.holdYears === markHoldYears) {
			return 'mv-sensitivity-matrix__cell mv-sensitivity-matrix__cell--mark';
		}
		if (!Number.isFinite(cell.irr) || cell.irr === -99) {
			return 'mv-sensitivity-matrix__cell mv-sensitivity-matrix__cell--empty';
		}
		if (cell.irr >= hotThreshold) {
			return 'mv-sensitivity-matrix__cell mv-sensitivity-matrix__cell--hot';
		}
		if (cell.irr < coldThreshold) {
			return 'mv-sensitivity-matrix__cell mv-sensitivity-matrix__cell--cold';
		}
		return 'mv-sensitivity-matrix__cell';
	}

	function fmtCell(irr: number): string {
		if (!Number.isFinite(irr) || irr === -99) return '—';
		return `${irr.toFixed(1)}%`;
	}
</script>

<section class="mv-sensitivity-matrix">
	<h3 class="mv-sensitivity-matrix__title">Price sensitivity · IRR at purchase</h3>
	<p class="mv-sensitivity-matrix__lede">
		Highlighted cell = base case (6-year hold, strip pricing).
	</p>

	{#if !computed.ok}
		<div class="mv-sensitivity-matrix__error">{computed.error}</div>
	{:else}
		<div class="mv-sensitivity-matrix__grid" role="table">
			<div class="mv-sensitivity-matrix__hdr mv-sensitivity-matrix__rowhdr">
				WTI ↓ / Hold →
			</div>
			{#each holdPeriods as y (y)}
				<div class="mv-sensitivity-matrix__hdr">{y}Y</div>
			{/each}
			<div class="mv-sensitivity-matrix__hdr">Avg 30Y</div>

			{#each wtiBuckets as wti (wti)}
				<div class="mv-sensitivity-matrix__rowhdr">${wti}/bbl</div>
				{#each holdPeriods as holdYears (holdYears)}
					{@const c =
						computed.out.cells.find(
							(x) => x.wti === wti && x.holdYears === holdYears
						) ?? { wti, holdYears, irr: NaN }}
					<div
						class={cellClass(c)}
						data-testid="sensitivity-cell-{wti}-{holdYears}"
					>
						{fmtCell(c.irr)}
					</div>
				{/each}
				{@const avg =
					computed.out.rowAverages.find((r) => r.wti === wti)?.avgIrr ?? NaN}
				<div class="mv-sensitivity-matrix__cell mv-sensitivity-matrix__cell--avg">
					{fmtCell(avg)}
				</div>
			{/each}
		</div>
	{/if}
</section>

<style>
	.mv-sensitivity-matrix__title {
		font-family: var(--mv-font-sans, system-ui, sans-serif);
		font-size: 20px;
		font-weight: 500;
		line-height: 1.2;
		margin: 0 0 8px 0;
	}
	.mv-sensitivity-matrix__lede {
		font-family: var(--mv-font-sans, system-ui, sans-serif);
		font-size: 12px;
		line-height: 1.5;
		color: var(--mv-text-muted, #94a3b8);
		margin: 0 0 16px 0;
	}
	.mv-sensitivity-matrix__grid {
		display: grid;
		grid-template-columns: auto repeat(5, 1fr);
		font-family: var(--mv-font-mono, ui-monospace, monospace);
		font-size: 11px;
	}
	.mv-sensitivity-matrix__hdr {
		color: var(--mv-text-muted, #94a3b8);
		background: var(--mv-sens-hdr-bg, rgba(19, 32, 64, 0.5));
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		padding: 7px 8px;
		border-bottom: 1px solid var(--mv-sens-line, var(--mv-border, #e2e8f0));
		border-right: 1px solid var(--mv-sens-line, var(--mv-border, #e2e8f0));
	}
	.mv-sensitivity-matrix__hdr:last-child {
		border-right: 0;
	}
	.mv-sensitivity-matrix__rowhdr {
		color: var(--mv-text-muted, #94a3b8);
		padding: 7px 8px 7px 10px;
		border-bottom: 1px solid var(--mv-sens-line, var(--mv-border, #e2e8f0));
		border-right: 1px solid var(--mv-sens-line, var(--mv-border, #e2e8f0));
	}
	.mv-sensitivity-matrix__cell {
		color: var(--mv-sens-cell, var(--mv-text-primary, #0f172a));
		padding: 7px 8px;
		border-bottom: 1px solid var(--mv-sens-line, var(--mv-border, #e2e8f0));
		border-right: 1px solid var(--mv-sens-line, var(--mv-border, #e2e8f0));
		cursor: default;
	}
	.mv-sensitivity-matrix__cell:last-child {
		border-right: 0;
	}
	.mv-sensitivity-matrix__cell--hot {
		color: var(--mv-sens-hot, #4ade80);
		background: var(--mv-sens-hot-bg, rgba(74, 222, 128, 0.06));
	}
	.mv-sensitivity-matrix__cell--cold {
		color: var(--mv-sens-cold, #f87171);
		background: var(--mv-sens-cold-bg, rgba(248, 113, 113, 0.06));
	}
	.mv-sensitivity-matrix__cell--mark {
		color: var(--mv-sens-mark, #d4a853);
		background: var(--mv-sens-mark-bg, rgba(212, 168, 83, 0.14));
		border: 1px solid var(--mv-sens-mark-border, #8a6f37);
		font-weight: 700;
	}
	.mv-sensitivity-matrix__cell--avg {
		color: var(--mv-sens-avg-text, var(--mv-text-muted, #94a3b8));
	}
	.mv-sensitivity-matrix__cell--empty {
		color: var(--mv-sens-avg-text, var(--mv-text-muted, #94a3b8));
	}
	.mv-sensitivity-matrix__error {
		font-family: var(--mv-font-sans, system-ui, sans-serif);
		font-size: 12px;
		color: var(--mv-error, #f87171);
		padding: 16px;
	}
</style>
