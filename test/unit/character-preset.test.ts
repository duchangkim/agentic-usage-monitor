import { describe, expect, it } from "bun:test"
import { getCharacterPreset, getCharacterPresetNames } from "../../src/tui/character/presets"
import type { CharacterPreset, CharacterState } from "../../src/tui/character/types"

const ALL_STATES: CharacterState[] = [
	"relaxed",
	"normal",
	"concerned",
	"critical",
	"rateLimit",
	"error",
]

function requirePreset(name: string): CharacterPreset {
	const preset = getCharacterPreset(name)
	if (!preset) throw new Error(`Preset "${name}" not found`)
	return preset
}

// ---- 1. Preset Registry ----

describe("Character Preset Registry", () => {
	it("should include 'robot' in preset names", () => {
		expect(getCharacterPresetNames()).toContain("robot")
	})

	it("should return undefined for unknown preset", () => {
		expect(getCharacterPreset("nonexistent")).toBeUndefined()
	})

	it("should return a preset for 'robot'", () => {
		expect(getCharacterPreset("robot")).toBeDefined()
	})
})

// ---- 2. Robot Preset Structure ----

describe("Robot Preset Structure", () => {
	it("should have name 'robot'", () => {
		const preset = requirePreset("robot")
		expect(preset.name).toBe("robot")
	})

	it("should have positive width and height", () => {
		const preset = requirePreset("robot")
		expect(preset.width).toBeGreaterThan(0)
		expect(preset.height).toBeGreaterThan(0)
	})

	it("should have all 6 character states", () => {
		const preset = requirePreset("robot")
		for (const state of ALL_STATES) {
			expect(preset.states[state]).toBeDefined()
		}
	})

	it("should have at least 2 frames per state (idle + blink)", () => {
		const preset = requirePreset("robot")
		for (const state of ALL_STATES) {
			expect(preset.states[state].frames.length).toBeGreaterThanOrEqual(2)
		}
	})
})

// ---- 3. Frame Dimension Consistency ----

describe("Robot Preset Frame Dimensions", () => {
	it("all frames should have exactly preset.height lines", () => {
		const preset = requirePreset("robot")
		for (const state of ALL_STATES) {
			for (const frame of preset.states[state].frames) {
				expect(frame.length).toBe(preset.height)
			}
		}
	})

	it("all frame lines should not exceed preset.width visible characters", () => {
		const preset = requirePreset("robot")
		for (const state of ALL_STATES) {
			for (const frame of preset.states[state].frames) {
				for (const line of frame) {
					expect(line.length).toBeLessThanOrEqual(preset.width)
				}
			}
		}
	})
})

// ---- 4. Mini States ----

describe("Robot Preset Mini States", () => {
	it("should have miniStates defined", () => {
		const preset = requirePreset("robot")
		expect(preset.miniStates).toBeDefined()
	})

	it("should have miniStates for all 6 character states", () => {
		const preset = requirePreset("robot")
		for (const state of ALL_STATES) {
			expect(preset.miniStates?.[state]).toBeDefined()
		}
	})

	it("each miniState should have exactly 2 lines", () => {
		const preset = requirePreset("robot")
		for (const state of ALL_STATES) {
			expect(preset.miniStates?.[state].length).toBe(2)
		}
	})

	it("miniStates should share the same head line (line 1)", () => {
		const preset = requirePreset("robot")
		const headLine = preset.miniStates?.relaxed[0]
		for (const state of ALL_STATES) {
			expect(preset.miniStates?.[state][0]).toBe(headLine)
		}
	})

	it("miniStates should have different face lines for distinct states", () => {
		const preset = requirePreset("robot")
		const relaxedFace = preset.miniStates?.relaxed[1]
		const normalFace = preset.miniStates?.normal[1]
		expect(relaxedFace).not.toBe(normalFace)
	})
})

// ---- 5. Animation Timing ----

describe("Robot Preset Animation Timing", () => {
	it("states with timing should have valid min < max intervals", () => {
		const preset = requirePreset("robot")
		for (const state of ALL_STATES) {
			const timing = preset.states[state].timing
			if (timing) {
				expect(timing.minIntervalMs).toBeGreaterThan(0)
				expect(timing.maxIntervalMs).toBeGreaterThan(timing.minIntervalMs)
			}
		}
	})

	it("preset defaultTiming should have valid intervals", () => {
		const preset = requirePreset("robot")
		if (preset.defaultTiming) {
			expect(preset.defaultTiming.minIntervalMs).toBeGreaterThan(0)
			expect(preset.defaultTiming.maxIntervalMs).toBeGreaterThan(preset.defaultTiming.minIntervalMs)
		}
	})

	it("preset speechTiming should have valid intervals", () => {
		const preset = requirePreset("robot")
		if (preset.speechTiming) {
			expect(preset.speechTiming.minIntervalMs).toBeGreaterThan(0)
			expect(preset.speechTiming.maxIntervalMs).toBeGreaterThan(preset.speechTiming.minIntervalMs)
		}
	})

	it("frameDurations length should match frames length when defined", () => {
		const preset = requirePreset("robot")
		for (const state of ALL_STATES) {
			const stateAnim = preset.states[state]
			if (stateAnim.frameDurations) {
				expect(stateAnim.frameDurations.length).toBe(stateAnim.frames.length)
			}
		}
	})

	it("frameDurations values should be positive when not null", () => {
		const preset = requirePreset("robot")
		for (const state of ALL_STATES) {
			const durations = preset.states[state].frameDurations
			if (durations) {
				for (const d of durations) {
					if (d != null) expect(d).toBeGreaterThan(0)
				}
			}
		}
	})
})

// ---- 6. Speech Bubbles ----

describe("Robot Preset Speech Bubbles", () => {
	it("should have English speech bubbles", () => {
		const preset = requirePreset("robot")
		expect(preset.speechBubbles.en).toBeDefined()
	})

	it("should have Korean speech bubbles", () => {
		const preset = requirePreset("robot")
		expect(preset.speechBubbles.ko).toBeDefined()
	})

	it("should have messages for all states in each language", () => {
		const preset = requirePreset("robot")
		for (const lang of ["en", "ko"]) {
			const messages = preset.speechBubbles[lang]
			for (const state of ALL_STATES) {
				expect(messages[state].length).toBeGreaterThan(0)
			}
		}
	})
})
