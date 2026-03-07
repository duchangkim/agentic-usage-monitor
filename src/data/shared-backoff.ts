import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { getConfigDir } from "../config/loader"

const BACKOFF_FILE_NAME = "backoff.json"

interface BackoffData {
	until: number // epoch ms
	pid: number
}

function getBackoffPath(): string {
	return join(getConfigDir(), BACKOFF_FILE_NAME)
}

export function isSharedBackoffActive(): boolean {
	if (process.env.OAUTH_API_BASE) return false
	try {
		const path = getBackoffPath()
		if (!existsSync(path)) return false
		const raw = readFileSync(path, "utf-8")
		const data = JSON.parse(raw) as BackoffData
		return Date.now() < data.until
	} catch {
		return false
	}
}

export function getSharedBackoffRemaining(): number {
	try {
		const path = getBackoffPath()
		if (!existsSync(path)) return 0
		const raw = readFileSync(path, "utf-8")
		const data = JSON.parse(raw) as BackoffData
		const remaining = data.until - Date.now()
		return remaining > 0 ? remaining : 0
	} catch {
		return 0
	}
}

export function setSharedBackoff(seconds: number): void {
	if (process.env.OAUTH_API_BASE) return
	try {
		const data: BackoffData = {
			until: Date.now() + seconds * 1000,
			pid: process.pid,
		}
		writeFileSync(getBackoffPath(), JSON.stringify(data))
	} catch {
		// Best-effort
	}
}

export function clearSharedBackoff(): void {
	try {
		// Write an expired backoff instead of deleting
		const data: BackoffData = { until: 0, pid: process.pid }
		writeFileSync(getBackoffPath(), JSON.stringify(data))
	} catch {
		// Best-effort
	}
}
