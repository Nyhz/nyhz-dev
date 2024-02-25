import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: true,
	theme: {
		extend: {
			colors: {
				primary: {
					bg: 'rgb(var(--primary-bg) / <alpha-value>)',
					'back-bg': 'rgb(var(--primary-back-bg) / <alpha-value>)',
					text: 'rgb(var(--primary-text) / <alpha-value>)',
					accent: 'rgb(var(--primary-accent) / <alpha-value>)'
				},
				secondary: {
					bg: 'rgb(var(--secondary-bg) / <alpha-value>)'
				},
				label: {
					bg: 'rgb(var(--label-bg) / <alpha-value>)'
				}
			},
			fontFamily: {
				sans: ['Jost Variable', ...defaultTheme.fontFamily.sans]
			},
			keyframes: {},
			animation: {}
		}
	},
	plugins: [require('tailwindcss-animated')]
}
