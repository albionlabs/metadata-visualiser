import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
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
