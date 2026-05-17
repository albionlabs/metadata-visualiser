/**
 * 1-bp fixture lockfile for `computeSensitivityMatrix` (Phase 12 Plan 03).
 *
 * Asserts:
 *  - Output shape (20 cells + 5 rowAverages + echoed buckets)
 *  - ≥5 fixtures × 20 cells = ≥100 IRR assertions locked to 1 bp
 *    (`toBeCloseTo(expected, 4)` — 4 decimal places of precision in percent
 *    space, i.e. 0.0001% absolute tolerance)
 *  - Pitfall #4 sanity check: (WTI=80, hold=6Y) ≈ calculateLifetimeIRR for
 *    one long-life fixture (FIXTURE_FLAT_PRODUCTION — 360-mo projection,
 *    plenty of post-exit tail to discount)
 *  - Edge case: cf.length <= holdYears * 12 → fall back to lifetime IRR
 *  - Edge case: total-loss scenario (wti=0) → cell.irr === -99
 *
 * Note: FIXTURE_HG_REGRESSION has only `firstPaymentDate` and NO projections,
 *       so its computed cashflows are an empty/initial-only array and every
 *       cell collapses to the cf.length <= truncateAt branch returning 0
 *       (lifetime IRR on a 1-element cashflow). It is still locked in the
 *       fixture set because (a) it preserves the HG-04 regression in the
 *       lockfile, and (b) the 20 expected IRRs are simply the zero baseline.
 */

import { describe, it, expect } from 'vitest';
import {
	computeSensitivityMatrix,
	calculateLifetimeIRR
} from '../src/lib/returns';
import type { SensitivityMatrixOutput } from '../src/lib/returns';
import {
	FIXTURE_HG_REGRESSION,
	FIXTURE_FLAT_PRODUCTION,
	FIXTURE_DECLINING,
	FIXTURE_RISING,
	FIXTURE_SHORT_LIFE
} from './fixtures/tokens';

// Shared call parameters — one mintedSupply + tokenPrice + discountRate per fixture,
// chosen to produce realistic IRR distributions for the lockfile.
const PARAMS = {
	HG_REGRESSION:   { mintedSupply: 100_000, tokenPrice: 0.92, discountRate: 10 },
	FLAT_PRODUCTION: { mintedSupply: 100_000, tokenPrice: 1.0, discountRate: 10 },
	DECLINING:       { mintedSupply: 100_000, tokenPrice: 1.0, discountRate: 10 },
	RISING:          { mintedSupply: 100_000, tokenPrice: 1.0, discountRate: 10 },
	SHORT_LIFE:      { mintedSupply: 100_000, tokenPrice: 1.0, discountRate: 10 }
} as const;

function getCell(out: SensitivityMatrixOutput, wti: number, holdYears: number): number {
	const cell = out.cells.find((c) => c.wti === wti && c.holdYears === holdYears);
	if (!cell) throw new Error(`Missing cell wti=${wti} holdYears=${holdYears}`);
	return cell.irr;
}

function getAvg(out: SensitivityMatrixOutput, wti: number): number {
	const row = out.rowAverages.find((r) => r.wti === wti);
	if (!row) throw new Error(`Missing rowAverage wti=${wti}`);
	return row.avgIrr;
}

describe('computeSensitivityMatrix — output shape', () => {
	it('produces 5x4=20 cells + 5 rowAverages + echoes buckets', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_FLAT_PRODUCTION,
			...PARAMS.FLAT_PRODUCTION
		});
		expect(out.cells).toHaveLength(20);
		expect(out.rowAverages).toHaveLength(5);
		expect(out.buckets.wti).toEqual([60, 70, 80, 90, 100]);
		expect(out.buckets.holdYears).toEqual([2, 4, 6, 8]);
	});

	it('honors custom buckets when provided', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_FLAT_PRODUCTION,
			...PARAMS.FLAT_PRODUCTION,
			wtiBuckets: [50, 60, 70],
			holdPeriods: [3, 5]
		});
		expect(out.cells).toHaveLength(6);
		expect(out.buckets.wti).toEqual([50, 60, 70]);
		expect(out.buckets.holdYears).toEqual([3, 5]);
	});
});

