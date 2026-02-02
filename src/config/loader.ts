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
const CONFIG_FILE_NAME = "config.yaml"

export interface LoadConfigResult {
	config: ResolvedConfig
	source: "file" | "env" | "default"
	path?: string
	warnings: string[]
}

function getConfigPaths(): string[] {
	const home = homedir()
	return [
		join(home, ".config", CONFIG_DIR_NAME, CONFIG_FILE_NAME),
		join(home, `.${CONFIG_DIR_NAME}.yaml`),
		join(process.cwd(), `.${CONFIG_DIR_NAME}.yaml`),
	]
}

function parseYamlSimple(content: string): Record<string, unknown> {
	const result: Record<string, unknown> = {}
	const lines = content.split("\n")
	const stack: Array<{ indent: number; obj: Record<string, unknown> }> = [
		{ indent: -1, obj: result },
	]

	for (const line of lines) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith("#")) continue

		const indent = line.search(/\S/)
		const colonIndex = trimmed.indexOf(":")
		if (colonIndex === -1) continue

		const key = trimmed.slice(0, colonIndex).trim()
		const valueStr = trimmed.slice(colonIndex + 1).trim()

		while (stack.length > 1) {
			const top = stack[stack.length - 1]
			if (top && top.indent >= indent) {
				stack.pop()
			} else {
				break
			}
		}

		const current = stack[stack.length - 1]
		if (!current) continue
		const parent = current.obj

		if (valueStr === "" || valueStr === "|" || valueStr === ">") {
			const nestedObj: Record<string, unknown> = {}
			parent[key] = nestedObj
			stack.push({ indent, obj: nestedObj })
		} else {
			parent[key] = parseValue(valueStr)
		}
	}

	return result
}

function parseValue(str: string): unknown {
	if (str.startsWith("${") && str.endsWith("}")) {
		const envVar = str.slice(2, -1)
		return process.env[envVar]
	}

	if (str === "true") return true
	if (str === "false") return false
	if (str === "null" || str === "~") return null

	const num = Number(str)
	if (!Number.isNaN(num) && str !== "") return num

	if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
		return str.slice(1, -1)
	}

	return str
}

function transformKeys(obj: unknown): unknown {
	if (obj === null || typeof obj !== "object") return obj
	if (Array.isArray(obj)) return obj.map(transformKeys)

	const result: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
		const camelKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
		result[camelKey] = transformKeys(value)
	}
	return result
}

function loadFromFile(path: string): { config: Config; warnings: string[] } | null {
	if (!existsSync(path)) return null

	const content = readFileSync(path, "utf-8")
	const rawParsed = parseYamlSimple(content)
	const transformed = transformKeys(rawParsed)

	const result = safeParseConfig(transformed)
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

	for (const path of getConfigPaths()) {
		const fileResult = loadFromFile(path)
		if (fileResult) {
			return {
				config: resolveConfig(fileResult.config),
				source: "file",
				path,
				warnings: fileResult.warnings,
			}
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
