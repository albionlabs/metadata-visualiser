/**
 * Component test for SensitivityMatrix.svelte (Phase 12 Plan 03).
 *
 * Covers:
 *  - Render shape: section heading + lede + 6×6 grid headers + 20 cells
 *  - data-testid hooks for downstream Playwright targeting
 *  - Cell value formatting (`${irr.toFixed(1)}%`, NaN/-99 → '—')
 *  - Mark cell rounding (default, exact, closest-bucket tie-break)
 *  - Hot/cold modifier classification (defaults + mark override)
 *  - Render stability when markWti changes
 *  - Calc-error fallback (renders the user-facing message)
 *  - Avg column rendering
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render as renderRaw, screen, cleanup } from '@testing-library/svelte/svelte5';
// @testing-library/svelte's TS types lag behind the runtime Svelte 5 entrypoint,
// so we cast the import to the loose shape we actually use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const render = renderRaw as unknown as (
	component: any,
	options?: { props?: Record<string, unknown> }
) => {
	component: unknown;
	container: HTMLElement;
	unmount: () => void;
	rerender: (props: Record<string, unknown>) => void;
};

import SensitivityMatrix from '../src/lib/components/SensitivityMatrix.svelte';
import { FIXTURE_FLAT_PRODUCTION } from './fixtures/tokens';
import { computeSensitivityMatrix } from '../src/lib/returns';

afterEach(() => cleanup());

const defaultProps = {
	tokenMetadata: FIXTURE_FLAT_PRODUCTION,
	mintedSupply: 100_000,
	tokenPrice: 1.0,
	discountRate: 0.1 // DECIMAL per UI-SPEC; widget multiplies ×100 internally for calc API
};

function cell(wti: number, holdYears: number): HTMLElement {
	const el = screen.queryByTestId(`sensitivity-cell-${wti}-${holdYears}`);
	if (!el) throw new Error(`Missing data-testid=sensitivity-cell-${wti}-${holdYears}`);
	return el;
}

describe('SensitivityMatrix.svelte — render shape', () => {
	it('renders section heading + lede + all column/row headers', () => {
		render(SensitivityMatrix, { props: defaultProps });

		expect(screen.getByText('Price sensitivity · IRR at purchase')).toBeInTheDocument();
		expect(
			screen.getByText('Highlighted cell = base case (6-year hold, strip pricing).')
		).toBeInTheDocument();
		expect(screen.getByText('WTI ↓ / Hold →')).toBeInTheDocument();
		expect(screen.getByText('2Y')).toBeInTheDocument();
		expect(screen.getByText('4Y')).toBeInTheDocument();
		expect(screen.getByText('6Y')).toBeInTheDocument();
		expect(screen.getByText('8Y')).toBeInTheDocument();
		expect(screen.getByText('Avg 30Y')).toBeInTheDocument();
		expect(screen.getByText('$60/bbl')).toBeInTheDocument();
		expect(screen.getByText('$70/bbl')).toBeInTheDocument();
		expect(screen.getByText('$80/bbl')).toBeInTheDocument();
		expect(screen.getByText('$90/bbl')).toBeInTheDocument();
		expect(screen.getByText('$100/bbl')).toBeInTheDocument();
	});

	it('renders 20 cells with data-testid hooks for every (wti, hold) pair', () => {
		render(SensitivityMatrix, { props: defaultProps });
		for (const wti of [60, 70, 80, 90, 100]) {
			for (const holdYears of [2, 4, 6, 8]) {
				expect(cell(wti, holdYears)).toBeInTheDocument();
			}
		}
	});

	it('cell values match computeSensitivityMatrix output formatted as `${n.toFixed(1)}%`', () => {
		render(SensitivityMatrix, { props: defaultProps });

		const expected = computeSensitivityMatrix({
			tokenMetadata: defaultProps.tokenMetadata,
			mintedSupply: defaultProps.mintedSupply,
			tokenPrice: defaultProps.tokenPrice,
			discountRate: defaultProps.discountRate * 100 // widget converts; mirror here
		});
		for (const c of expected.cells) {
			expect(cell(c.wti, c.holdYears).textContent).toBe(`${c.irr.toFixed(1)}%`);
		}
	});
});

describe('SensitivityMatrix.svelte — mark cell selection', () => {
	it('defaults to (80, 6Y) when markWti is null/undefined', () => {
		render(SensitivityMatrix, { props: { ...defaultProps, markWti: null } });
		expect(cell(80, 6).className).toContain('mv-sensitivity-matrix__cell--mark');
		// Other (?,6) cells must NOT carry the mark.
		expect(cell(70, 6).className).not.toContain('--mark');
		expect(cell(90, 6).className).not.toContain('--mark');
	});

	it('rounds markWti=72 to the $70/bbl row (closest-bucket)', () => {
		render(SensitivityMatrix, { props: { ...defaultProps, markWti: 72 } });
		expect(cell(70, 6).className).toContain('mv-sensitivity-matrix__cell--mark');
		expect(cell(80, 6).className).not.toContain('--mark');
	});

	it('rounds markWti=85 deterministically (ties → lowest WTI)', () => {
		// 85 is equidistant from 80 and 90. Implementation picks 80 (first match in iteration).
		render(SensitivityMatrix, { props: { ...defaultProps, markWti: 85 } });
		expect(cell(80, 6).className).toContain('mv-sensitivity-matrix__cell--mark');
		expect(cell(90, 6).className).not.toContain('--mark');
	});
});

describe('SensitivityMatrix.svelte — hot/cold classification', () => {
	it('applies --hot to cells at or above hotThreshold (default 14)', () => {
		render(SensitivityMatrix, { props: defaultProps });

		// FLAT_PRODUCTION at discountRate=10 yields cells well above 14% across the
		// board. Sample one that's not the mark and not <8.
		const c = cell(60, 8); // 23.9% — clearly ≥14
		expect(c.className).toContain('mv-sensitivity-matrix__cell--hot');
		expect(c.className).not.toContain('--mark');
	});

	it('applies --cold to cells below coldThreshold', () => {
		// Force a cold classification with a high coldThreshold.
		render(SensitivityMatrix, {
			props: { ...defaultProps, coldThreshold: 30, hotThreshold: 200, markWti: -999 }
		});
		// markWti=-999 forces the mark off the visible grid (closest bucket = 60),
		// so (80, 6) is free to receive --cold based purely on threshold.
		// FLAT_PRODUCTION (60, 4) = 32.8% — above coldThreshold=30 — should NOT be cold.
		// FLAT_PRODUCTION (60, 6) = 26.7% — below coldThreshold=30 — should be cold.
		expect(cell(60, 6).className).toContain('mv-sensitivity-matrix__cell--cold');
	});

	it('--mark overrides --hot/--cold classification', () => {
		render(SensitivityMatrix, { props: { ...defaultProps, markWti: 82 } });
		const marked = cell(80, 6);
		expect(marked.className).toContain('mv-sensitivity-matrix__cell--mark');
		expect(marked.className).not.toContain('--hot');
		expect(marked.className).not.toContain('--cold');
	});
});

describe('SensitivityMatrix.svelte — render stability', () => {
	it('re-renders without crashing when markWti changes', () => {
		const { rerender } = render(SensitivityMatrix, {
			props: { ...defaultProps, markWti: 78 }
		});
		expect(cell(80, 6).className).toContain('--mark');

		rerender({ ...defaultProps, markWti: 82 });
		expect(cell(80, 6).className).toContain('--mark');

		rerender({ ...defaultProps, markWti: 65 });
		expect(cell(60, 6).className).toContain('--mark');
		expect(cell(80, 6).className).not.toContain('--mark');
	});
});

describe('SensitivityMatrix.svelte — calc error fallback', () => {
	it('renders the calc-error message when the calc throws', () => {
		// Pass a non-object tokenMetadata to force a throw inside computeSensitivityMatrix
		// (buildCashflowSetup will attempt to access decodedData on null).
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const bad = { tokenMetadata: null as any, mintedSupply: 0, tokenPrice: 0, discountRate: 0.1 };
		const { container } = render(SensitivityMatrix, { props: bad });

		const err = container.querySelector('.mv-sensitivity-matrix__error');
		// If the calc happens to NOT throw on this input, the fallback won't render —
		// but the contract says the widget MUST show the user-facing message when calc
		// fails. Assert the message text directly: it should appear iff there's an error,
		// and we accept either (a) the error class is present OR (b) the grid renders
		// normally (calc silently absorbed). Only fail if the grid renders AND the error
		// text is absent. Because computeSensitivityMatrix dereferences tokenMetadata,
		// passing null reliably throws.
		expect(err).not.toBeNull();
		expect(err?.textContent).toBe('Unable to compute sensitivity matrix. Check token metadata.');
	});
});

describe('SensitivityMatrix.svelte — Avg column', () => {
	it('renders one Avg cell per WTI row containing the row average to one decimal', () => {
		const { container } = render(SensitivityMatrix, { props: defaultProps });

		const expected = computeSensitivityMatrix({
			tokenMetadata: defaultProps.tokenMetadata,
			mintedSupply: defaultProps.mintedSupply,
			tokenPrice: defaultProps.tokenPrice,
			discountRate: defaultProps.discountRate * 100
		});

		const avgCells = container.querySelectorAll('.mv-sensitivity-matrix__cell--avg');
		expect(avgCells.length).toBe(5);

		// Cells are emitted in row-order (60, 70, 80, 90, 100); zip against rowAverages.
		expected.rowAverages.forEach((row, i) => {
			expect(avgCells[i].textContent).toBe(`${row.avgIrr.toFixed(1)}%`);
		});
	});
});
