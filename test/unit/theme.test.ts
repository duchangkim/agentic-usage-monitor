import { beforeEach, describe, expect, it } from "bun:test"
import {
	type ColorDef,
	type ColorLevel,
	type Theme,
	createDefaultTheme,
	detectColorLevel,
	getPreset,
	getPresetNames,
	getTheme,
	initTheme,
	resolveColor,
	setTheme,
} from "../../src/tui/theme"

/** Helper to get preset or throw — avoids non-null assertions in tests */
function requirePreset(name: string, level: ColorLevel): Theme {
	const theme = getPreset(name, level)
	if (!theme) throw new Error(`Preset "${name}" not found`)
	return theme
}

// ---- 1. Color Capability Detection ----

describe("detectColorLevel", () => {
	it("should return 'truecolor' when COLORTERM=truecolor", () => {
		const level = detectColorLevel({ COLORTERM: "truecolor" })
		expect(level).toBe("truecolor")
	})

	it("should return 'truecolor' when COLORTERM=24bit", () => {
		const level = detectColorLevel({ COLORTERM: "24bit" })
		expect(level).toBe("truecolor")
	})

	it("should return 'basic' when COLORTERM is not set", () => {
		const level = detectColorLevel({})
		expect(level).toBe("basic")
	})

	it("should return 'basic' when COLORTERM is unknown value", () => {
		const level = detectColorLevel({ COLORTERM: "something-else" })
		expect(level).toBe("basic")
	})

	it("should return 'none' when NO_COLOR is set", () => {
		const level = detectColorLevel({ NO_COLOR: "1" })
		expect(level).toBe("none")
	})

	it("should return 'none' when NO_COLOR is set even with COLORTERM=truecolor", () => {
		const level = detectColorLevel({ NO_COLOR: "1", COLORTERM: "truecolor" })
		expect(level).toBe("none")
	})
})

// ---- 2. Color Resolution ----

describe("resolveColor", () => {
	const testColor: ColorDef = {
		rgb: [34, 197, 94],
		ansi: "\x1b[32m",
	}

	it("should produce RGB foreground escape code in truecolor mode", () => {
		const result = resolveColor(testColor, "fg", "truecolor")
		expect(result).toBe("\x1b[38;2;34;197;94m")
	})

	it("should produce RGB background escape code in truecolor mode", () => {
		const result = resolveColor(testColor, "bg", "truecolor")
		expect(result).toBe("\x1b[48;2;34;197;94m")
	})

	it("should use ANSI fallback in basic mode", () => {
		const result = resolveColor(testColor, "fg", "basic")
		expect(result).toBe("\x1b[32m")
	})

	it("should return empty string in none mode", () => {
		const result = resolveColor(testColor, "fg", "none")
		expect(result).toBe("")
	})
})

// ---- 3. Default Theme Structure ----

describe("Default Theme Structure", () => {
	it("should have name 'default'", () => {
		const theme = createDefaultTheme("basic")
		expect(theme.name).toBe("default")
	})

	it("should have all foreground semantic tokens", () => {
		const theme = createDefaultTheme("basic")
		const { fg } = theme.colors
		expect(fg.accent).toBeString()
		expect(fg.default).toBeString()
		expect(fg.subtle).toBeString()
		expect(fg.muted).toBeString()
		expect(fg.accent.length).toBeGreaterThan(0)
		expect(fg.default.length).toBeGreaterThan(0)
		expect(fg.subtle.length).toBeGreaterThan(0)
		expect(fg.muted.length).toBeGreaterThan(0)
	})

	it("should have all status semantic tokens", () => {
		const theme = createDefaultTheme("basic")
		const { status } = theme.colors
		expect(status.success).toBeString()
		expect(status.warning).toBeString()
		expect(status.danger).toBeString()
		expect(status.info).toBeString()
	})

	it("should have all progress semantic tokens", () => {
		const theme = createDefaultTheme("basic")
		const { progress } = theme.colors
		expect(progress.low).toBeString()
		expect(progress.medium).toBeString()
		expect(progress.high).toBeString()
		expect(progress.critical).toBeString()
		expect(progress.empty).toBeString()
	})

	it("should have all badge semantic tokens", () => {
		const theme = createDefaultTheme("basic")
		const { badge } = theme.colors
		expect(badge.pro).toBeString()
		expect(badge.max).toBeString()
		expect(badge.ent).toBeString()
	})

	it("should have all box semantic tokens", () => {
		const theme = createDefaultTheme("basic")
		const { box } = theme.colors
		expect(box.border).toBeString()
		expect(box.title).toBeString()
	})
})

// ---- 4. Color Mapping Correctness ----