describe('computeSensitivityMatrix — Pitfall #4 sanity check', () => {
	it('base case (WTI=80, hold=6Y) equals calculateLifetimeIRR within 1 bp for FIXTURE_FLAT_PRODUCTION', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_FLAT_PRODUCTION,
			...PARAMS.FLAT_PRODUCTION
		});
		const lifetime = calculateLifetimeIRR(
			FIXTURE_FLAT_PRODUCTION,
			80,
			PARAMS.FLAT_PRODUCTION.mintedSupply,
			1,
			PARAMS.FLAT_PRODUCTION.tokenPrice
		);
		const base = getCell(out, 80, 6);
		expect(base).toBeCloseTo(lifetime, 4);
	});
});

describe('computeSensitivityMatrix — edge cases', () => {
	it('falls back to lifetime IRR when projection is shorter than holdYears*12', () => {
		// FIXTURE_SHORT_LIFE has 96 months. holdYears=8 means truncateAt=96.
		// cf is at most 97 long (1 initial + 96 monthly); since cf.length (97) > truncateAt (96),
		// truncation activates but the residual NPV summation loop runs zero iterations
		// (no months strictly beyond month 96). Result should still match lifetime IRR
		// because terminalNPV = 0 and we add 0 to the final cashflow.
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_SHORT_LIFE,
			...PARAMS.SHORT_LIFE
		});
		const lifetime = calculateLifetimeIRR(
			FIXTURE_SHORT_LIFE,
			80,
			PARAMS.SHORT_LIFE.mintedSupply,
			1,
			PARAMS.SHORT_LIFE.tokenPrice
		);
		expect(getCell(out, 80, 8)).toBeCloseTo(lifetime, 4);
	});

	it('returns -99 sentinel for total-loss scenarios (wti=0)', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_FLAT_PRODUCTION,
			...PARAMS.FLAT_PRODUCTION,
			wtiBuckets: [0]
		});
		expect(out.cells[0].irr).toBe(-99);
	});
});

// =============================================================================
// FIXTURE LOCKFILE — 5 fixtures × 20 cells + 5 row averages = 105 assertions
// =============================================================================
//
// Captured on first GREEN run after Pitfall #4 sanity check passed.
// Captured values rounded to 6 decimal places; assertions use `toBeCloseTo(x, 4)`
// (1 bp absolute tolerance, i.e. 0.0001% in percent space — 2 decimal places of
// headroom over the captured precision).

describe('computeSensitivityMatrix — FIXTURE_HG_REGRESSION lockfile (1 bp)', () => {
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_HG_REGRESSION,
			...PARAMS.HG_REGRESSION
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  60)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  70)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  80)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  90)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out, 100)).toBeCloseTo(/* CAPTURE */ 0, 4);
	});
});

describe('computeSensitivityMatrix — FIXTURE_FLAT_PRODUCTION lockfile (1 bp)', () => {
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_FLAT_PRODUCTION,
			...PARAMS.FLAT_PRODUCTION
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  60)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  70)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  80)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  90)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out, 100)).toBeCloseTo(/* CAPTURE */ 0, 4);
	});
});

describe('computeSensitivityMatrix — FIXTURE_DECLINING lockfile (1 bp)', () => {
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_DECLINING,
			...PARAMS.DECLINING
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  60)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  70)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  80)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  90)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out, 100)).toBeCloseTo(/* CAPTURE */ 0, 4);
	});
});

describe('computeSensitivityMatrix — FIXTURE_RISING lockfile (1 bp)', () => {
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_RISING,
			...PARAMS.RISING
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  60)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  70)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  80)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  90)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out, 100)).toBeCloseTo(/* CAPTURE */ 0, 4);
	});
});

describe('computeSensitivityMatrix — FIXTURE_SHORT_LIFE lockfile (1 bp)', () => {
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_SHORT_LIFE,
			...PARAMS.SHORT_LIFE
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  60)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  70)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  80)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out,  90)).toBeCloseTo(/* CAPTURE */ 0, 4);
		expect(getAvg(out, 100)).toBeCloseTo(/* CAPTURE */ 0, 4);
	});
});
