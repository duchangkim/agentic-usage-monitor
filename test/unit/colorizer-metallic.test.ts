import { describe, expect, it } from "bun:test"
import {
	colorizeLine,
	colorizeLineMetallic,
	getCharacterColors,
	getMetallicCharacterColors,
} from "../../src/tui/character/colorizer"
import { ROBOT_LUMINANCE_MAP } from "../../src/tui/character/metallic"
import type { ShimmerState } from "../../src/tui/character/shimmer"
import { stripAnsi } from "../../src/tui/renderer"

describe("getMetallicCharacterColors", () => {
	it("returns MetallicColorScheme for truecolor", () => {
		const scheme = getMetallicCharacterColors("normal", "truecolor")
		expect(scheme).not.toBeNull()
		expect(scheme?.tones).toBeDefined()
		expect(scheme?.eyesTones).toBeDefined()
		expect(scheme?.reset).toBe("\x1b[0m")
	})

	it("returns null for basic color level", () => {
		const scheme = getMetallicCharacterColors("normal", "basic")
		expect(scheme).toBeNull()
	})

	it("returns null for none color level", () => {
		const scheme = getMetallicCharacterColors("normal", "none")
		expect(scheme).toBeNull()
	})
})

describe("colorizeLineMetallic", () => {
	const noShimmer: ShimmerState = { active: false, diagonalStep: null, radius: 2 }

	it("applies per-cell coloring based on luminance map", () => {
		const scheme = getMetallicCharacterColors("normal", "truecolor")
		if (!scheme) throw new Error("scheme should not be null for truecolor")

		// Use a body line (line 0) with known content
		const line = "  ▗▟███▙▖  "
		const result = colorizeLineMetallic(
			line,
			0,
			scheme,
			4,
			ROBOT_LUMINANCE_MAP,
			noShimmer,
			"truecolor",
		)

		// Should contain ANSI escape codes (per-cell coloring)
		expect(result).toContain("\x1b[")
		// Visual content should be preserved
		expect(stripAnsi(result)).toBe(line)
	})

	it("handles shimmer override (affected cells get specular)", () => {
		const scheme = getMetallicCharacterColors("normal", "truecolor")
		if (!scheme) throw new Error("scheme should not be null for truecolor")

		const line = "  ▗▟███▙▖  "
		const activeShimmer: ShimmerState = { active: true, diagonalStep: 4, radius: 2 }

		const withoutShimmer = colorizeLineMetallic(
			line,
			0,
			scheme,
			4,
			ROBOT_LUMINANCE_MAP,
			noShimmer,
			"truecolor",
		)
		const withShimmer = colorizeLineMetallic(
			line,
			0,
			scheme,
			4,
			ROBOT_LUMINANCE_MAP,
			activeShimmer,
			"truecolor",
		)

		// With shimmer should produce different output (specular overrides)
		expect(withShimmer).not.toBe(withoutShimmer)
		// But visual content still preserved
		expect(stripAnsi(withShimmer)).toBe(line)
	})

	it("handles center-pad offset correctly", () => {
		const scheme = getMetallicCharacterColors("normal", "truecolor")
		if (!scheme) throw new Error("scheme should not be null for truecolor")

		// Padded line wider than 11 cols (e.g. width 30 after centerPad)
		const paddedLine = "         ▗▟███▙▖           "
		const result = colorizeLineMetallic(
			paddedLine,
			0,
			scheme,
			4,
			ROBOT_LUMINANCE_MAP,
			noShimmer,
			"truecolor",
		)

		// Visual content must be preserved
		expect(stripAnsi(result)).toBe(paddedLine)
	})
})

describe("colorizeLine - metallic integration", () => {
	it("with metallic params uses metallic path", () => {
		const scheme = getMetallicCharacterColors("normal", "truecolor")
		const flatScheme = getCharacterColors("normal", "truecolor")

		const line = "  ▗▟███▙▖  "
		const noShimmer: ShimmerState = { active: false, diagonalStep: null, radius: 2 }

		const metallic = colorizeLine(
			line,
			0,
			flatScheme,
			4,
			scheme,
			ROBOT_LUMINANCE_MAP,
			noShimmer,
			"truecolor",
		)
		const flat = colorizeLine(line, 0, flatScheme, 4)

		// Metallic should produce different coloring than flat
		expect(metallic).not.toBe(flat)
		// But same visual content
		expect(stripAnsi(metallic)).toBe(stripAnsi(flat))
	})

	it("without metallic params preserves existing behavior", () => {
		const flatScheme = getCharacterColors("normal", "truecolor")
		const line = "  ▗▟███▙▖  "

		const result = colorizeLine(line, 0, flatScheme, 4)
		// Should use flat coloring (body color for all block chars)
		expect(result).toContain("\x1b[")
		expect(stripAnsi(result)).toBe(line)
	})
})
