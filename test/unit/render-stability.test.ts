import { describe, expect, it } from "bun:test"
import { colorizeLineMetallic, getMetallicCharacterColors } from "../../src/tui/character/colorizer"
import { ROBOT_LUMINANCE_MAP } from "../../src/tui/character/metallic"
import { getCharacterPreset } from "../../src/tui/character/presets"
import { renderCharacter, renderMiniCharacter } from "../../src/tui/character/renderer"
import type { ShimmerState } from "../../src/tui/character/shimmer"
import type { CharacterPreset } from "../../src/tui/character/types"
import { stripAnsi } from "../../src/tui/renderer"

function requirePreset(name: string): CharacterPreset {
	const preset = getCharacterPreset(name)
	if (!preset) throw new Error(`Preset "${name}" not found`)
	return preset
}

const robot = requirePreset("robot")
const WIDTH = 30

const noShimmer: ShimmerState = { active: false, diagonalStep: null, radius: 2 }
const activeShimmer: ShimmerState = { active: true, diagonalStep: 6, radius: 2 }

describe("renderCharacter - output dimensional stability", () => {
	it("produces stable line count with/without shimmer", () => {
		const withoutShimmer = renderCharacter(robot, "normal", 0, WIDTH, "en", true, "test", noShimmer)
		const withShimmer = renderCharacter(
			robot,
			"normal",
			0,
			WIDTH,
			"en",
			true,
			"test",
			activeShimmer,
		)
		expect(withShimmer.lines.length).toBe(withoutShimmer.lines.length)
		expect(withShimmer.totalHeight).toBe(withoutShimmer.totalHeight)
	})

	it("produces stable visual line widths with/without shimmer", () => {
		const withoutShimmer = renderCharacter(robot, "normal", 0, WIDTH, "en", true, "test", noShimmer)
		const withShimmer = renderCharacter(
			robot,
			"normal",
			0,
			WIDTH,
			"en",
			true,
			"test",
			activeShimmer,
		)

		for (let i = 0; i < withoutShimmer.lines.length; i++) {
			const widthA = stripAnsi(withoutShimmer.lines[i]).length
			const widthB = stripAnsi(withShimmer.lines[i]).length
			expect(widthB).toBe(widthA)
		}
	})

	it("shimmer sweep across all positions preserves line count and widths", () => {
		const baseline = renderCharacter(robot, "normal", 0, WIDTH, "en", true, "test", noShimmer)
		const baseLineCount = baseline.lines.length
		const baseWidths = baseline.lines.map((l) => stripAnsi(l).length)

		for (let step = 0; step <= 4 + 11 - 2; step++) {
			const shimmer: ShimmerState = { active: true, diagonalStep: step, radius: 2 }
			const result = renderCharacter(robot, "normal", 0, WIDTH, "en", true, "test", shimmer)
			expect(result.lines.length).toBe(baseLineCount)
			for (let i = 0; i < result.lines.length; i++) {
				expect(stripAnsi(result.lines[i]).length).toBe(baseWidths[i])
			}
		}
	})
})

describe("renderMiniCharacter - output dimensional stability", () => {
	it("produces stable dimensions with/without shimmer", () => {
		const withoutShimmer = renderMiniCharacter(robot, "normal", noShimmer)
		const withShimmer = renderMiniCharacter(robot, "normal", activeShimmer)

		expect(withoutShimmer).not.toBeNull()
		expect(withShimmer).not.toBeNull()
		expect(withShimmer?.length).toBe(withoutShimmer?.length)

		for (let i = 0; i < (withoutShimmer?.length ?? 0); i++) {
			expect(stripAnsi(withShimmer?.[i] ?? "").length).toBe(
				stripAnsi(withoutShimmer?.[i] ?? "").length,
			)
		}
	})
})

describe("colorizeLineMetallic - visual length preservation", () => {
	it("metallic coloring preserves visual line length", () => {
		const scheme = getMetallicCharacterColors("normal", "truecolor")
		if (!scheme) throw new Error("scheme should not be null for truecolor")

		const lines = ["  ▗▟███▙▖  ", "▐█◉  ◉█▌", " ▐█████▌ ", "  ▀▀ ▀▀  "]
		for (let i = 0; i < lines.length; i++) {
			const result = colorizeLineMetallic(
				lines[i],
				i,
				scheme,
				lines.length,
				ROBOT_LUMINANCE_MAP,
				noShimmer,
				"truecolor",
			)
			expect(stripAnsi(result).length).toBe(lines[i].length)
		}
	})
})
