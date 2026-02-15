import { beforeEach, describe, expect, it } from "bun:test"
import {
	type ColorDef,
	type Theme,
	createDefaultTheme,
	detectColorLevel,
	getTheme,
	initTheme,
	resolveColor,
	setTheme,
} from "../../src/tui/theme"

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
})
