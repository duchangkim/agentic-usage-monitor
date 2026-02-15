import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import {
	type Config,
	type ResolvedConfig,
	getDefaultConfig,
	resolveConfig,
	safeParseConfig,
} from "./schema"

const CONFIG_DIR_NAME = "usage-monitor"
const CONFIG_FILE_NAME = "config.json"

export interface LoadConfigResult {
	config: ResolvedConfig
	source: "file" | "env" | "default"
	path?: string
	warnings: string[]
}

function getConfigPath(): string {
	return join(homedir(), ".config", CONFIG_DIR_NAME, CONFIG_FILE_NAME)
}

function loadFromFile(path: string): { config: Config; warnings: string[] } | null {
	if (!existsSync(path)) return null

	const content = readFileSync(path, "utf-8")

	let parsed: unknown
	try {
		parsed = JSON.parse(content)
	} catch {
		return {
			config: {} as Config,
			warnings: [`Invalid JSON in config file: ${path}`],
		}
	}

	const result = safeParseConfig(parsed)
	if (!result.success) {
		return {
			config: {} as Config,
			warnings: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
		}
	}

	return { config: result.data, warnings: [] }
}

function loadFromEnv(): Config {
	const config: Config = {}

	const refreshInterval = process.env.USAGE_MONITOR_REFRESH_INTERVAL
	if (refreshInterval) {
		const interval = Number.parseInt(refreshInterval, 10)
		if (!Number.isNaN(interval)) {
			config.display = { refreshInterval: interval }
		}
	}

	return config
}

export function loadConfig(customPath?: string): LoadConfigResult {
	const warnings: string[] = []

	if (customPath) {
		const fileResult = loadFromFile(customPath)
		if (fileResult) {
			return {
				config: resolveConfig(fileResult.config),
				source: "file",
				path: customPath,
				warnings: fileResult.warnings,
			}
		}
		warnings.push(`Config file not found: ${customPath}`)
	}

	const configPath = getConfigPath()
	const fileResult = loadFromFile(configPath)
	if (fileResult) {
		return {
			config: resolveConfig(fileResult.config),
			source: "file",
			path: configPath,
			warnings: fileResult.warnings,
		}
	}

	const envConfig = loadFromEnv()
	if (Object.keys(envConfig).length > 0) {
		return {
			config: resolveConfig(envConfig as Config),
			source: "env",
			warnings,
		}
	}

	return {
		config: getDefaultConfig(),
		source: "default",
		warnings,
	}
}

export function getConfigDir(): string {
	return join(homedir(), ".config", CONFIG_DIR_NAME)
}

export function getDefaultConfigPath(): string {
	return join(getConfigDir(), CONFIG_FILE_NAME)
}
