import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

// NOTE: tests use the plain `@sveltejs/vite-plugin-svelte` rather than the full
// `sveltekit()` plugin so that vitest doesn't hit a `preprocessCSS` crash
// caused by SvelteKit's vite plugin not exposing `environments.client` in test
// mode. The unit tests don't need SvelteKit's filesystem router; they only
// need Svelte component compilation + the testing-library/svelte runtime.
export default defineConfig({
	plugins: [svelte({ hot: false }), svelteTesting()],
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./tests/setup.ts'],
		include: ['tests/**/*.test.ts', 'tests/**/*.svelte.test.ts'],
		server: {
			deps: {
				inline: ['@testing-library/svelte']
			}
		}
	}
});
