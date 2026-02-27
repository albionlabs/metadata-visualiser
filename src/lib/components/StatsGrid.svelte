<script lang="ts">
	import { formatNumber } from '../utils.js';

	interface Props {
		expectedBarrels: number | null;
		uptimePercentage: number | null;
		incidentFreeDays: number | null;
	}

	let { expectedBarrels, uptimePercentage, incidentFreeDays }: Props = $props();
</script>

<div class="mv-stats-grid">
	<div class="mv-stats-grid__card">
		<p class="mv-stats-grid__label">Expected barrels</p>
		<p class="mv-stats-grid__value">
			{expectedBarrels
				? formatNumber(expectedBarrels, expectedBarrels >= 1000 ? 0 : 1)
				: '\u2014'}
		</p>
		<p class="mv-stats-grid__sub">Based on production plan.</p>
	</div>
	<div class="mv-stats-grid__card">
		<p class="mv-stats-grid__label">Last 30 day uptime</p>
		<p class="mv-stats-grid__value">
			{uptimePercentage !== null ? `${formatNumber(uptimePercentage, 1)}%` : '\u2014'}
		</p>
		<p class="mv-stats-grid__sub">Operational uptime reported.</p>
	</div>
	<div class="mv-stats-grid__card">
		<p class="mv-stats-grid__label">Incident-free days</p>
		<p class="mv-stats-grid__value">
			{incidentFreeDays !== null ? `>${Math.trunc(incidentFreeDays)} days` : '\u2014'}
		</p>
		<p class="mv-stats-grid__sub">Safety streak reported by operator.</p>
	</div>
</div>

<style>
	.mv-stats-grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(3, 1fr);
	}

	@media (max-width: 640px) {
		.mv-stats-grid {
			grid-template-columns: 1fr;
		}
	}

	.mv-stats-grid__card {
		border-radius: 1rem;
		border: 1px solid var(--mv-border, #e2e8f0);
		background: var(--mv-bg-secondary, #f8fafc);
		padding: 0.75rem 1rem;
	}

	.mv-stats-grid__label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--mv-text-muted, #94a3b8);
	}

	.mv-stats-grid__value {
		margin-top: 0.25rem;
		font-size: 1.125rem;
		font-weight: 600;
		color: var(--mv-text-primary, #0f172a);
	}

	.mv-stats-grid__sub {
		font-size: 0.75rem;
		color: var(--mv-text-muted, #94a3b8);
	}
</style>
