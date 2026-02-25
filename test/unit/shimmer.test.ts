import { describe, expect, it } from "bun:test"
import { ShimmerAnimator, getShimmerIntensity } from "../../src/tui/character/shimmer"
import type { ShimmerState } from "../../src/tui/character/shimmer"

describe("ShimmerAnimator", () => {
	it("initial state is inactive", () => {
		const animator = new ShimmerAnimator(() => {})
		const state = animator.state
		expect(state.active).toBe(false)
		expect(state.position).toBeNull()
	})

	it("start() activates shimmer", () => {
		const animator = new ShimmerAnimator(() => {})
		animator.start()
		expect(animator.state.active).toBe(true)
		animator.stop()
	})

	it("stop() deactivates shimmer", () => {
		const animator = new ShimmerAnimator(() => {})
		animator.start()
		animator.stop()
		expect(animator.state.active).toBe(false)
	})

	it("updateForState does not crash for any state", () => {
		const animator = new ShimmerAnimator(() => {})
		animator.start()
		expect(() => animator.updateForState("critical")).not.toThrow()
		expect(() => animator.updateForState("relaxed")).not.toThrow()
		animator.stop()
	})

	it("debounces rapid fires (frame interval >= 150ms)", async () => {
		let callCount = 0
		const animator = new ShimmerAnimator(
			() => {
				callCount++
			},
			{ frameIntervalMs: 150 },
		)
		animator.start()
		// Wait 400ms — at most ceil(400/150) = 3 fires expected
		await new Promise((resolve) => setTimeout(resolve, 400))
		animator.stop()
		expect(callCount).toBeLessThanOrEqual(3)
	})
})

describe("getShimmerIntensity", () => {
	it("returns 0 when shimmer is inactive", () => {
		const state: ShimmerState = { active: false, position: null, radius: 2 }
		expect(getShimmerIntensity(1, 1, state)).toBe(0)
	})

	it("returns > 0 near shimmer position", () => {
		const state: ShimmerState = { active: true, position: { row: 1, col: 1 }, radius: 2 }
		expect(getShimmerIntensity(1, 2, state)).toBeGreaterThan(0)
	})

	it("returns 0 far from shimmer position", () => {
		const state: ShimmerState = { active: true, position: { row: 0, col: 0 }, radius: 2 }
		expect(getShimmerIntensity(10, 10, state)).toBe(0)
	})
})
