import { gsap } from 'gsap'

const initCursorBall = () => {
	const mouseBall = document.querySelector('.cursor__ball--big')
	const hoverables = document.querySelectorAll('.hoverable')

	document.body.addEventListener('mousemove', onMouseMove)
	for (let i = 0; i < hoverables.length; i++) {
		hoverables[i].addEventListener('mouseenter', onMouseHover)
		hoverables[i].addEventListener('mouseleave', onMouseHoverOut)
	}

	document.body.addEventListener('mouseleave', onMouseLeave)
	document.body.addEventListener('mouseenter', onMouseEnter)

	function onMouseLeave() {
		gsap.to(mouseBall, {
			duration: 0.3,
			scale: 1,
			opacity: 0
		})
	}

	function onMouseEnter() {
		gsap.to(mouseBall, {
			duration: 0.3,
			scale: 1,
			opacity: 1
		})
	}

	function onMouseMove(e: MouseEvent) {
		gsap.to(mouseBall, {
			duration: 0.5,
			x: e.clientX - 15,
			y: e.clientY - 17
		})
	}

	function onMouseHover() {
		gsap.to(mouseBall, {
			duration: 0.3,
			scale: 4
		})
	}

	function onMouseHoverOut() {
		gsap.to(mouseBall, {
			duration: 0.3,
			scale: 1
		})
	}
}

export default initCursorBall
