<script lang="ts">
	import { BROWSER } from 'esm-env';
	import { onDestroy, tick } from 'svelte';
	import type { VisualiserMetadata } from '../types.js';
	import {
		ensureChartLib,
		buildChartDatasets,
		getPlannedProjections,
		type ChartInstance,
		type ChartConstructor
	} from '../chart.js';

	interface Props {
		metadata: VisualiserMetadata | null;
	}

	let { metadata }: Props = $props();

	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let hasChartData = $state(false);
	let chartRenderToken = 0;
	let chartInstance: ChartInstance = null;

	if (BROWSER) void ensureChartLib();

	function getChartColors(canvas: HTMLCanvasElement): {
		actual: string;
		forecast: string;
		grid: string;
		text: string;
		legend: string;
	} {
		const style = getComputedStyle(canvas);
		return {
			actual: style.getPropertyValue('--mv-chart-actual').trim() || '#0f172a',
			forecast: style.getPropertyValue('--mv-chart-forecast').trim() || '#38bdf8',
			grid: style.getPropertyValue('--mv-chart-grid').trim() || 'rgba(148,163,184,0.15)',
			text: style.getPropertyValue('--mv-chart-text').trim() || '#64748b',
			legend: style.getPropertyValue('--mv-chart-text').trim() || '#64748b'
		};
	}

	async function updateChart(
		canvas: HTMLCanvasElement,
		meta: VisualiserMetadata | null
	) {
		const currentToken = ++chartRenderToken;
		await tick();
		if (currentToken !== chartRenderToken || !canvas.isConnected) return;

		hasChartData = false;
		const projections = getPlannedProjections(meta);
		const colors = getChartColors(canvas);
		const datasets = buildChartDatasets(meta, projections, {
			actual: colors.actual,
			forecast: colors.forecast
		});
		hasChartData = datasets.length > 0;

		if (datasets.length === 0) {
			if (chartInstance) {
				chartInstance.destroy();
				chartInstance = null;
			}
			return;
		}

		const Chart: ChartConstructor | null = await ensureChartLib();
		if (!Chart || currentToken !== chartRenderToken || !canvas.isConnected) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}

		chartInstance = new Chart(ctx, {
			type: 'line',
			data: { datasets },
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				interaction: { mode: 'nearest', intersect: false },
				plugins: {
					legend: {
						position: 'bottom',
						labels: { color: colors.legend, usePointStyle: true }
					},
					tooltip: {
						callbacks: {
							title: (items: Array<{ parsed?: { x?: number } }>) => {
								if (items.length === 0) return '';
								const timestamp = items[0].parsed?.x;
								if (!timestamp) return '';
								return new Date(timestamp).toLocaleDateString('en-US', {
									month: 'short',
									year: 'numeric'
								});
							},
							label: (context: {
								dataset?: { label?: string };
								parsed?: { y?: number };
							}) => {
								const label = context.dataset?.label || '';
								const value = context.parsed?.y ?? 0;
								return `${label}: ${value.toLocaleString()} barrels`;
							}
						}
					}
				},
				scales: {
					x: {
						type: 'time',
						time: {
							unit: 'month',
							displayFormats: { month: 'MMM yyyy' },
							tooltipFormat: 'MMM yyyy'
						},
						ticks: { color: colors.text, maxRotation: 0, autoSkip: true },
						grid: { color: colors.grid }
					},
					y: {
						beginAtZero: true,
						title: { display: true, text: 'Barrels', color: colors.text },
						ticks: {
							color: colors.text,
							callback: (value: string | number) => Number(value).toLocaleString()
						},
						grid: { color: colors.grid }
					}
				}
			}
		});
	}

	$effect(() => {
		if (BROWSER && chartCanvas && metadata) {
			void updateChart(chartCanvas, metadata);
		}
	});

	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}
	});
</script>

<div class="mv-chart">
	<div class="mv-chart__header">
		<h3 class="mv-chart__title">Production profile</h3>
		{#if hasChartData}
			<span class="mv-chart__subtitle">Monthly barrels</span>
		{/if}
	</div>
	<div class="mv-chart__body">
		<div class="mv-chart__canvas-wrap" class:mv-chart--hidden={!hasChartData}>
			<canvas bind:this={chartCanvas} class="mv-chart__canvas"></canvas>
		</div>
		{#if !hasChartData}
			<p class="mv-chart__empty">No production data available for charting.</p>
		{/if}
	</div>
</div>

<style>
	.mv-chart {
		margin-top: 2rem;
	}

	.mv-chart__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.mv-chart__title {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-chart__subtitle {
		font-size: 0.75rem;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-chart__body {
		margin-top: 0.75rem;
	}

	.mv-chart__canvas-wrap {
		position: relative;
		height: 280px;
	}

	.mv-chart--hidden {
		display: none;
	}

	.mv-chart__canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.mv-chart__empty {
		margin-top: 0.75rem;
		font-size: 0.875rem;
		color: var(--mv-text-muted, #94a3b8);
	}
</style>
