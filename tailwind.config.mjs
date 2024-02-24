/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: true,
	theme: {
		extend: {
			colors: {
				primary: {
					bg: 'rgb(var(--primary-bg) / <alpha-value>)',
					text: 'rgb(var(--primary-text) / <alpha-value>)'
				},
				accent: 'rgb(var(--accent) / <alpha-value>)'
			}
		}
	},
	plugins: []
}
