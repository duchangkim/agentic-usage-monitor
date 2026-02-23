import { describe, expect, it } from "bun:test"
import { getDefaultConfig, resolveConfig, safeParseConfig } from "../../src/config/schema"

// ---- 1. Theme Field in Config Schema ----

describe("Config Schema - theme field", () => {
	it("should accept valid theme name 'default'", () => {
		const result = safeParseConfig({ theme: "default" })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.theme).toBe("default")
		}
	})

	it("should accept valid theme name 'nord'", () => {
		const result = safeParseConfig({ theme: "nord" })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.theme).toBe("nord")
		}
	})

	it("should accept config without theme field (optional)", () => {
		const result = safeParseConfig({ display: { refreshInterval: 60 } })
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.theme).toBeUndefined()
		}
	})

	it("should reject invalid theme name", () => {
		const result = safeParseConfig({ theme: "nonexistent" })
		expect(result.success).toBe(false)
	})

	it("should reject non-string theme value", () => {
		const result = safeParseConfig({ theme: 123 })
		expect(result.success).toBe(false)
	})
})

// ---- 2. ResolvedConfig theme default ----

describe("resolveConfig - theme default", () => {
	it("should default theme to 'default' when not specified", () => {
		const resolved = resolveConfig({})
		expect(resolved.theme).toBe("default")
	})

	it("should preserve theme when specified", () => {
		const resolved = resolveConfig({ theme: "nord" })
		expect(resolved.theme).toBe("nord")
	})

	it("should include theme in getDefaultConfig()", () => {
		const defaults = getDefaultConfig()
		expect(defaults.theme).toBe("default")
	})
})

// ---- 3. Config with all fields including theme ----

describe("Config Schema - full config with theme", () => {
	it("should parse a complete config object with theme", () => {
		const input = {
			oauth: { enabled: true, showProfile: false },
			display: { refreshInterval: 60 },
			widget: { style: "rounded", position: "right", compact: true },
			theme: "nord",
		}
		const result = safeParseConfig(input)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.theme).toBe("nord")
			expect(result.data.display?.refreshInterval).toBe(60)
		}
	})

	it("should resolve a full config with theme correctly", () => {
		const resolved = resolveConfig({
			oauth: { enabled: false },
			theme: "nord",
		})
		expect(resolved.theme).toBe("nord")
		expect(resolved.oauth.enabled).toBe(false)
		expect(resolved.display.refreshInterval).toBe(30) // default
	})
})

// ---- 4. Character Config Schema ----

describe("Config Schema - character field", () => {
	it("should accept valid character config", () => {
		const result = safeParseConfig({
			character: {
				enabled: true,
				theme: "robot",
				animation: false,
				speechBubble: true,
				language: "ko",
			},
		})
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.data.character?.theme).toBe("robot")
			expect(result.data.character?.language).toBe("ko")
		}
	})

	it("should accept empty character config (all optional)", () => {
		const result = safeParseConfig({ character: {} })
		expect(result.success).toBe(true)
	})

	it("should accept config without character field", () => {
		const result = safeParseConfig({})
		expect(result.success).toBe(true)
	})

	it("should reject invalid character theme name", () => {
		const result = safeParseConfig({ character: { theme: "nonexistent" } })
		expect(result.success).toBe(false)
	})
})

describe("resolveConfig - character defaults", () => {
	it("should default character to enabled with robot theme", () => {
		const resolved = resolveConfig({})
		expect(resolved.character.enabled).toBe(true)
		expect(resolved.character.theme).toBe("robot")
		expect(resolved.character.animation).toBe(true)
		expect(resolved.character.speechBubble).toBe(true)
		expect(resolved.character.language).toBe("en")
	})

	it("should preserve character overrides", () => {
		const resolved = resolveConfig({
			character: { enabled: false, language: "ko" },
		})
		expect(resolved.character.enabled).toBe(false)
		expect(resolved.character.language).toBe("ko")
		expect(resolved.character.theme).toBe("robot") // default kept
	})

	it("should include character in getDefaultConfig()", () => {
		const defaults = getDefaultConfig()
		expect(defaults.character).toBeDefined()
		expect(defaults.character.enabled).toBe(true)
		expect(defaults.character.theme).toBe("robot")
	})
})
