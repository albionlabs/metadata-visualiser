/**
 * Returns Estimator Tests
 *
 * Verbatim port of albion.dex/tests/lib/utils/returnsEstimator.test.ts (2026-05-17).
 * Drops the crude-benchmark describe block — that function stays in albion.dex
 * per D-02 boundary and is not exported by the module's `./returns` sub-path.
 *
 * Numeric expectations and `toBeCloseTo(_, N)` tolerances are preserved bit-for-bit
 * so any divergence in the ported port produces a loud test failure.
 */
import { describe, it, expect } from 'vitest';
import {
	addMonths,
	calculateNPV,
	calculateIRR,
	calculatePaybackPeriod,
	getSharePercentage,
	calculateLifetimeIRR,
	getLifetimeCashflows,
	getCashflowStartDate
} from '../src/lib/returns';
import type { ReturnsMetadata, ProjectionEntry } from '../src/lib/returns';

// Helper to create mock metadata
function makeMeta(decodedData: Record<string, unknown>, subject = '0x123'): ReturnsMetadata {
	return { decodedData, subject };
}

describe('addMonths', () => {
	it('should add months within the same year', () => {
		expect(addMonths('2025-01', 3)).toBe('2025-04');
		expect(addMonths('2025-06', 1)).toBe('2025-07');
	});

	it('should roll over to the next year', () => {
		expect(addMonths('2025-11', 2)).toBe('2026-01');
		expect(addMonths('2025-12', 1)).toBe('2026-01');
	});

	it('should handle adding 12 months (one full year)', () => {
		expect(addMonths('2025-03', 12)).toBe('2026-03');
	});

	it('should handle adding 0 months', () => {
		expect(addMonths('2025-06', 0)).toBe('2025-06');
	});

	it('should handle large month additions', () => {
		expect(addMonths('2025-01', 24)).toBe('2027-01');
		expect(addMonths('2025-01', 25)).toBe('2027-02');
	});

	it('should pad single-digit months', () => {
		expect(addMonths('2025-01', 0)).toBe('2025-01');
		expect(addMonths('2025-09', 0)).toBe('2025-09');
	});
});

describe('calculateNPV', () => {
	it('should return 0 for empty cashflows', () => {
		expect(calculateNPV([], 0.01)).toBe(0);
	});

	it('should return the first cashflow when discount rate is 0', () => {
		// NPV with 0 discount = sum of all cashflows
		const cashflows = [-100, 50, 50, 50];
		expect(calculateNPV(cashflows, 0)).toBeCloseTo(50, 5);
	});

	it('should discount future cashflows correctly', () => {
		// NPV = -100 + 110/(1.10) = -100 + 100 = 0
		const cashflows = [-100, 110];
		expect(calculateNPV(cashflows, 0.1)).toBeCloseTo(0, 5);
	});

	it('should return negative NPV when discount rate is too high', () => {
		const cashflows = [-100, 50, 50, 50];
		const npv = calculateNPV(cashflows, 0.5);
		expect(npv).toBeLessThan(0);
	});

	it('should handle single cashflow (initial investment only)', () => {
		expect(calculateNPV([-100], 0.1)).toBe(-100);
	});

	it('should handle all positive cashflows', () => {
		const cashflows = [10, 20, 30];
		const npv = calculateNPV(cashflows, 0.05);
		expect(npv).toBeGreaterThan(0);
	});
});

describe('calculateIRR', () => {
	it('should return 0 for empty or single-element cashflows', () => {
		expect(calculateIRR([])).toBe(0);
		expect(calculateIRR([-100])).toBe(0);
	});

	it('should find IRR for simple investment with known return', () => {
		// Invest 100, get 110 next period => IRR = 10%
		const cashflows = [-100, 110];
		expect(calculateIRR(cashflows)).toBeCloseTo(0.1, 4);
	});

	it('should find IRR for multiple equal cashflows', () => {
		// Invest 1000, get 400 for 3 periods
		const cashflows = [-1000, 400, 400, 400];
		const irr = calculateIRR(cashflows);
		// Verify NPV at the calculated IRR is near zero
		const npv = calculateNPV(cashflows, irr);
		expect(Math.abs(npv)).toBeLessThan(0.01);
	});

	it('should return -0.99 for near-total loss (inflows < 1% of outflow)', () => {
		const cashflows = [-10000, 0.5, 0.3];
		expect(calculateIRR(cashflows)).toBe(-0.99);
	});

	it('should cap at 100 for near-zero initial investment', () => {
		const cashflows = [-0.00001, 1000, 2000];
		expect(calculateIRR(cashflows)).toBe(100);
	});

	it('should return 0 for near-zero investment with no inflows', () => {
		const cashflows = [-0.00001, 0, 0];
		expect(calculateIRR(cashflows)).toBe(0);
	});
});

