<script lang="ts">
	import type { Snippet } from 'svelte';
	import { formatNumber } from '../utils.js';

	interface Props {
		sharePercentage: number | null;
		interestType?: string | null;
		tokenTermsUrl?: string | null;
		firstPaymentDate?: string | null;
		royaltyTooltip?: string | null;
		children?: Snippet;
	}

	let {
		sharePercentage,
		interestType = null,
		tokenTermsUrl = null,
		firstPaymentDate = null,
		royaltyTooltip = null,
		children
	}: Props = $props();
</script>

{#if sharePercentage || interestType}
	<div class="mv-token-rights">
		<p class="mv-token-rights__label">Token rights</p>
		<p class="mv-token-rights__text">
			<strong class="mv-token-rights__highlight">
				Token holders collectively are entitled to {formatNumber(
					sharePercentage ?? 0,
					(sharePercentage ?? 0) >= 1 ? 1 : 2
				)}%
				{#if interestType}{interestType}{/if} share of production{#if firstPaymentDate}
					{' '}since {firstPaymentDate}{/if}.
			</strong>
			{#if tokenTermsUrl}
				<a
					href={tokenTermsUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="mv-token-rights__link"
				>
					View token terms
				</a>
			{/if}
			{#if royaltyTooltip}
				<span class="mv-token-rights__tooltip" title={royaltyTooltip}>i</span>
			{/if}
		</p>
		{#if children}
			{@render children()}
		{/if}
	</div>
{/if}

<style>
	.mv-token-rights {
		border-radius: 1rem;
		border: 1px solid var(--mv-accent-border, #e7ebf6);
		background: var(--mv-accent-bg, rgba(231, 235, 246, 0.4));
		padding: 0.75rem 1rem;
	}

	.mv-token-rights__label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--mv-accent, #233d80);
	}

	.mv-token-rights__text {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: var(--mv-text-secondary, #475569);
	}

	.mv-token-rights__highlight {
		color: var(--mv-accent, #233d80);
	}

	.mv-token-rights__link {
		display: block;
		margin-top: 0.5rem;
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 4px;
		color: var(--mv-accent, #233d80);
	}

	.mv-token-rights__tooltip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		margin-left: 0.5rem;
		border-radius: 50%;
		border: 1px solid var(--mv-border, #e2e8f0);
		font-size: 0.75rem;
		color: var(--mv-text-muted, #94a3b8);
		cursor: help;
	}
</style>
