const initPreference = () => {
	if (window.getThemePreference() === 'dark') {
		document.documentElement.setAttribute('theme', 'dark')
		const lightIcon = document.getElementById('light-icon')
		if (lightIcon) lightIcon.classList.remove('hidden')
	} else {
		document.documentElement.setAttribute('theme', 'light')
		const darkIcon = document.getElementById('dark-icon')
		if (darkIcon) darkIcon.classList.remove('hidden')
	}
}

export default initPreference
