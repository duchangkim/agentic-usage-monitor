import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs"
import { join } from "node:path"
import { getConfigDir } from "./config/loader"

const LOG_FILE_NAME = "error.log"
const MAX_LOG_SIZE = 512 * 1024 // 512KB

function getLogPath(): string {
	return join(getConfigDir(), LOG_FILE_NAME)
}

function rotateIfNeeded(logPath: string): void {
	try {
		if (!existsSync(logPath)) return
		const stat = statSync(logPath)
		if (stat.size > MAX_LOG_SIZE) {
			renameSync(logPath, `${logPath}.1`)
		}
	} catch {
		// Ignore rotation errors
	}
}

function formatEntry(level: string, message: string, context?: Record<string, unknown>): string {
	const timestamp = new Date().toISOString()
	const pid = process.pid
	const contextStr = context ? ` ${JSON.stringify(context)}` : ""
	return `[${timestamp}] [${level}] [pid:${pid}] ${message}${contextStr}\n`
}

export function logError(message: string, context?: Record<string, unknown>): void {
	try {
		const logPath = getLogPath()
		const dir = getConfigDir()
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true })
		}
		rotateIfNeeded(logPath)
		appendFileSync(logPath, formatEntry("ERROR", message, context))
	} catch {
		// Logging should never crash the app
	}
}

export function logWarn(message: string, context?: Record<string, unknown>): void {
	try {
		const logPath = getLogPath()
		const dir = getConfigDir()
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true })
		}
		rotateIfNeeded(logPath)
		appendFileSync(logPath, formatEntry("WARN", message, context))
	} catch {
		// Logging should never crash the app
	}
}
