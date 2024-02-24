export const switchColor = () => {
	const root = document.documentElement
	const currentTheme = root.getAttribute('theme')
	const newTheme = currentTheme === 'light' ? 'dark' : 'light'
	const lightIcon = document.getElementById('light-icon')
	const darkIcon = document.getElementById('dark-icon')

	if (newTheme === 'dark') {
		darkIcon?.classList.add('hidden')
		lightIcon?.classList.remove('hidden')
	} else {
		darkIcon?.classList.remove('hidden')
		lightIcon?.classList.add('hidden')
	}

	root.setAttribute('theme', newTheme)
	localStorage.setItem('theme', newTheme)
}
