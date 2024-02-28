// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
declare module 'typewriter-effect/dist/core'

interface Window {
	getThemePreference(): 'dark' | 'light'
}
