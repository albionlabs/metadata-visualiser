/**
 * Returns estimator — pure IRR/NPV/cashflow primitives for tokenized RWA royalty streams.
 * Ported from albion.dex/src/lib/utils/returnsEstimator.ts on 2026-05-17 (Phase 12).
 * Boundary: NO network I/O. Subgraph fetch + Goldsky concerns stay in albion.dex.
 * The HG-04 cashflow-start-date fix is preserved verbatim in `getCashflowStartDate`.
 */

import { parseNumber, normaliseMonth } from './utils.js';
import type { VisualiserMetadata } from './types.js';

/** Common metadata shape used by returns estimator (only decodedData + subject needed) */
export type ReturnsMetadata = Pick<VisualiserMetadata, 'decodedData' | 'subject'>;

export interface ProjectionEntry {
	month: string;
	production: number;
}

type JsonRecord = Record<string, unknown>;

// -----------------------
// Date Utilities
// -----------------------

/**
 * Get current date as YYYY-MM string
 */
function getCurrentYearMonth(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	return `${year}-${month}`;
}

/**
 * Get the number of days in a month
 */
function getDaysInMonth(yearMonth: string): number {
	const [year, month] = yearMonth.split('-').map(Number);
	return new Date(year, month, 0).getDate();
}

/**
 * Get the current day of the month
 */
function getCurrentDayOfMonth(): number {
	return new Date().getDate();
}

/**
 * Calculate the pro-ration factor for the current month
 * Returns the fraction of the month that has passed
 */
function getCurrentMonthProration(): number {
	const currentDay = getCurrentDayOfMonth();
	const currentYearMonth = getCurrentYearMonth();
	const daysInMonth = getDaysInMonth(currentYearMonth);
	const daysRemainingInMonth = daysInMonth - currentDay + 1;
	return daysRemainingInMonth / daysInMonth;
}

/**
 * Add months to a date string (YYYY-MM format)
 */
export function addMonths(dateStr: string, months: number): string {
	const [year, month] = dateStr.split('-').map(Number);
	const date = new Date(year, month - 1, 1);
	date.setMonth(date.getMonth() + months);
	const newYear = date.getFullYear();
	const newMonth = String(date.getMonth() + 1).padStart(2, '0');
	return `${newYear}-${newMonth}`;
}

/**
 * Check if a date string is before another date string (YYYY-MM format)
 */
function isDateBefore(dateA: string, dateB: string): boolean {
	return dateA < dateB;
}

// -----------------------
// Data Extraction Helpers
// -----------------------

interface ReceiptEntry {
	month: string;
	assetData?: {
		revenue?: number;
		production?: number;
	};
}

/**
 * Safely get a nested value from decoded data.
 *
 * NOTE (Pitfall #3): Kept LOCAL with the dex's `(path, decodedData)` signature.
 * The module's `utils.ts` `getAssetNode` takes a full `VisualiserMetadata` and
 * reads `source?.decodedData` internally — a different signature. To preserve
 * the verbatim port of the calc, this helper mirrors the dex original exactly.
 */
function getAssetNode(path: string[], decodedData: JsonRecord | null): unknown {
	let current: unknown = decodedData;
	for (const segment of path) {
		if (current && typeof current === 'object' && segment in (current as JsonRecord)) {
			current = (current as JsonRecord)[segment];
		} else {
			return undefined;
		}
	}
	return current;
}

/**
 * Get the cashflow start date for a token.
 *
 * Cashflow start derives from metadata.firstPaymentDate with projections[0].month
 * as fallback. A prior hardcoded override for `0xf836a5…` was removed in HG-04
 * (07-03) after the production metadata's `firstPaymentDate` was verified to
 * equal the prior override value — the override was provably dead code.
 *
 * Returns `undefined` only when both `metadata.firstPaymentDate` and
 * `projections[0]` are absent. The sole caller (`buildCashflowSetup`) already
 * short-circuits on empty projections, so the undefined path is unreachable in
 * production — the loose return type exists to keep new callers honest.
 */
export function getCashflowStartDate(
	metadata: ReturnsMetadata,
	projections: ProjectionEntry[]
): string | undefined {
	const decodedData = metadata.decodedData as JsonRecord | null;
	const firstPaymentDate = getAssetNode(['firstPaymentDate'], decodedData) as string | undefined;
	return firstPaymentDate || projections[0]?.month;
}

