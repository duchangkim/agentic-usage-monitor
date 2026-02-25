import { describe, expect, it } from "bun:test"
import { CharacterConfigSchema, getDefaultConfig, resolveConfig } from "../../src/config/schema"

describe("CharacterConfigSchema - shimmer field", () => {
	it("accepts shimmer: true", () => {
		const result = CharacterConfigSchema.safeParse({ shimmer: true })
		expect(result.success).toBe(true)
	})

	it("accepts shimmer: false", () => {
		const result = CharacterConfigSchema.safeParse({ shimmer: false })
		expect(result.success).toBe(true)
	})
})

describe("getDefaultConfig - shimmer", () => {
	it("has shimmer defaulting to true", () => {
		const config = getDefaultConfig()
		expect(config.character.shimmer).toBe(true)
	})
})

describe("resolveConfig - shimmer", () => {
	it("resolves shimmer: false from partial", () => {
		const resolved = resolveConfig({ character: { shimmer: false } })
		expect(resolved.character.shimmer).toBe(false)
	})

	it("defaults shimmer to true when not provided", () => {
		const resolved = resolveConfig({})
		expect(resolved.character.shimmer).toBe(true)
	})
})
