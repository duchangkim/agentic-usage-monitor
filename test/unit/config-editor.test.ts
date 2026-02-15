import { afterEach, describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	createDefaultConfigFile,
	getEditorCommand,
	reloadAndApplyConfig,
} from "../../src/cli/config-editor"
import { getTheme, initTheme } from "../../src/tui/theme"

// Use a temporary directory for each test to avoid filesystem conflicts
function createTempDir(): string {
	const dir = join(
		tmpdir(),
		`usage-monitor-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	)
	mkdirSync(dir, { recursive: true })
	return dir
}

// ---- 1. createDefaultConfigFile ----

describe("createDefaultConfigFile", () => {
	let tempDir: string

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true })
		}
	})

	it("should create config.json with valid JSON", () => {
		tempDir = createTempDir()
		const configPath = join(tempDir, "config.json")

		createDefaultConfigFile(configPath)

		expect(existsSync(configPath)).toBe(true)
		const content = readFileSync(configPath, "utf-8")
		const parsed = JSON.parse(content)
		expect(parsed).toBeDefined()
	})

	it("should include all default config fields", () => {
		tempDir = createTempDir()
		const configPath = join(tempDir, "config.json")

		createDefaultConfigFile(configPath)

		const content = readFileSync(configPath, "utf-8")
		const parsed = JSON.parse(content)
		expect(parsed.oauth).toBeDefined()
		expect(parsed.oauth.enabled).toBe(true)
		expect(parsed.oauth.showProfile).toBe(true)
		expect(parsed.display).toBeDefined()
		expect(parsed.display.refreshInterval).toBe(30)
		expect(parsed.widget).toBeDefined()
		expect(parsed.widget.style).toBe("rounded")
		expect(parsed.theme).toBe("default")
	})

	it("should create parent directories if they don't exist", () => {
		tempDir = createTempDir()
		const nestedPath = join(tempDir, "deep", "nested", "config.json")

		createDefaultConfigFile(nestedPath)

		expect(existsSync(nestedPath)).toBe(true)
	})

	it("should not overwrite existing config file", () => {
		tempDir = createTempDir()
		const configPath = join(tempDir, "config.json")
		const customContent = JSON.stringify({ theme: "nord" })
		writeFileSync(configPath, customContent)

		createDefaultConfigFile(configPath)

		const content = readFileSync(configPath, "utf-8")
		expect(content).toBe(customContent)
	})
})

// ---- 2. getEditorCommand ----

describe("getEditorCommand", () => {
	it("should return 'open' on darwin", () => {
		const cmd = getEditorCommand("darwin")
		expect(cmd).toBe("open")
	})

	it("should return 'xdg-open' on linux", () => {
		const cmd = getEditorCommand("linux")
		expect(cmd).toBe("xdg-open")
	})

	it("should return 'xdg-open' for unknown platforms", () => {
		const cmd = getEditorCommand("freebsd")
		expect(cmd).toBe("xdg-open")
	})
})

// ---- 3. reloadAndApplyConfig ----

describe("reloadAndApplyConfig", () => {
	let tempDir: string

	afterEach(() => {
		initTheme({})
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true })
		}
	})

	it("should reload config and apply theme", () => {
		tempDir = createTempDir()
		const configPath = join(tempDir, "config.json")
		writeFileSync(configPath, JSON.stringify({ theme: "nord" }))

		initTheme({})
		expect(getTheme().name).toBe("default")

		const result = reloadAndApplyConfig(configPath)

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.config.theme).toBe("nord")
		}
		expect(getTheme().name).toBe("nord")
	})

	it("should return default config when file does not exist", () => {
		initTheme({})

		const result = reloadAndApplyConfig("/nonexistent/path/config.json")

		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.config.theme).toBe("default")
		}
	})

	it("should return error for invalid JSON", () => {
		tempDir = createTempDir()
		const configPath = join(tempDir, "config.json")
		writeFileSync(configPath, "not json {{{")

		const result = reloadAndApplyConfig(configPath)

		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error).toContain("Invalid JSON")
		}
	})

	it("should return warnings for invalid config values", () => {
		tempDir = createTempDir()
		const configPath = join(tempDir, "config.json")
		writeFileSync(configPath, JSON.stringify({ theme: "nonexistent" }))

		const result = reloadAndApplyConfig(configPath)

		// Invalid theme is a Zod validation error, treated as warning
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.warnings.length).toBeGreaterThan(0)
		}
	})
})
