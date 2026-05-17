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
	// NPV-equivalence identity (RESEARCH §Pitfall #4 / line 633):
	//
	//   When the discount rate used to value the residual tail EQUALS the
	//   project's true IRR, the truncate-with-terminal-NPV IRR ≡ lifetime IRR
	//   (sum of two discounted halves both vanish at the IRR by definition).
	//
	//   When the discount rate ≠ IRR, the residual is the NPV at a *different*
	//   rate, so the truncated-IRR drifts away from the lifetime IRR (overstated
	//   when discountRate < IRR, understated when discountRate > IRR).
	//
	// The Pitfall #4 guard catches an exit-month-relative-vs-time-0 discounting
	// bug: a time-0-relative implementation produces a residual that is
	// orders-of-magnitude smaller, making the truncated IRR collapse far below
	// the lifetime IRR. To test that guard cleanly, set the discount rate to
	// the fixture's actual lifetime IRR so the math reduces to the NPV-identity
	// — any deviation > 1 bp then necessarily flags a discounting bug.
	it('base case (WTI=80, hold=6Y) equals calculateLifetimeIRR within 1 bp when discountRate == lifetime IRR (FIXTURE_FLAT_PRODUCTION)', () => {
		const lifetime = calculateLifetimeIRR(
			FIXTURE_FLAT_PRODUCTION,
			80,
			PARAMS.FLAT_PRODUCTION.mintedSupply,
			1,
			PARAMS.FLAT_PRODUCTION.tokenPrice
		);
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_FLAT_PRODUCTION,
			mintedSupply: PARAMS.FLAT_PRODUCTION.mintedSupply,
			tokenPrice: PARAMS.FLAT_PRODUCTION.tokenPrice,
			discountRate: lifetime // ← matches IRR; NPV identity holds
		});
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
	// HG_REGRESSION has no projections — getLifetimeCashflows returns the empty
	// initial-only array — every cell collapses to lifetime-IRR=0. The lockfile
	// is intentionally all zeros; it still anchors the HG-04 regression by
	// preserving the production-captured metadata + the 0-IRR baseline.
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_HG_REGRESSION,
			...PARAMS.HG_REGRESSION
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(0.0, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(0.0, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(0.0, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(0.0, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(0.0, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(0.0, 4);
		expect(getAvg(out,  60)).toBeCloseTo(0.0, 4);
		expect(getAvg(out,  70)).toBeCloseTo(0.0, 4);
		expect(getAvg(out,  80)).toBeCloseTo(0.0, 4);
		expect(getAvg(out,  90)).toBeCloseTo(0.0, 4);
		expect(getAvg(out, 100)).toBeCloseTo(0.0, 4);
	});
});

describe('computeSensitivityMatrix — FIXTURE_FLAT_PRODUCTION lockfile (1 bp)', () => {
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_FLAT_PRODUCTION,
			...PARAMS.FLAT_PRODUCTION
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(53.651284, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(32.832390, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(26.728084, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(23.924495, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(67.762545, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(39.841176, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(31.901910, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(28.325205, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(81.286569, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(46.450836, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(36.817230, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(32.559333, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(94.351319, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(52.760702, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(41.551003, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(36.691218, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(107.050543, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(58.842031, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(46.158740, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(40.767868, 4);
		expect(getAvg(out,  60)).toBeCloseTo(34.284063, 4);
		expect(getAvg(out,  70)).toBeCloseTo(41.957709, 4);
		expect(getAvg(out,  80)).toBeCloseTo(49.278492, 4);
		expect(getAvg(out,  90)).toBeCloseTo(56.338560, 4);
		expect(getAvg(out, 100)).toBeCloseTo(63.204796, 4);
	});
});

describe('computeSensitivityMatrix — FIXTURE_DECLINING lockfile (1 bp)', () => {
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_DECLINING,
			...PARAMS.DECLINING
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(88.093959, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(54.896587, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(46.549341, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(43.443429, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(108.895350, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(66.822118, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(56.868635, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(53.448367, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(129.632443, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(78.864130, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(67.585187, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(64.039811, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(150.459658, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(91.168497, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(78.835412, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(75.322792, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(171.499955, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(103.857520, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(90.733537, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(87.377211, 4);
		expect(getAvg(out,  60)).toBeCloseTo(58.245829, 4);
		expect(getAvg(out,  70)).toBeCloseTo(71.508617, 4);
		expect(getAvg(out,  80)).toBeCloseTo(85.030393, 4);
		expect(getAvg(out,  90)).toBeCloseTo(98.946590, 4);
		expect(getAvg(out, 100)).toBeCloseTo(113.367056, 4);
	});
});

describe('computeSensitivityMatrix — FIXTURE_RISING lockfile (1 bp)', () => {
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_RISING,
			...PARAMS.RISING
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(61.494107, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(36.588962, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(29.458469, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(26.224402, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(76.244494, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(43.766633, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(34.758433, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(30.755437, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(90.228539, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(50.458917, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(39.738674, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(35.069730, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(103.599048, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(56.778176, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(44.483674, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(39.235805, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(116.466611, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(62.803585, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(49.052756, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(43.301820, 4);
		expect(getAvg(out,  60)).toBeCloseTo(38.441485, 4);
		expect(getAvg(out,  70)).toBeCloseTo(46.381249, 4);
		expect(getAvg(out,  80)).toBeCloseTo(53.873965, 4);
		expect(getAvg(out,  90)).toBeCloseTo(61.024176, 4);
		expect(getAvg(out, 100)).toBeCloseTo(67.906193, 4);
	});
});

describe('computeSensitivityMatrix — FIXTURE_SHORT_LIFE lockfile (1 bp)', () => {
	it('locks 20 IRR cells + 5 row averages', () => {
		const out = computeSensitivityMatrix({
			tokenMetadata: FIXTURE_SHORT_LIFE,
			...PARAMS.SHORT_LIFE
		});
		expect(getCell(out,  60, 2)).toBeCloseTo(48.726285, 4);
		expect(getCell(out,  60, 4)).toBeCloseTo(33.017209, 4);
		expect(getCell(out,  60, 6)).toBeCloseTo(29.285905, 4);
		expect(getCell(out,  60, 8)).toBeCloseTo(28.503014, 4);
		expect(getCell(out,  70, 2)).toBeCloseTo(64.067245, 4);
		expect(getCell(out,  70, 4)).toBeCloseTo(41.991455, 4);
		expect(getCell(out,  70, 6)).toBeCloseTo(37.017025, 4);
		expect(getCell(out,  70, 8)).toBeCloseTo(36.038098, 4);
		expect(getCell(out,  80, 2)).toBeCloseTo(79.073976, 4);
		expect(getCell(out,  80, 4)).toBeCloseTo(50.766221, 4);
		expect(getCell(out,  80, 6)).toBeCloseTo(44.705106, 4);
		expect(getCell(out,  80, 8)).toBeCloseTo(43.587405, 4);
		expect(getCell(out,  90, 2)).toBeCloseTo(93.865284, 4);
		expect(getCell(out,  90, 4)).toBeCloseTo(59.445618, 4);
		expect(getCell(out,  90, 6)).toBeCloseTo(52.437820, 4);
		expect(getCell(out,  90, 8)).toBeCloseTo(51.228590, 4);
		expect(getCell(out, 100, 2)).toBeCloseTo(108.530136, 4);
		expect(getCell(out, 100, 4)).toBeCloseTo(68.108037, 4);
		expect(getCell(out, 100, 6)).toBeCloseTo(60.281850, 4);
		expect(getCell(out, 100, 8)).toBeCloseTo(59.020342, 4);
		expect(getAvg(out,  60)).toBeCloseTo(34.883103, 4);
		expect(getAvg(out,  70)).toBeCloseTo(44.778456, 4);
		expect(getAvg(out,  80)).toBeCloseTo(54.533177, 4);
		expect(getAvg(out,  90)).toBeCloseTo(64.244328, 4);
		expect(getAvg(out, 100)).toBeCloseTo(73.985091, 4);
	});
});