describe('calculatePaybackPeriod', () => {
	it('should return Infinity for empty cashflows', () => {
		expect(calculatePaybackPeriod([])).toBe(Infinity);
	});

	it('should return 0 when first cashflow is non-negative', () => {
		expect(calculatePaybackPeriod([0, 10, 20])).toBe(0);
		expect(calculatePaybackPeriod([10, 20])).toBe(0);
	});

	it('should calculate exact payback period', () => {
		// Invest -100, get 50 per period -> payback in 2 periods
		const cashflows = [-100, 50, 50, 50];
		expect(calculatePaybackPeriod(cashflows)).toBe(2);
	});

	it('should interpolate fractional payback period', () => {
		// -100, then 30, 30, 60 -> cumulative: -100, -70, -40, 20
		// Break-even at i=3: previousCumulative = -40, monthsInto = 40/60
		// return (3 - 1) + 40/60 = 2 + 0.667 = ~2.667
		const cashflows = [-100, 30, 30, 60];
		const payback = calculatePaybackPeriod(cashflows);
		expect(payback).toBeCloseTo(2 + 40 / 60, 5);
	});

	it('should return Infinity when investment never pays back', () => {
		const cashflows = [-1000, 1, 1, 1];
		expect(calculatePaybackPeriod(cashflows)).toBe(Infinity);
	});
});

describe('getSharePercentage', () => {
	it('should return sharePercentage from metadata when present', () => {
		const meta = makeMeta({ sharePercentage: 5 });
		expect(getSharePercentage(meta)).toBe(5);
	});

	it('should return string-parseable sharePercentage', () => {
		const meta = makeMeta({ sharePercentage: '3.5' });
		expect(getSharePercentage(meta)).toBe(3.5);
	});

	it('should default to 2.5 when sharePercentage is missing', () => {
		const meta = makeMeta({});
		expect(getSharePercentage(meta)).toBe(2.5);
	});

	it('should default to 2.5 when sharePercentage is 0 or negative', () => {
		expect(getSharePercentage(makeMeta({ sharePercentage: 0 }))).toBe(2.5);
		expect(getSharePercentage(makeMeta({ sharePercentage: -1 }))).toBe(2.5);
	});

	it('should default to 2.5 when decodedData is null', () => {
		const meta: ReturnsMetadata = { decodedData: null, subject: '0x123' };
		expect(getSharePercentage(meta)).toBe(2.5);
	});
});

describe('getLifetimeCashflows', () => {
	it('should return empty array when no projections exist', () => {
		const meta = makeMeta({});
		expect(getLifetimeCashflows(meta, 70)).toEqual([]);
	});

	it('should return array starting with negative initial investment', () => {
		const meta = makeMeta({
			asset: {
				plannedProduction: {
					projections: [
						{ month: '2030-01', production: 100 },
						{ month: '2030-02', production: 100 }
					]
				}
			}
		});
		const cashflows = getLifetimeCashflows(meta, 70, 1, 10, 5);
		expect(cashflows.length).toBeGreaterThan(0);
		expect(cashflows[0]).toBe(-50); // -numberOfTokens * tokenPrice = -10 * 5
	});

	it('should apply share percentage and supply normalization', () => {
		const meta = makeMeta({
			sharePercentage: 10,
			asset: {
				plannedProduction: {
					projections: [{ month: '2030-01', production: 100 }]
				}
			}
		});
		const cashflows = getLifetimeCashflows(meta, 70, 100, 1, 1);
		// First element is initial investment
		expect(cashflows[0]).toBe(-1);
		// Second element: (100 * 70) * (10/100) / 100 * 1 = 7000 * 0.1 / 100 = 7
		expect(cashflows[1]).toBeCloseTo(7, 1);
	});
});

