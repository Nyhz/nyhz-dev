const initTheme = () => {
	const html = document.documentElement

	if (html.getAttribute('theme')) {
		const body = document.body
		body.classList.remove('hidden')
	}
}

export default initTheme