/**
 * Parse a loose numeric value (possibly containing currency symbols, commas, etc.)
 * into a plain number. Returns 0 for null/empty/unparseable input.
 *
 * NOTE (Pitfall #6): Kept LOCAL because dex's `parseNumber` (in trading.ts) has a
 * bigint branch the module's `parseNumber` lacks. This helper is used inside
 * `getPricingAdjustments` where currency-formatted strings ($, commas) may appear.
 * For JSON-number-only sources (`record?.production`, `assetData?.revenue`) the
 * module's `parseNumber` is safe and is used directly.
 */
function parseLooseNumber(value: unknown): number {
	if (value == null) return 0;
	return parseFloat(String(value).replace(/[^-\d.]/g, '')) || 0;
}

/**
 * Get pricing adjustments from token asset data
 */
function getPricingAdjustments(decodedData: JsonRecord | null): {
	benchmarkPremium: number;
	transportCosts: number;
} {
	const benchmarkPremium = parseLooseNumber(
		getAssetNode(['asset', 'technical', 'pricing', 'benchmarkPremium'], decodedData)
	);
	const transportCosts = parseLooseNumber(
		getAssetNode(['asset', 'technical', 'pricing', 'transportCosts'], decodedData)
	);

	return { benchmarkPremium, transportCosts };
}

/**
 * Extract projections from metadata
 */
function getProjections(decodedData: JsonRecord | null): ProjectionEntry[] {
	const projectionsRaw = getAssetNode(['asset', 'plannedProduction', 'projections'], decodedData);
	if (!Array.isArray(projectionsRaw)) return [];

	return projectionsRaw
		.map((entry) => {
			const record = entry as JsonRecord;
			const productionValue =
				record?.production ?? record?.value ?? (typeof entry === 'number' ? entry : 0);
			return {
				month: normaliseMonth(record?.month) ?? '',
				production: parseNumber(productionValue)
			};
		})
		.filter((entry) => entry.month && entry.production > 0);
}

/**
 * Extract receipts data from metadata
 */
function getReceiptsData(decodedData: JsonRecord | null): ReceiptEntry[] {
	const receiptsRaw = getAssetNode(['asset', 'receiptsData'], decodedData);
	if (!Array.isArray(receiptsRaw)) return [];

	return receiptsRaw
		.map((entry) => {
			const record = entry as JsonRecord;
			const assetData = record?.assetData as JsonRecord | undefined;
			return {
				month: normaliseMonth(record?.month) ?? '',
				assetData: {
					revenue: parseNumber(assetData?.revenue),
					production: parseNumber(assetData?.production ?? record?.production)
				}
			};
		})
		.filter((entry) => entry.month);
}

/**
 * Calculate pending distributions from receipts and projections
 */
function calculatePendingDistributionsTotal(
	receiptsData: ReceiptEntry[],
	projections: ProjectionEntry[],
	cashflowStartDate: string,
	adjustedOilPrice: number
): number {
	let pendingDistributionsTotal = 0;

	// Create a map of receipts by month for quick lookup
	const receiptsMap = new Map<string, number>();
	for (const receipt of receiptsData) {
		if (receipt.assetData?.revenue !== undefined) {
			receiptsMap.set(receipt.month, receipt.assetData.revenue);
		}
	}

	// Sum all pending distributions from before cashflowStartDate
	for (const projection of projections) {
		if (isDateBefore(projection.month, cashflowStartDate)) {
			if (receiptsMap.has(projection.month)) {
				// Use actual revenue from receipts
				pendingDistributionsTotal += receiptsMap.get(projection.month) || 0;
			} else {
				// Estimate using production projection * adjusted oil price
				const estimatedRevenue = projection.production * adjustedOilPrice;
				pendingDistributionsTotal += estimatedRevenue;
			}
		}
	}

	return pendingDistributionsTotal;
}

// -----------------------
// Main Calculation Functions
// -----------------------

