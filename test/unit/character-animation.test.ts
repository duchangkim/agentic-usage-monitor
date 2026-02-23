import { afterEach, describe, expect, it } from "bun:test"
import { CharacterAnimator } from "../../src/tui/character/animation"
import { getCharacterPreset } from "../../src/tui/character/presets"
import type { CharacterPreset } from "../../src/tui/character/types"

function requirePreset(name: string): CharacterPreset {
	const preset = getCharacterPreset(name)
	if (!preset) throw new Error(`Preset "${name}" not found`)
	return preset
}

const robot = requirePreset("robot")

// ---- 1. Constructor ----

describe("CharacterAnimator - constructor", () => {
	let animator: CharacterAnimator

	afterEach(() => {
		animator?.stop()
	})

	it("should start with frame 0", () => {
		animator = new CharacterAnimator(robot, () => {})
		expect(animator.currentFrame).toBe(0)
	})

	it("should start with state 'relaxed' by default", () => {
		animator = new CharacterAnimator(robot, () => {})
		expect(animator.state).toBe("relaxed")
	})
})

// ---- 2. State Changes ----

describe("CharacterAnimator - state changes", () => {
	let animator: CharacterAnimator

	afterEach(() => {
		animator?.stop()
	})

	it("should update state via setState()", () => {
		animator = new CharacterAnimator(robot, () => {})
		animator.setState("critical")
		expect(animator.state).toBe("critical")
	})

	it("should reset frame to 0 when state changes", () => {
		const calls: number[] = []
		animator = new CharacterAnimator(robot, (frame) => calls.push(frame), {
			minIntervalMs: 10,
			maxIntervalMs: 20,
		})
		animator.start()

		// Wait for at least one frame advance
		return new Promise<void>((resolve) => {
			setTimeout(() => {
				animator.setState("concerned")
				expect(animator.currentFrame).toBe(0)
				resolve()
			}, 50)
		})
	})
})

// ---- 3. Animation Callback ----

describe("CharacterAnimator - animation", () => {
	let animator: CharacterAnimator

	afterEach(() => {
		animator?.stop()
	})

	it("should call callback when frame changes", () => {
		return new Promise<void>((resolve) => {
			let callCount = 0
			animator = new CharacterAnimator(
				robot,
				() => {
					callCount++
					if (callCount >= 2) {
						expect(callCount).toBeGreaterThanOrEqual(2)
						resolve()
					}
				},
				{ minIntervalMs: 10, maxIntervalMs: 20 },
			)
			animator.start()
		})
	})

	it("should cycle through frames", () => {
		return new Promise<void>((resolve) => {
			const frames: number[] = []
			const frameCount = robot.states.relaxed.frames.length
			animator = new CharacterAnimator(
				robot,
				(frame) => {
					frames.push(frame)
					if (frames.length >= 3) {
						expect(frames.every((f) => f >= 0 && f < frameCount)).toBe(true)
						resolve()
					}
				},
				{ minIntervalMs: 10, maxIntervalMs: 20 },
			)
			animator.start()
		})
	})
})

// ---- 4. Start/Stop ----

describe("CharacterAnimator - start/stop", () => {
	let animator: CharacterAnimator

	afterEach(() => {
		animator?.stop()
	})

	it("should not call callback after stop()", () => {
		return new Promise<void>((resolve) => {
			let callsAfterStop = 0
			let stopped = false
			animator = new CharacterAnimator(
				robot,
				() => {
					if (stopped) callsAfterStop++
				},
				{ minIntervalMs: 10, maxIntervalMs: 20 },
			)
			animator.start()

			setTimeout(() => {
				animator.stop()
				stopped = true
			}, 50)

			setTimeout(() => {
				expect(callsAfterStop).toBe(0)
				resolve()
			}, 150)
		})
	})
})

// ---- 5. Preset Update ----

describe("CharacterAnimator - updatePreset", () => {
	let animator: CharacterAnimator

	afterEach(() => {
		animator?.stop()
	})

	it("should accept a new preset via updatePreset()", () => {
		animator = new CharacterAnimator(robot, () => {})
		// Just verify it doesn't throw
		animator.updatePreset(robot)
		expect(animator.currentFrame).toBe(0)
	})
})

// ---- 6. Speech Message Management ----

describe("CharacterAnimator - speech messages", () => {
	let animator: CharacterAnimator

	afterEach(() => {
		animator?.stop()
	})

	it("currentMessage should be non-empty after start()", () => {
		animator = new CharacterAnimator(robot, () => {})
		animator.start()
		expect(animator.currentMessage.length).toBeGreaterThan(0)
	})

	it("should pick new message on state change", () => {
		animator = new CharacterAnimator(robot, () => {})
		animator.start()
		// Change state to get a different message pool
		animator.setState("critical")
		const criticalMessage = animator.currentMessage
		// The message should come from the critical pool
		const criticalMessages = robot.speechBubbles.en.critical
		expect(criticalMessages).toContain(criticalMessage)
	})

	it("should accept language option", () => {
		animator = new CharacterAnimator(robot, () => {}, { language: "ko" })
		animator.start()
		const msg = animator.currentMessage
		// Should come from Korean message pool for relaxed state
		const koMessages = robot.speechBubbles.ko.relaxed
		expect(koMessages).toContain(msg)
	})
})