describe("Default Theme Color Mapping", () => {
	it("progress tokens should match expected ANSI colors in basic mode", () => {
		const theme = createDefaultTheme("basic")
		expect(theme.colors.progress.low).toBe("\x1b[32m") // green
		expect(theme.colors.progress.medium).toBe("\x1b[36m") // cyan
		expect(theme.colors.progress.high).toBe("\x1b[33m") // yellow
		expect(theme.colors.progress.critical).toBe("\x1b[31m") // red
	})

	it("badge tokens should match expected ANSI colors in basic mode", () => {
		const theme = createDefaultTheme("basic")
		expect(theme.colors.badge.pro).toBe("\x1b[32m") // green
		expect(theme.colors.badge.max).toBe("\x1b[35m") // magenta
		expect(theme.colors.badge.ent).toBe("\x1b[36m") // cyan
	})

	it("truecolor mode should produce RGB escape codes", () => {
		const theme = createDefaultTheme("truecolor")
		const ESC = String.fromCharCode(27)
		const rgbPattern = new RegExp("^" + ESC + "\\[38;2;\\d{1,3};\\d{1,3};\\d{1,3}m$")
		expect(theme.colors.progress.low).toMatch(rgbPattern)
		expect(theme.colors.progress.critical).toMatch(rgbPattern)
		expect(theme.colors.badge.pro).toMatch(rgbPattern)
	})

	it("none mode should produce empty strings for all color tokens", () => {
		const theme = createDefaultTheme("none")
		// fg
		expect(theme.colors.fg.accent).toBe("")
		expect(theme.colors.fg.default).toBe("")
		expect(theme.colors.fg.subtle).toBe("")
		expect(theme.colors.fg.muted).toBe("")
		// status
		expect(theme.colors.status.success).toBe("")
		expect(theme.colors.status.danger).toBe("")
		// progress
		expect(theme.colors.progress.low).toBe("")
		expect(theme.colors.progress.critical).toBe("")
		expect(theme.colors.progress.empty).toBe("")
		// badge
		expect(theme.colors.badge.pro).toBe("")
		// box
		expect(theme.colors.box.title).toBe("")
	})

	it("box.title should be bold in basic mode", () => {
		const theme = createDefaultTheme("basic")
		expect(theme.colors.box.title).toBe("\x1b[1m")
	})

	it("box.title should be bold in truecolor mode", () => {
		const theme = createDefaultTheme("truecolor")
		expect(theme.colors.box.title).toBe("\x1b[1m")
	})
})

// ---- 5. Theme State Management ----

describe("Theme State Management", () => {
	beforeEach(() => {
		initTheme({})
	})

	it("should return default theme from getTheme()", () => {
		expect(getTheme().name).toBe("default")
	})

	it("should return updated theme after setTheme()", () => {
		const customTheme: Theme = {
			name: "custom",
			colors: createDefaultTheme("basic").colors,
		}
		setTheme(customTheme)
		expect(getTheme().name).toBe("custom")
	})

	it("should allow resetting to default theme via initTheme()", () => {
		const customTheme: Theme = {
			name: "custom",
			colors: createDefaultTheme("basic").colors,
		}
		setTheme(customTheme)
		expect(getTheme().name).toBe("custom")

		initTheme({})
		expect(getTheme().name).toBe("default")
	})

	it("should apply named preset via initTheme(env, themeName)", () => {
		initTheme({}, "nord")
		expect(getTheme().name).toBe("nord")
	})

	it("should fall back to default when initTheme receives unknown preset name", () => {
		initTheme({}, "nonexistent")
		expect(getTheme().name).toBe("default")
	})
})

// ---- 6. Heading Token ----

describe("Heading Token", () => {
	it("default theme should have fg.heading token", () => {
		const theme = createDefaultTheme("basic")
		expect(theme.colors.fg.heading).toBeString()
		expect(theme.colors.fg.heading.length).toBeGreaterThan(0)
	})

	it("default theme fg.heading should be yellow in basic mode", () => {
		const theme = createDefaultTheme("basic")
		expect(theme.colors.fg.heading).toBe("\x1b[33m") // yellow
	})

	it("fg.heading should be empty in none mode", () => {
		const theme = createDefaultTheme("none")
		expect(theme.colors.fg.heading).toBe("")
	})
})

// ---- 7. Preset Registry ----

describe("Preset Registry", () => {
	it("getPresetNames() should include 'default' and 'nord'", () => {
		const names = getPresetNames()
		expect(names).toContain("default")
		expect(names).toContain("nord")
	})

	it("getPreset('default', 'basic') should return default theme", () => {
		const theme = requirePreset("default", "basic")
		expect(theme.name).toBe("default")
	})

	it("getPreset('nord', 'basic') should return nord theme", () => {
		const theme = requirePreset("nord", "basic")
		expect(theme.name).toBe("nord")
	})

	it("getPreset with unknown name should return undefined", () => {
		const theme = getPreset("nonexistent", "basic")
		expect(theme).toBeUndefined()
	})
})

// ---- 8. Nord Preset ----