interface CashflowSetup {
	decodedData: JsonRecord | null;
	projections: ProjectionEntry[];
	adjustedOilPrice: number;
	cashflowStartDate: string;
	monthlyPendingDistribution: number;
	pendingDistributionsEndDate: string;
}

/**
 * Shared setup performed by both monthly and lifetime cashflow calculations.
 * Returns null when there are no projections to compute against.
 */
export function buildCashflowSetup(
	metadata: ReturnsMetadata,
	oilPrice: number
): CashflowSetup | null {
	const decodedData = metadata.decodedData as JsonRecord | null;
	const projections = getProjections(decodedData);
	if (projections.length === 0) return null;

	const { benchmarkPremium, transportCosts } = getPricingAdjustments(decodedData);
	const adjustedOilPrice = oilPrice + benchmarkPremium - transportCosts;
	const cashflowStartDate = getCashflowStartDate(metadata, projections);
	// Unreachable in practice — projections.length > 0 above guarantees
	// `projections[0]?.month` resolves to a string. Narrow for TS and bail out
	// defensively in case metadata projections ever contain entries without `month`.
	if (cashflowStartDate === undefined) return null;
	const receiptsData = getReceiptsData(decodedData);
	const pendingDistributionsTotal = calculatePendingDistributionsTotal(
		receiptsData,
		projections,
		cashflowStartDate,
		adjustedOilPrice
	);

	return {
		decodedData,
		projections,
		adjustedOilPrice,
		cashflowStartDate,
		monthlyPendingDistribution: pendingDistributionsTotal / 12,
		pendingDistributionsEndDate: addMonths(cashflowStartDate, 12)
	};
}

/**
 * Compute the per-token share multiplier (share % ÷ 100) and normalizer (1 / mintedSupply)
 * used to scale a monthly cashflow to a single token's entitlement.
 */
function getShareScaling(
	metadata: ReturnsMetadata,
	mintedSupply: number
): { shareMultiplier: number; normalizer: number } {
	return {
		shareMultiplier: getSharePercentage(metadata) / 100,
		normalizer: mintedSupply > 0 ? mintedSupply : 1
	};
}

/**
 * Calculate monthly token cashflows based on the specified algorithm
 * @param metadata Metadata with asset data
 * @param oilPrice Oil price assumption in USD per barrel
 * @param mintedSupply Number of tokens currently minted
 * @param numberOfTokens Number of tokens to purchase
 * @param tokenPrice Price per token (market price, not fixed $1)
 * @returns Array of monthly cashflows starting from today
 */
export function calculateMonthlyTokenCashflows(
	metadata: ReturnsMetadata,
	oilPrice: number,
	mintedSupply: number = 1,
	numberOfTokens: number = 1,
	tokenPrice: number = 1
): Array<{ month: string; cashflow: number }> {
	const setup = buildCashflowSetup(metadata, oilPrice);
	if (!setup) return [];

	const {
		projections,
		adjustedOilPrice,
		cashflowStartDate,
		monthlyPendingDistribution,
		pendingDistributionsEndDate
	} = setup;

	// Build monthly cashflows starting from first projection
	const monthlyDataMap = new Map<string, number>();
	for (const projection of projections) {
		// Step 1 & 2: Production * adjusted oil price to get cash flow
		let monthlyCashflow = projection.production * adjustedOilPrice;

		// Step 4: Add pending distributions for the first 12 months from cashflowStartDate
		if (
			!isDateBefore(projection.month, cashflowStartDate) &&
			isDateBefore(projection.month, pendingDistributionsEndDate)
		) {
			monthlyCashflow += monthlyPendingDistribution;
		}

		monthlyDataMap.set(projection.month, monthlyCashflow);
	}

	// Step 5 & 6: Slice off months before current month and pro-rate current month
	const currentYearMonth = getCurrentYearMonth();
	const resultMonths: Array<{ month: string; cashflow: number }> = [];
	const proration = getCurrentMonthProration();

	for (const [month, cashflow] of monthlyDataMap.entries()) {
		if (month === currentYearMonth) {
			// Pro-rate current month
			resultMonths.push({ month, cashflow: cashflow * proration });
		} else if (month > currentYearMonth) {
			// Include future months
			resultMonths.push({ month, cashflow });
		}
	}

	if (resultMonths.length === 0) {
		return [];
	}

	// Step 7: Divide entire array by current token supply and apply share percentage
	// Note: On secondary market (albion.dex), we buy existing tokens, not mint new ones
	// So we divide by current mintedSupply, not (mintedSupply + numberOfTokens)
	const { shareMultiplier, normalizer } = getShareScaling(metadata, mintedSupply);

	const finalCashflows: Array<{ month: string; cashflow: number }> = resultMonths.map((item) => ({
		month: item.month,
		cashflow: ((item.cashflow * shareMultiplier) / normalizer) * numberOfTokens
	}));

	// Step 8: Prepend initial cost (number of tokens * token price)
	// KEY DIFFERENCE: Using market price instead of fixed $1
	finalCashflows.unshift({
		month: currentYearMonth,
		cashflow: -numberOfTokens * tokenPrice
	});

	return finalCashflows;
}

