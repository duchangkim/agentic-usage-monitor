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
