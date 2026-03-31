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

	let isLoading = $state(false);

	async function viewTerms() {
		if (!tokenTermsUrl) return;

		if (!tokenTermsUrl.endsWith('.md')) {
			window.open(tokenTermsUrl, '_blank', 'noopener,noreferrer');
			return;
		}

		isLoading = true;
		try {
			const [response, { marked }] = await Promise.all([
				fetch(tokenTermsUrl),
				import('marked')
			]);
			const markdown = await response.text();
			const renderedHtml = await marked.parse(markdown);

			const pageHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Token Terms</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 860px; margin: 2rem auto; padding: 1rem 2rem; color: #1a1a2e; line-height: 1.7; }
  h1 { font-size: 1.75rem; color: #233d80; border-bottom: 2px solid #e7ebf6; padding-bottom: 0.5rem; }
  h2 { font-size: 1.25rem; color: #233d80; border-bottom: 1px solid #e7ebf6; padding-bottom: 0.25rem; margin-top: 2rem; }
  h3 { font-size: 1rem; color: #233d80; margin-top: 1.5rem; }
  a { color: #233d80; }
  p { margin: 0.75rem 0; }
  ul, ol { margin: 0.75rem 0; padding-left: 1.5rem; }
  li { margin: 0.25rem 0; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; text-align: left; }
  th { background: #f8fafc; font-weight: 600; }
  code { background: #f8fafc; padding: 0.125rem 0.375rem; border-radius: 4px; font-size: 0.875em; }
  pre { background: #f8fafc; padding: 1rem; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 4px solid #e7ebf6; margin: 1rem 0; padding: 0.5rem 1rem; color: #475569; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 2rem 0; }
</style>
</head>
<body>
${renderedHtml}
</body>
</html>`;

			const blob = new Blob([pageHtml], { type: 'text/html' });
			const blobUrl = URL.createObjectURL(blob);
			window.open(blobUrl, '_blank', 'width=920,height=700,scrollbars=yes,resizable=yes');
			setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
		} catch {
			window.open(tokenTermsUrl, '_blank', 'noopener,noreferrer');
		} finally {
			isLoading = false;
		}
	}
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
				<button
					class="mv-token-rights__link"
					onclick={viewTerms}
					disabled={isLoading}
				>
					{isLoading ? 'Loading...' : 'View token terms'}
				</button>
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
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-thickness: 2px;
		text-underline-offset: 4px;
		color: var(--mv-accent, #233d80);
		font-size: inherit;
	}

	.mv-token-rights__link:disabled {
		opacity: 0.6;
		cursor: not-allowed;
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