/**
 * Get lifetime cashflows - includes all months from cashflow start date without slicing or pro-rating
 * @param metadata Metadata with asset data
 * @param oilPrice Oil price assumption in USD per barrel
 * @param mintedSupply Number of tokens currently minted
 * @param numberOfTokens Number of tokens to purchase
 * @param tokenPrice Price per token (market price)
 * @returns Array of cashflows starting with initial investment
 */
export function getLifetimeCashflows(
	metadata: ReturnsMetadata,
	oilPrice: number,
	mintedSupply: number = 1,
	numberOfTokens: number = 1,
	tokenPrice: number = 1
): number[] {
	const setup = buildCashflowSetup(metadata, oilPrice);
	if (!setup) return [];

	const {
		projections,
		adjustedOilPrice,
		cashflowStartDate,
		monthlyPendingDistribution,
		pendingDistributionsEndDate
	} = setup;

	// Build cashflows including ALL months from cashflowStartDate (no slicing, no pro-rating)
	const monthlyDataMap = new Map<string, number>();
	for (const projection of projections) {
		if (isDateBefore(projection.month, cashflowStartDate)) continue;

		let monthlyCashflow = projection.production * adjustedOilPrice;
		if (isDateBefore(projection.month, pendingDistributionsEndDate)) {
			monthlyCashflow += monthlyPendingDistribution;
		}
		monthlyDataMap.set(projection.month, monthlyCashflow);
	}

	// Apply share percentage and current token supply
	// Note: On secondary market (albion.dex), we buy existing tokens, not mint new ones
	const { shareMultiplier, normalizer } = getShareScaling(metadata, mintedSupply);

	// Initial investment uses market price
	const cashflows: number[] = [-numberOfTokens * tokenPrice];
	for (const cashflow of monthlyDataMap.values()) {
		cashflows.push(((cashflow * shareMultiplier) / normalizer) * numberOfTokens);
	}

	return cashflows;
}

/**
 * Calculate NPV (Net Present Value) given a discount rate
 * @param cashflows Array of cashflows where index 0 is the initial investment
 * @param discountRate Monthly discount rate as decimal (e.g., 0.01 for 1%)
 * @returns NPV value
 */
export function calculateNPV(cashflows: number[], discountRate: number): number {
	if (cashflows.length === 0) return 0;

	let npv = 0;
	for (let i = 0; i < cashflows.length; i++) {
		const discountFactor = Math.pow(1 + discountRate, i);
		npv += cashflows[i] / discountFactor;
	}

	return npv;
}

/**
 * Calculate IRR (Internal Rate of Return) using Newton's method
 * @param cashflows Array of cashflows where index 0 is the initial investment
 * @returns IRR as a decimal (e.g., 0.05 for 5% monthly)
 */
