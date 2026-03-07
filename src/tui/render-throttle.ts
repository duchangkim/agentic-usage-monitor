export interface RenderThrottle {
	call(): void
	dispose(): void
}

export function createRenderThrottle(fn: () => void, intervalMs: number): RenderThrottle {
	let pending = false
	let timer: ReturnType<typeof setTimeout> | null = null

	const call = (): void => {
		if (timer) {
			pending = true
			return
		}
		fn()
		timer = setTimeout(() => {
			timer = null
			if (pending) {
				pending = false
				fn()
			}
		}, intervalMs)
	}

	const dispose = (): void => {
		if (timer) {
			clearTimeout(timer)
			timer = null
		}
		pending = false
	}

	return { call, dispose }
}
