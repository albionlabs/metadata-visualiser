import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// In vitest, vite-plugin-svelte v5's style preprocessor calls
// `vite.preprocessCSS` which requires a `resolvedConfig.environments.client`
// that the plain `vite-plugin-svelte` plugin doesn't synthesize during a
// vitest run — manifests as `Cannot read properties of undefined (reading
// 'client')`. We skip the style preprocessor under vitest (the components'
// scoped `<style>` blocks are plain CSS — no postcss/scss/etc — so the
// preprocessing step is a no-op for runtime behaviour).
const isVitest = !!process.env.VITEST;

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(isVitest ? { style: false } : undefined),
	kit: {
		adapter: adapter()
	}
};

export default config;
