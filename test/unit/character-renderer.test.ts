import { describe, expect, it } from "bun:test"
import { getCharacterPreset } from "../../src/tui/character/presets"
import {
	getCharacterHeight,
	renderCharacter,
	renderMiniCharacter,
} from "../../src/tui/character/renderer"
import type { CharacterPreset } from "../../src/tui/character/types"

function requirePreset(name: string): CharacterPreset {
	const preset = getCharacterPreset(name)
	if (!preset) throw new Error(`Preset "${name}" not found`)
	return preset
}

const robot = requirePreset("robot")

// ---- 1. Basic Rendering ----

describe("renderCharacter - basic", () => {
	it("should return lines for character without speech bubble", () => {
		const result = renderCharacter(robot, "relaxed", 0, 30, "en", false)
		expect(result.lines.length).toBe(robot.height)
		expect(result.totalHeight).toBe(robot.height)
	})

	it("should return lines for character with speech bubble", () => {
		const result = renderCharacter(robot, "relaxed", 0, 30, "en", true)
		// speech bubble = 3 lines (top border, message, bottom border+tail) + character
		expect(result.lines.length).toBe(robot.height + 3)
		expect(result.totalHeight).toBe(robot.height + 3)
	})

	it("should return correct width matching availableWidth", () => {
		const result = renderCharacter(robot, "normal", 0, 25, "en", false)
		expect(result.width).toBe(25)
	})
})

// ---- 2. Frame Selection ----

describe("renderCharacter - frame selection", () => {
	it("should render different content for distinct frames", () => {
		// relaxed frame 0 = ◠◠ (idle), frame 4 = ── (blink)
		const frame0 = renderCharacter(robot, "relaxed", 0, 30, "en", false)
		const frameBlink = renderCharacter(robot, "relaxed", 4, 30, "en", false)
		expect(frame0.lines.join("")).not.toBe(frameBlink.lines.join(""))
	})

	it("should wrap around if frameIndex exceeds frame count", () => {
		const frameCount = robot.states.relaxed.frames.length
		const normal = renderCharacter(robot, "relaxed", 0, 30, "en", false)
		const wrapped = renderCharacter(robot, "relaxed", frameCount, 30, "en", false)
		expect(normal.lines.join("")).toBe(wrapped.lines.join(""))
	})
})

// ---- 3. Speech Bubble ----

describe("renderCharacter - speech bubble", () => {
	it("should contain speech bubble border characters when enabled", () => {
		const result = renderCharacter(robot, "relaxed", 0, 30, "en", true)
		const allText = result.lines.join("\n")
		expect(allText).toContain("┌")
		expect(allText).toContain("┘")
	})

	it("should contain a message from the preset's speech pool", () => {
		const result = renderCharacter(robot, "relaxed", 0, 30, "en", true)
		const allText = result.lines.join("\n")
		const messages = robot.speechBubbles.en.relaxed
		const hasMessage = messages.some((msg) => allText.includes(msg))
		expect(hasMessage).toBe(true)
	})

	it("should use Korean messages when language is 'ko'", () => {
		const result = renderCharacter(robot, "relaxed", 0, 30, "ko", true)
		const allText = result.lines.join("\n")
		const messages = robot.speechBubbles.ko.relaxed
		const hasMessage = messages.some((msg) => allText.includes(msg))
		expect(hasMessage).toBe(true)
	})

	it("should fall back to English when unknown language", () => {
		const result = renderCharacter(robot, "relaxed", 0, 30, "fr", true)
		const allText = result.lines.join("\n")
		const messages = robot.speechBubbles.en.relaxed
		const hasMessage = messages.some((msg) => allText.includes(msg))
		expect(hasMessage).toBe(true)
	})
})

// ---- 4. getCharacterHeight ----

describe("getCharacterHeight", () => {
	it("should return preset.height when no speech bubble", () => {
		expect(getCharacterHeight(robot, false)).toBe(robot.height)
	})

	it("should return preset.height + 3 when speech bubble enabled", () => {
		expect(getCharacterHeight(robot, true)).toBe(robot.height + 3)
	})
})

// ---- 5. Center alignment ----

describe("renderCharacter - alignment", () => {
	it("should center-align character lines within availableWidth", () => {
		const width = 30
		const result = renderCharacter(robot, "relaxed", 0, width, "en", false)
		for (const line of result.lines) {
			expect(line.length).toBe(width)
		}
	})

	it("should center-align all lines including speech bubble", () => {
		const width = 30
		const result = renderCharacter(robot, "relaxed", 0, width, "en", true)
		for (const line of result.lines) {
			expect(line.length).toBe(width)
		}
	})
})

// ---- 6. Message parameter ----

describe("renderCharacter - message parameter", () => {
	it("should use provided message when message parameter given", () => {
		const customMsg = "Custom message!"
		const result = renderCharacter(robot, "relaxed", 0, 30, "en", true, customMsg)
		const allText = result.lines.join("\n")
		expect(allText).toContain(customMsg)
	})

	it("should fall back to pickMessage when message undefined", () => {
		const result = renderCharacter(robot, "relaxed", 0, 30, "en", true, undefined)
		const allText = result.lines.join("\n")
		const messages = robot.speechBubbles.en.relaxed
		const hasMessage = messages.some((msg) => allText.includes(msg))
		expect(hasMessage).toBe(true)
	})
})

// ---- 7. renderMiniCharacter ----

describe("renderMiniCharacter", () => {
	it("should return 2 raw frame lines for robot preset", () => {
		const result = renderMiniCharacter(robot, "relaxed")
		expect(result).not.toBeNull()
		expect(result?.length).toBe(2)
	})

	it("should return raw frame lines without extra padding", () => {
		const result = renderMiniCharacter(robot, "normal")
		expect(result).not.toBeNull()
		// Lines should match the preset's miniStates exactly
		expect(result?.[0]).toBe(robot.miniStates?.normal[0])
		expect(result?.[1]).toBe(robot.miniStates?.normal[1])
	})

	it("should return null for preset without miniStates", () => {
		const presetWithoutMini: CharacterPreset = {
			name: "test",
			width: 5,
			height: 1,
			states: {
				relaxed: { frames: [["test"]] },
				normal: { frames: [["test"]] },
				concerned: { frames: [["test"]] },
				critical: { frames: [["test"]] },
				rateLimit: { frames: [["test"]] },
				error: { frames: [["test"]] },
			},
			speechBubbles: {
				en: { relaxed: [], normal: [], concerned: [], critical: [], rateLimit: [], error: [] },
			},
		}
		const result = renderMiniCharacter(presetWithoutMini, "relaxed")
		expect(result).toBeNull()
	})

	it("should render different face for different states", () => {
		const relaxed = renderMiniCharacter(robot, "relaxed")
		const critical = renderMiniCharacter(robot, "critical")
		expect(relaxed).not.toBeNull()
		expect(critical).not.toBeNull()
		// Line 1 (head) should be the same
		expect(relaxed?.[0]).toBe(critical?.[0])
		// Line 2 (face) should differ
		expect(relaxed?.[1]).not.toBe(critical?.[1])
	})

	it("should contain robot head characters", () => {
		const result = renderMiniCharacter(robot, "normal")
		expect(result).not.toBeNull()
		const allText = (result ?? []).join("\n")
		expect(allText).toContain("▗▟███▙▖")
		expect(allText).toContain("▐█")
	})
})
