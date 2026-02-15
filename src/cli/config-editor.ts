import { exec } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import {
	type ResolvedConfig,
	getDefaultConfig,
	resolveConfig,
	safeParseConfig,
} from "../config/schema"
import { initTheme } from "../tui/theme"

// ---- Default config file creation ----

export function createDefaultConfigFile(configPath: string): void {
	if (existsSync(configPath)) return

	const dir = dirname(configPath)
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true })
	}

	const defaults = getDefaultConfig()
	const content = JSON.stringify(
		{
			oauth: defaults.oauth,
			display: defaults.display,
			widget: {
				style: defaults.widget.style,
				position: defaults.widget.position,
				compact: defaults.widget.compact,
			},
			theme: defaults.theme,
		},
		null,
		2,
	)

	writeFileSync(configPath, `${content}\n`)
}

// ---- Editor opening ----

export function getEditorCommand(platform: string): string {
	if (platform === "darwin") return "open"
	return "xdg-open"
}

export type OpenResult = { success: true } | { success: false; error: string }

export function openConfigInEditor(configPath: string): OpenResult {
	createDefaultConfigFile(configPath)

	const cmd = getEditorCommand(process.platform)

	try {
		exec(`${cmd} ${JSON.stringify(configPath)}`, (error) => {
			if (error) {
				// Non-blocking: error is silently ignored since we can't
				// show it synchronously. The user will see the file didn't open.
			}
		})
		return { success: true }
	} catch {
		return { success: false, error: `Failed to open editor with '${cmd}'` }
	}
}

// ---- Config reload ----

export type ReloadResult =
	| { success: true; config: ResolvedConfig; warnings: string[] }
	| { success: false; error: string }

export function reloadAndApplyConfig(configPath: string): ReloadResult {
	if (!existsSync(configPath)) {
		const config = getDefaultConfig()
		initTheme(process.env, config.theme)
		return { success: true, config, warnings: [] }
	}

	let content: string
	try {
		content = readFileSync(configPath, "utf-8")
	} catch {
		return { success: false, error: `Failed to read config: ${configPath}` }
	}

	let parsed: unknown
	try {
		parsed = JSON.parse(content)
	} catch {
		return { success: false, error: `Invalid JSON in config: ${configPath}` }
	}

	const result = safeParseConfig(parsed)
	if (!result.success) {
		// Validation errors are warnings — apply defaults for invalid fields
		const config = resolveConfig({})
		initTheme(process.env, config.theme)
		return {
			success: true,
			config,
			warnings: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
		}
	}

	const config = resolveConfig(result.data)
	initTheme(process.env, config.theme)
	return { success: true, config, warnings: [] }
}
