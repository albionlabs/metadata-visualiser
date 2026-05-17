/**
 * Token fixtures for `@albionlabs/metadata-visualiser/returns` tests.
 *
 * Five `ReturnsMetadata` shapes exercising distinct projection profiles:
 *   1. FIXTURE_HG_REGRESSION           — production-captured 0xf836a5… metadata (HG-04 regression)
 *   2. FIXTURE_FLAT_PRODUCTION — 360-mo flat 1000 bpm
 *   3. FIXTURE_DECLINING       — 360-mo exponential decline (≈10%/yr)
 *   4. FIXTURE_RISING          — 360-mo ramp-up over first 12 months then flat
 *   5. FIXTURE_SHORT_LIFE      —  96-mo flat 800 bpm
 *
 * ALBION_TOKENS has 2 entries as of 2026-05-17; fixtures discriminate on
 * projection shape, not address. Each non-HG04 fixture reuses one of the two
 * real addresses (alternating). If ALBION_TOKENS grows to >=5 unique tokens
 * before this fixture set is regenerated, prefer unique addresses per fixture.
 */

import type { ReturnsMetadata, ProjectionEntry } from '../../src/lib/returns.js';

// Real ALBION_TOKENS addresses (verified against
// albion.dex/src/lib/config/network.ts on 2026-05-17).
const ALBION_TOKEN_A = '0xf836a500910453a397084ade41321ee20a5aade1';
const ALBION_TOKEN_B = '0x1d57246fd0ba134d7cc78ddf3ed829379d95f4b7';

/**
 * Build N consecutive monthly projections starting from `startMonth` (YYYY-MM).
 * `profile(i)` receives the zero-based index and returns the production for that month.
 */
function makeProjections(
	startMonth: string,
	count: number,
	profile: (i: number) => number
): ProjectionEntry[] {
	const [startYear, startMo] = startMonth.split('-').map(Number);
	const out: ProjectionEntry[] = [];
	for (let i = 0; i < count; i++) {
		const d = new Date(startYear, startMo - 1 + i, 1);
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		out.push({ month: `${y}-${m}`, production: profile(i) });
	}
	return out;
}

/**
 * FIXTURE_HG_REGRESSION — production-captured metadata for the 0xf836a5… token.
 *
 * Copied verbatim from albion.dex/tests/lib/utils/returnsEstimator.test.ts
 * (HG-04 regression block). Exists to prove the removed hardcoded
 * cashflowStartDate override was dead code.
 */
export const FIXTURE_HG_REGRESSION: ReturnsMetadata = {
	subject: '0xf836a500910453a397084ade41321ee20a5aade1',
	decodedData: {
		contractAddress: '0xf836a500910453a397084ade41321ee20a5aade1',
		// Captured from production metadata, Task 1 (HG-04, plan 07-03).
		firstPaymentDate: '2025-08'
	}
};

/**
 * FIXTURE_FLAT_PRODUCTION — 360-month flat 1000 bpm.
 * Benchmark Brent-like; modest premium, modest transport.
 */
export const FIXTURE_FLAT_PRODUCTION: ReturnsMetadata = {
	subject: ALBION_TOKEN_A,
	decodedData: {
		firstPaymentDate: '2025-08',
		sharePercentage: 2.5,
		asset: {
			plannedProduction: {
				projections: makeProjections('2025-08', 360, () => 1000)
			},
			technical: {
				pricing: { benchmarkPremium: 2.5, transportCosts: 1.2 }
			}
		}
	}
};

/**
 * FIXTURE_DECLINING — 360-month exponential decline starting at 2000 bpm
 * with monthly factor 0.992 (≈10% annual decline).
 */
export const FIXTURE_DECLINING: ReturnsMetadata = {
	subject: ALBION_TOKEN_B,
	decodedData: {
		firstPaymentDate: '2025-08',
		sharePercentage: 3.0,
		asset: {
			plannedProduction: {
				projections: makeProjections('2025-08', 360, (i) => 2000 * Math.pow(0.992, i))
			},
			technical: {
				pricing: { benchmarkPremium: 3.5, transportCosts: 1.5 }
			}
		}
	}
};

/**
 * FIXTURE_RISING — 360-month ramp from 500 to 1500 over first 12 months,
 * then flat at 1500.
 */
export const FIXTURE_RISING: ReturnsMetadata = {
	subject: ALBION_TOKEN_A,
	decodedData: {
		firstPaymentDate: '2025-08',
		sharePercentage: 2.0,
		asset: {
			plannedProduction: {
				projections: makeProjections('2025-08', 360, (i) => {
					if (i < 12) {
						// Linear ramp 500 → 1500 across months 0..11
						return 500 + (1000 * i) / 11;
					}
					return 1500;
				})
			},
			technical: {
				pricing: { benchmarkPremium: 1.0, transportCosts: 2.0 }
			}
		}
	}
};

/**
 * FIXTURE_SHORT_LIFE — only 96 months (8 years) at flat 800 bpm.
 * Tighter life-of-asset shape used to verify edge behaviour in lifetime IRR.
 */
export const FIXTURE_SHORT_LIFE: ReturnsMetadata = {
	subject: ALBION_TOKEN_B,
	decodedData: {
		firstPaymentDate: '2025-08',
		sharePercentage: 5.0,
		asset: {
			plannedProduction: {
				projections: makeProjections('2025-08', 96, () => 800)
			},
			technical: {
				pricing: { benchmarkPremium: 2.0, transportCosts: 1.0 }
			}
		}
	}
};

/**
 * Aggregate fixture list. Use this in Plan 03's `computeSensitivityMatrix`
 * lockfile to iterate over the matrix output for each fixture.
 */
export const FIXTURE_TOKENS = [
	FIXTURE_HG_REGRESSION,
	FIXTURE_FLAT_PRODUCTION,
	FIXTURE_DECLINING,
	FIXTURE_RISING,
	FIXTURE_SHORT_LIFE
] as const;