export function calculateIRR(cashflows: number[]): number {
	const maxIterations = 200;
	const tolerance = 1e-10;
	let rate = 0.1; // Initial guess of 10%

	// Guard against empty or single-element arrays
	if (cashflows.length <= 1) {
		return 0;
	}

	// Check if the investment can ever be recovered
	const totalInflows = cashflows.slice(1).reduce((sum, cf) => sum + cf, 0);
	const initialOutflow = Math.abs(cashflows[0]);

	// Guard against zero or near-zero initial investment (would cause infinite IRR)
	if (initialOutflow < 0.0001) {
		return totalInflows > 0 ? 100 : 0; // Cap at 100 (10000% annual) for near-zero investment
	}

	if (totalInflows < initialOutflow * 0.01) {
		// Total inflows are less than 1% of initial investment - essentially a total loss
		return -0.99;
	}

	for (let i = 0; i < maxIterations; i++) {
		let npv = 0;
		let dnpv = 0;

		for (let j = 0; j < cashflows.length; j++) {
			const factor = Math.pow(1 + rate, j);
			npv += cashflows[j] / factor;
			dnpv -= (j * cashflows[j]) / Math.pow(1 + rate, j + 1);
		}

		// Protect against division by zero or infinity
		if (!isFinite(dnpv) || Math.abs(dnpv) < 1e-10) {
			return -0.99;
		}

		const newRate = rate - npv / dnpv;

		// Bound the rate to prevent divergence
		if (!isFinite(newRate) || newRate < -0.99) {
			return -0.99;
		}
		if (newRate > 100) {
			return 100;
		}

		if (Math.abs(newRate - rate) < tolerance) {
			return newRate;
		}

		rate = newRate;
	}

	return rate;
}

/**
 * Calculate payback period in months
 * @param cashflows Array of cashflows starting with initial investment
 * @returns Number of months to recover the initial investment (break even at cumulative = 0)
 */
export function calculatePaybackPeriod(cashflows: number[]): number {
	if (cashflows.length === 0) return Infinity;

	let cumulativeCashflow = 0;

	for (let i = 0; i < cashflows.length; i++) {
		cumulativeCashflow += cashflows[i];
		if (cumulativeCashflow >= 0) {
			// Found the month where cumulative reaches break-even ($0)
			if (i === 0) return 0;

			// Linear interpolation for fractional months
			const previousCumulative = cumulativeCashflow - cashflows[i];
			const monthsIntoCurrentPeriod = (0 - previousCumulative) / cashflows[i];
			return i - 1 + monthsIntoCurrentPeriod;
		}
	}

	// Never reaches break-even
	return Infinity;
}

/**
 * Calculate lifetime IRR - includes all months from cashflow start date without slicing or pro-rating
 * @param metadata Metadata with asset data
 * @param oilPrice Oil price assumption in USD per barrel
 * @param mintedSupply Number of tokens currently minted
 * @param numberOfTokens Number of tokens to purchase
 * @param tokenPrice Price per token (market price)
 * @returns Annualized IRR as percentage
 */
export function calculateLifetimeIRR(
	metadata: ReturnsMetadata,
	oilPrice: number,
	mintedSupply: number = 1,
	numberOfTokens: number = 1,
	tokenPrice: number = 1
): number {
	const cashflows = getLifetimeCashflows(
		metadata,
		oilPrice,
		mintedSupply,
		numberOfTokens,
		tokenPrice
	);

	if (cashflows.length <= 1) {
		return 0;
	}

	// Calculate IRR
	const monthlyIRR = calculateIRR(cashflows);

	// Annualize and convert to percentage
	if (monthlyIRR <= -0.99) {
		return -99;
	}

	return (Math.pow(1 + monthlyIRR, 12) - 1) * 100;
}

/**
 * Get share percentage from metadata
 */
export function getSharePercentage(metadata: ReturnsMetadata): number {
	const decodedData = metadata.decodedData as JsonRecord | null;
	const sharePercentageRaw = getAssetNode(['sharePercentage'], decodedData);
	const sharePercentage =
		typeof sharePercentageRaw === 'number' ? sharePercentageRaw : parseNumber(sharePercentageRaw);
	return sharePercentage > 0 ? sharePercentage : 2.5; // Default to 2.5%
}

// ============================================================================
// Sensitivity matrix (Phase 12 Plan 03)
// ============================================================================

export interface SensitivityMatrixInput {
	tokenMetadata: ReturnsMetadata;
	mintedSupply: number;
	tokenPrice: number;
	/** Annual percentage (e.g. 10 for 10%) — NOT decimal. */
	discountRate: number;
	wtiBuckets?: readonly number[];
	holdPeriods?: readonly number[];
	numberOfTokens?: number;
}

