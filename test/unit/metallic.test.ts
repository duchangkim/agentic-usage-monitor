import { describe, expect, it } from "bun:test"
import {
	type MetallicTones,
	ROBOT_LUMINANCE_MAP,
	ROBOT_MINI_LUMINANCE_MAP,
	buildMetallicPalette,
	deriveMetallicTones,
	getLuminanceMap,
} from "../../src/tui/character/metallic"
import type { ColorDef } from "../../src/tui/theme"

const GREEN: ColorDef = { rgb: [34, 197, 94], ansi: "\x1b[32m" }

describe("deriveMetallicTones", () => {
	it("shadow should be base * 0.5", () => {
		const tones = deriveMetallicTones(GREEN)
		expect(tones.shadow.rgb).toEqual([17, 98, 47])
	})

	it("base should be original", () => {
		const tones = deriveMetallicTones(GREEN)
		expect(tones.base.rgb).toEqual(GREEN.rgb)
		expect(tones.base.ansi).toBe(GREEN.ansi)
	})

	it("highlight should lighten by 0.4", () => {
		const tones = deriveMetallicTones(GREEN)
		// rgb + (255 - rgb) * 0.4 → [34+88.4, 197+23.2, 94+64.4] → floor → [122, 220, 158]
		expect(tones.highlight.rgb).toEqual([122, 220, 158])
	})

	it("specular should be brighter than highlight", () => {
		const tones = deriveMetallicTones(GREEN)
		const avgHighlight =
			(tones.highlight.rgb[0] + tones.highlight.rgb[1] + tones.highlight.rgb[2]) / 3
		const avgSpecular = (tones.specular.rgb[0] + tones.specular.rgb[1] + tones.specular.rgb[2]) / 3
		expect(avgSpecular).toBeGreaterThan(avgHighlight)
	})
})

describe("ROBOT_LUMINANCE_MAP", () => {
	it("should be 4 rows x 11 cols", () => {
		expect(ROBOT_LUMINANCE_MAP.length).toBe(4)
		for (const row of ROBOT_LUMINANCE_MAP) {
			expect(row.length).toBe(11)
		}
	})
})

describe("ROBOT_MINI_LUMINANCE_MAP", () => {
	it("should be 2 rows x 11 cols", () => {
		expect(ROBOT_MINI_LUMINANCE_MAP.length).toBe(2)
		for (const row of ROBOT_MINI_LUMINANCE_MAP) {
			expect(row.length).toBe(11)
		}
	})
})

describe("getLuminanceMap", () => {
	it("returns full map for robot preset", () => {
		const map = getLuminanceMap("robot")
		expect(map).toBeDefined()
		expect(map?.length).toBe(4)
	})

	it("returns mini map for robot preset with mini=true", () => {
		const map = getLuminanceMap("robot", true)
		expect(map).toBeDefined()
		expect(map?.length).toBe(2)
	})

	it("returns undefined for unknown preset", () => {
		const map = getLuminanceMap("unknown")
		expect(map).toBeUndefined()
	})
})

describe("buildMetallicPalette", () => {
	it("produces MetallicTones for all palette keys", () => {
		const palette = {
			green: GREEN,
			cyan: { rgb: [6, 182, 212] as const, ansi: "\x1b[36m" },
			yellow: { rgb: [234, 179, 8] as const, ansi: "\x1b[33m" },
			red: { rgb: [239, 68, 68] as const, ansi: "\x1b[31m" },
			magenta: { rgb: [168, 85, 247] as const, ansi: "\x1b[35m" },
			gray: { rgb: [156, 163, 175] as const, ansi: "\x1b[90m" },
			white: { rgb: [255, 255, 255] as const, ansi: "\x1b[37m" },
			dimGray: { rgb: [107, 114, 128] as const, ansi: "\x1b[2m" },
		}
		const metallicPalette = buildMetallicPalette(palette)

		for (const key of Object.keys(palette)) {
			const tones = metallicPalette[key] as MetallicTones
			expect(tones).toBeDefined()
			expect(tones.shadow).toBeDefined()
			expect(tones.base).toBeDefined()
			expect(tones.highlight).toBeDefined()
			expect(tones.specular).toBeDefined()
		}
	})
})