describe("Nord Preset Structure", () => {
	it("should have name 'nord'", () => {
		const theme = requirePreset("nord", "basic")
		expect(theme.name).toBe("nord")
	})

	it("should have all foreground semantic tokens including heading", () => {
		const theme = requirePreset("nord", "basic")
		const { fg } = theme.colors
		expect(fg.accent).toBeString()
		expect(fg.default).toBeString()
		expect(fg.subtle).toBeString()
		expect(fg.muted).toBeString()
		expect(fg.heading).toBeString()
		// All should have content in basic mode
		expect(fg.accent.length).toBeGreaterThan(0)
		expect(fg.default.length).toBeGreaterThan(0)
		expect(fg.heading.length).toBeGreaterThan(0)
	})

	it("should have all status semantic tokens", () => {
		const theme = requirePreset("nord", "basic")
		const { status } = theme.colors
		expect(status.success.length).toBeGreaterThan(0)
		expect(status.warning.length).toBeGreaterThan(0)
		expect(status.danger.length).toBeGreaterThan(0)
		expect(status.info.length).toBeGreaterThan(0)
	})

	it("should have all progress semantic tokens", () => {
		const theme = requirePreset("nord", "basic")
		const { progress } = theme.colors
		expect(progress.low.length).toBeGreaterThan(0)
		expect(progress.medium.length).toBeGreaterThan(0)
		expect(progress.high.length).toBeGreaterThan(0)
		expect(progress.critical.length).toBeGreaterThan(0)
		expect(progress.empty.length).toBeGreaterThan(0)
	})

	it("should have all badge semantic tokens", () => {
		const theme = requirePreset("nord", "basic")
		const { badge } = theme.colors
		expect(badge.pro.length).toBeGreaterThan(0)
		expect(badge.max.length).toBeGreaterThan(0)
		expect(badge.ent.length).toBeGreaterThan(0)
	})
})

describe("Nord Preset Color Values", () => {
	it("should use Nord palette RGB values in truecolor mode", () => {
		const theme = requirePreset("nord", "truecolor")
		// nord14 = #A3BE8C = rgb(163, 190, 140) → progress.low / status.success
		expect(theme.colors.progress.low).toBe("\x1b[38;2;163;190;140m")
		expect(theme.colors.status.success).toBe("\x1b[38;2;163;190;140m")
		// nord11 = #BF616A = rgb(191, 97, 106) → progress.critical / status.danger
		expect(theme.colors.progress.critical).toBe("\x1b[38;2;191;97;106m")
		expect(theme.colors.status.danger).toBe("\x1b[38;2;191;97;106m")
		// nord8 = #88C0D0 = rgb(136, 192, 208) → progress.medium / status.info
		expect(theme.colors.progress.medium).toBe("\x1b[38;2;136;192;208m")
		expect(theme.colors.status.info).toBe("\x1b[38;2;136;192;208m")
		// nord13 = #EBCB8B = rgb(235, 203, 139) → progress.high / status.warning
		expect(theme.colors.progress.high).toBe("\x1b[38;2;235;203;139m")
		expect(theme.colors.status.warning).toBe("\x1b[38;2;235;203;139m")
	})

	it("should use Nord fg palette in truecolor mode", () => {
		const theme = requirePreset("nord", "truecolor")
		// nord6 = #ECEFF4 = rgb(236, 239, 244) → fg.accent
		expect(theme.colors.fg.accent).toBe("\x1b[38;2;236;239;244m")
		// nord4 = #D8DEE9 = rgb(216, 222, 233) → fg.default
		expect(theme.colors.fg.default).toBe("\x1b[38;2;216;222;233m")
		// nord3 = #4C566A = rgb(76, 86, 106) → fg.subtle
		expect(theme.colors.fg.subtle).toBe("\x1b[38;2;76;86;106m")
		// nord10 = #5E81AC = rgb(94, 129, 172) → fg.muted
		expect(theme.colors.fg.muted).toBe("\x1b[38;2;94;129;172m")
		// nord13 = #EBCB8B = rgb(235, 203, 139) → fg.heading
		expect(theme.colors.fg.heading).toBe("\x1b[38;2;235;203;139m")
	})

	it("should use Nord badge palette in truecolor mode", () => {
		const theme = requirePreset("nord", "truecolor")
		// nord14 = #A3BE8C → badge.pro
		expect(theme.colors.badge.pro).toBe("\x1b[38;2;163;190;140m")
		// nord15 = #B48EAD = rgb(180, 142, 173) → badge.max
		expect(theme.colors.badge.max).toBe("\x1b[38;2;180;142;173m")
		// nord8 = #88C0D0 → badge.ent
		expect(theme.colors.badge.ent).toBe("\x1b[38;2;136;192;208m")
	})

	it("should produce empty strings in none mode", () => {
		const theme = requirePreset("nord", "none")
		expect(theme.colors.fg.accent).toBe("")
		expect(theme.colors.status.success).toBe("")
		expect(theme.colors.progress.low).toBe("")
		expect(theme.colors.badge.pro).toBe("")
		expect(theme.colors.box.title).toBe("")
	})

	it("should differ from default theme in truecolor mode", () => {
		const defaultTheme = createDefaultTheme("truecolor")
		const nordTheme = requirePreset("nord", "truecolor")
		// Nord green (#A3BE8C) is different from default green (#22C55E)
		expect(nordTheme.colors.progress.low).not.toBe(defaultTheme.colors.progress.low)
		// Nord red (#BF616A) is different from default red (#EF4444)
		expect(nordTheme.colors.progress.critical).not.toBe(defaultTheme.colors.progress.critical)
	})
})
