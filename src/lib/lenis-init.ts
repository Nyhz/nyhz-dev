import Lenis from '@studio-freight/lenis'

const initLenis = () => {
	const lenis = new Lenis()

	function raf(time: number) {
		lenis.raf(time)
		requestAnimationFrame(raf)
	}

	requestAnimationFrame(raf)
}

export default initLenis
