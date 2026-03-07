import { describe, expect, it } from "bun:test"
import { createRenderThrottle } from "../../src/tui/render-throttle"

describe("createRenderThrottle", () => {
	it("executes first call immediately", () => {
		let callCount = 0
		const throttled = createRenderThrottle(() => callCount++, 30)
		throttled.call()
		expect(callCount).toBe(1)
		throttled.dispose()
	})

	it("coalesces rapid calls into at most 2", async () => {
		let callCount = 0
		const throttled = createRenderThrottle(() => callCount++, 30)

		// First call executes immediately
		throttled.call()
		// Rapid subsequent calls within throttle window
		for (let i = 0; i < 10; i++) {
			throttled.call()
		}

		// Wait for throttle timer to flush
		await new Promise((resolve) => setTimeout(resolve, 50))

		// First call + 1 trailing flush = 2
		expect(callCount).toBe(2)
		throttled.dispose()
	})

	it("allows new immediate call after throttle window expires", async () => {
		let callCount = 0
		const throttled = createRenderThrottle(() => callCount++, 20)

		throttled.call() // immediate
		await new Promise((resolve) => setTimeout(resolve, 40))

		throttled.call() // should be immediate again
		expect(callCount).toBe(2)
		throttled.dispose()
	})

	it("dispose clears pending timer", async () => {
		let callCount = 0
		const throttled = createRenderThrottle(() => callCount++, 30)

		throttled.call() // immediate (1)
		throttled.call() // pending
		throttled.dispose()

		await new Promise((resolve) => setTimeout(resolve, 50))
		// Pending call should NOT have fired
		expect(callCount).toBe(1)
	})
})