describe('calculateLifetimeIRR', () => {
	it('should return 0 when no projections exist', () => {
		const meta = makeMeta({});
		expect(calculateLifetimeIRR(meta, 70)).toBe(0);
	});

	it('should return a positive annualized percentage for profitable projections', () => {
		const projections = [];
		for (let i = 0; i < 36; i++) {
			const month = i + 1;
			const year = 2030 + Math.floor((month - 1) / 12);
			const m = ((month - 1) % 12) + 1;
			projections.push({
				month: `${year}-${String(m).padStart(2, '0')}`,
				production: 50
			});
		}
		const meta = makeMeta({
			sharePercentage: 100,
			asset: {
				plannedProduction: { projections }
			}
		});
		// oilPrice 70, mintedSupply 1, 1 token at $100
		const irr = calculateLifetimeIRR(meta, 70, 1, 1, 100);
		// Should be a very high positive number since 50*70=3500/month on $100 investment
		expect(irr).toBeGreaterThan(0);
	});

	it('should return negative for overpriced token', () => {
		const meta = makeMeta({
			sharePercentage: 1,
			asset: {
				plannedProduction: {
					projections: [
						{ month: '2030-01', production: 1 },
						{ month: '2030-02', production: 1 }
					]
				}
			}
		});
		// Very expensive token ($10000) with tiny production
		const irr = calculateLifetimeIRR(meta, 70, 1000, 1, 10000);
		expect(irr).toBeLessThan(0);
	});
});

describe('getCashflowStartDate', () => {
	// HG-04: BEFORE this test was added, getCashflowStartDate for token 0xf836a5… was
	// hardcoded to '2025-08' regardless of metadata. This test asserts the
	// metadata-derived value ('2025-08'), captured from production Goldsky metadata
	// (metaV1S id 285, subgraph metadata-base/2025-07-06-594f) during 07-03 planning.
	// The production firstPaymentDate equals the prior hardcoded override, so when
	// Task 3 removes the override the test continues to pass — proving the override
	// was dead code.
	it('returns the metadata-derived cashflowStartDate for the 0xf836a5… token (no hardcoded override)', () => {
		const metadata: ReturnsMetadata = {
			subject: '0xf836a500910453a397084ade41321ee20a5aade1',
			decodedData: {
				contractAddress: '0xf836a500910453a397084ade41321ee20a5aade1',
				// Captured from production metadata, Task 1 (HG-04, plan 07-03).
				firstPaymentDate: '2025-08'
			}
		};
		// Production projections[0].month = '2025-05'; firstPaymentDate takes precedence.
		const projections: ProjectionEntry[] = [{ month: '2025-05', production: 100 }];
		expect(getCashflowStartDate(metadata, projections)).toBe('2025-08');
	});

	it('returns metadata.firstPaymentDate for a non-affected token (override does not regress)', () => {
		const metadata: ReturnsMetadata = {
			subject: '0xdeadbeef00000000000000000000000000000000',
			decodedData: {
				contractAddress: '0xdeadbeef00000000000000000000000000000000',
				firstPaymentDate: '2026-03'
			}
		};
		const projections: ProjectionEntry[] = [{ month: '2026-02', production: 100 }];
		expect(getCashflowStartDate(metadata, projections)).toBe('2026-03');
	});

	it('falls back to projections[0].month when metadata.firstPaymentDate is absent', () => {
		const metadata: ReturnsMetadata = {
			subject: '0xdeadbeef00000000000000000000000000000000',
			decodedData: {
				contractAddress: '0xdeadbeef00000000000000000000000000000000'
				// no firstPaymentDate
			}
		};
		const projections: ProjectionEntry[] = [{ month: '2027-01', production: 50 }];
		expect(getCashflowStartDate(metadata, projections)).toBe('2027-01');
	});

	it('returns undefined when both firstPaymentDate and projections are absent (WR-02)', () => {
		// Pins the documented `string | undefined` return contract. The sole caller
		// (`buildCashflowSetup`) short-circuits on empty projections before reaching
		// here, so this branch is unreachable in practice — the test guards future
		// callers from accidentally relying on a guaranteed-string return.
		const metadata: ReturnsMetadata = {
			subject: '0xdeadbeef00000000000000000000000000000000',
			decodedData: {
				contractAddress: '0xdeadbeef00000000000000000000000000000000'
				// no firstPaymentDate
			}
		};
		expect(getCashflowStartDate(metadata, [])).toBeUndefined();
	});
});