export interface SensitivityCell {
	wti: number;
	holdYears: number;
	/** Annualized IRR as percentage, matching `calculateLifetimeIRR` shape; -99 for total loss. */
	irr: number;
}

export interface SensitivityMatrixOutput {
	cells: SensitivityCell[];
	rowAverages: { wti: number; avgIrr: number }[];
	buckets: { wti: readonly number[]; holdYears: readonly number[] };
}

const DEFAULT_WTI_BUCKETS = [60, 70, 80, 90, 100] as const;
const DEFAULT_HOLD_PERIODS = [2, 4, 6, 8] as const;

/**
 * Computes a (WTI × hold-period) → annualized-IRR matrix for the given token.
 *
 * D-04 algorithm: for each (wti, holdYears) cell, truncate the lifetime
 * cashflow series at month `holdYears * 12` and add a terminal cashflow equal
 * to the NPV of the remaining months **discounted from the exit month**
 * (NOT from time-zero — this is the Pitfall #4 guard from RESEARCH.md).
 * Models "investor sells the token at fair value at exit."
 *
 * Edge cases (match `calculateLifetimeIRR` semantics):
 *   - cf.length <= truncateAt: no remaining tail to discount; cell collapses
 *     to lifetime IRR semantics on the un-truncated cashflow series.
 *   - monthlyIRR <= -0.99: cell.irr = -99 (total-loss sentinel).
 *
 * @param input See {@link SensitivityMatrixInput}. `discountRate` is a PERCENT
 *              (e.g. 10 for 10%), NOT a decimal — widget callers must multiply
 *              their decimal rate by 100 before invoking this function.
 */
export function computeSensitivityMatrix(input: SensitivityMatrixInput): SensitivityMatrixOutput {
	const {
		tokenMetadata,
		mintedSupply,
		tokenPrice,
		discountRate,
		wtiBuckets = DEFAULT_WTI_BUCKETS,
		holdPeriods = DEFAULT_HOLD_PERIODS,
		numberOfTokens = 1
	} = input;

	const monthlyR = Math.pow(1 + discountRate / 100, 1 / 12) - 1;
	const cells: SensitivityCell[] = [];

	// Cashflows depend on wti only; compute once per WTI bucket.
	const cashflowsByWti = new Map<number, number[]>();
	for (const wti of wtiBuckets) {
		const cf = getLifetimeCashflows(tokenMetadata, wti, mintedSupply, numberOfTokens, tokenPrice);
		cashflowsByWti.set(wti, cf);
	}

	for (const wti of wtiBuckets) {
		const cf = cashflowsByWti.get(wti)!;
		for (const holdYears of holdPeriods) {
			const truncateAt = holdYears * 12;
			let irr: number;

			if (cf.length <= truncateAt) {
				// No truncation possible — fall back to lifetime IRR semantics.
				irr = calculateLifetimeIRR(tokenMetadata, wti, mintedSupply, numberOfTokens, tokenPrice);
			} else {
				// Sum remaining months discounted at exit-month-relative rate (Pitfall #4).
				let terminalNPV = 0;
				for (let m = truncateAt + 1; m < cf.length; m++) {
					terminalNPV += cf[m] / Math.pow(1 + monthlyR, m - truncateAt);
				}
				const truncated = cf.slice(0, truncateAt + 1);
				truncated[truncateAt] = (cf[truncateAt] ?? 0) + terminalNPV;

				if (truncated.length <= 1) {
					irr = 0;
				} else {
					const monthlyIRR = calculateIRR(truncated);
					if (monthlyIRR <= -0.99) {
						irr = -99;
					} else {
						irr = (Math.pow(1 + monthlyIRR, 12) - 1) * 100;
					}
				}
			}

			cells.push({ wti, holdYears, irr });
		}
	}

	const rowAverages = wtiBuckets.map((wti) => {
		const rowCells = cells.filter((c) => c.wti === wti && Number.isFinite(c.irr));
		const avgIrr =
			rowCells.length === 0
				? 0
				: rowCells.reduce((sum, c) => sum + c.irr, 0) / rowCells.length;
		return { wti, avgIrr };
	});

	return {
		cells,
		rowAverages,
		buckets: { wti: wtiBuckets, holdYears: holdPeriods }
	};
}
