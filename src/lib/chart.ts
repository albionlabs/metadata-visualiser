/**
 * Chart.js loading and dataset building utilities.
 * Chart.js is loaded from CDN at runtime (no npm dependency).
 */

import { BROWSER } from 'esm-env';
import { parseNumber, normaliseMonth, toDate } from './utils.js';
import type { VisualiserMetadata } from './types.js';

// Chart.js types (minimal, for CDN-loaded library)
export type ChartInstance = {
	destroy: () => void;
	update: (mode?: string) => void;
	data: { datasets?: Array<Record<string, unknown>> };
} | null;

export type ChartConstructor = new (
	ctx: CanvasRenderingContext2D,
	config: Record<string, unknown>
) => NonNullable<ChartInstance>;

interface ChartJsWindow extends Window {
	Chart?: ChartConstructor;
}

let ChartCtor: ChartConstructor | null = null;
const scriptPromises = new Map<string, Promise<void>>();

/** Load a script from a URL, deduplicating concurrent loads */
export function loadScript(src: string): Promise<void> {
	if (!BROWSER) return Promise.resolve();
	if (scriptPromises.has(src)) return scriptPromises.get(src)!;

	const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
	if (existing?.dataset.loaded === 'true') return Promise.resolve();

	if (existing?.dataset.loading === 'true') {
		const promise = new Promise<void>((resolve, reject) => {
			existing.addEventListener('load', () => resolve(), { once: true });
			existing.addEventListener('error', () => reject(new Error(`Failed: ${src}`)), {
				once: true
			});
		});
		scriptPromises.set(src, promise);
		return promise;
	}

	const promise = new Promise<void>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = src;
		script.async = true;
		script.dataset.loading = 'true';
		script.addEventListener(
			'load',
			() => {
				script.dataset.loading = 'false';
				script.dataset.loaded = 'true';
				resolve();
			},
			{ once: true }
		);
		script.addEventListener(
			'error',
			() => {
				script.dataset.loading = 'false';
				reject(new Error(`Failed: ${src}`));
			},
			{ once: true }
		);
		document.head.appendChild(script);
	});

	promise.catch(() => {
		scriptPromises.delete(src);
	});

	scriptPromises.set(src, promise);
	return promise;
}

/** Load Chart.js and date-fns adapter from CDN */
export async function ensureChartLib(): Promise<ChartConstructor | null> {
	if (!BROWSER) return null;
	if (ChartCtor) return ChartCtor;
	if (typeof window !== 'undefined' && (window as ChartJsWindow).Chart) {
		ChartCtor = (window as ChartJsWindow).Chart ?? null;
		return ChartCtor;
	}
	try {
		await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js');
		await loadScript(
			'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js'
		);
		ChartCtor = (window as ChartJsWindow).Chart ?? null;
		return ChartCtor;
	} catch {
		return null;
	}
}

/** Chart dataset type */
export type ChartDataset = {
	label: string;
	data: Array<{ x: number; y: number }>;
	borderColor: string;
	backgroundColor?: string;
	borderWidth?: number;
	borderDash?: number[];
	pointRadius?: number;
	pointBackgroundColor?: string;
	tension?: number;
	fill?: boolean;
};

/** Extract planned projections from metadata */
export function getPlannedProjections(
	meta: VisualiserMetadata | null
): Array<{ month: string | null; production: number }> {
	if (!meta) return [];
	let current: unknown = meta.decodedData;
	for (const seg of ['asset', 'plannedProduction', 'projections']) {
		if (current && typeof current === 'object' && seg in current) {
			current = (current as Record<string, unknown>)[seg];
		} else {
			return [];
		}
	}
	if (!Array.isArray(current)) return [];
	return current
		.map((entry) => {
			const record = entry as Record<string, unknown>;
			const productionValue =
				record?.production ?? record?.value ?? (typeof entry === 'number' ? entry : 0);
			return {
				month: normaliseMonth(record?.month) ?? null,
				production: parseNumber(productionValue)
			};
		})
		.filter((e) => e.month && e.production > 0);
}

/**
 * Build Chart.js datasets from metadata (actual + forecast lines).
 * Colors are passed as parameters so the consuming component can read CSS vars.
 */
export function buildChartDatasets(
	meta: VisualiserMetadata | null,
	projections: Array<{ month: string | null; production: number }>,
	colors: { actual: string; forecast: string }
): ChartDataset[] {
	if (!BROWSER || !meta) return [];

	const getNode = (path: string[]): unknown => {
		let current: unknown = meta.decodedData;
		for (const seg of path) {
			if (current && typeof current === 'object' && seg in current) {
				current = (current as Record<string, unknown>)[seg];
			} else {
				return undefined;
			}
		}
		return current;
	};

	const historyRaw = getNode(['asset', 'historicalProduction']);
	const receiptsRaw = getNode(['asset', 'receiptsData']);

	const history = Array.isArray(historyRaw)
		? historyRaw
				.map((entry) => {
					const record = entry as Record<string, unknown>;
					const productionValue =
						record?.production ?? record?.value ?? (typeof entry === 'number' ? entry : 0);
					return {
						month: normaliseMonth(record?.month) ?? null,
						production: parseNumber(productionValue)
					};
				})
				.filter((e) => e.month && e.production >= 0)
		: [];

	const receipts = Array.isArray(receiptsRaw)
		? receiptsRaw
				.map((entry) => {
					const record = entry as Record<string, unknown>;
					const assetData = record?.assetData as Record<string, unknown> | undefined;
					return {
						month: normaliseMonth(record?.month) ?? null,
						production: parseNumber(assetData?.production ?? record?.production ?? 0)
					};
				})
				.filter((e) => e.month && e.production >= 0)
		: [];

	if (history.length === 0 && receipts.length === 0 && projections.length === 0) return [];

	const map = new Map<string, number>();
	for (const entry of [...history, ...receipts]) {
		if (!entry.month) continue;
		map.set(entry.month, (map.get(entry.month) ?? 0) + entry.production);
	}
	const actualSeries = Array.from(map.entries())
		.map(([month, production]) => ({ month, production }))
		.sort((a, b) => (toDate(a.month)?.getTime() ?? 0) - (toDate(b.month)?.getTime() ?? 0));

	const datasets: ChartDataset[] = [];
	if (actualSeries.length > 0) {
		datasets.push({
			label: 'Actual',
			data: actualSeries.map((p) => ({ x: toDate(p.month)?.getTime() ?? 0, y: p.production })),
			borderColor: colors.actual,
			backgroundColor: colors.actual,
			borderWidth: 2,
			pointRadius: 4,
			pointBackgroundColor: colors.actual,
			tension: 0.1,
			fill: false
		});
	}
	if (projections.length > 0) {
		datasets.push({
			label: 'Forecast',
			data: projections.map((p) => ({
				x: toDate(p.month ?? '')?.getTime() ?? 0,
				y: p.production
			})),
			borderColor: colors.forecast,
			backgroundColor: 'transparent',
			borderWidth: 2,
			borderDash: [5, 5],
			pointRadius: 0,
			tension: 0.1,
			fill: false
		});
	}
	return datasets;
}
