import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export interface OAuthCredentials {
	accessToken: string
	refreshToken: string | undefined
	expiresAt: string | undefined
	scopes: string[] | undefined
}

export interface CredentialsResult {
	success: true
	credentials: OAuthCredentials
	source: "opencode" | "claude-code"
}

export interface CredentialsError {
	success: false
	error: string
}

export type LoadCredentialsResult = CredentialsResult | CredentialsError

// OpenCode auth.json structure
interface OpenCodeAuthFile {
	anthropic?: {
		type?: string
		access?: string
		refresh?: string
		expires?: number // Unix timestamp in ms
	}
}

// Claude Code .credentials.json structure
interface ClaudeCodeCredentialsFile {
	claudeAiOauth?: {
		accessToken?: string
		refreshToken?: string
		expiresAt?: string // ISO date string
		scopes?: string[]
	}
}

function getOpenCodeAuthPath(): string {
	return join(homedir(), ".local", "share", "opencode", "auth.json")
}

function getClaudeCodeCredentialsPath(): string {
	return join(homedir(), ".claude", ".credentials.json")
}

function isTokenExpiredMs(expiresMs: number | undefined): boolean {
	if (!expiresMs) return false
	const bufferMs = 5 * 60 * 1000
	return expiresMs - bufferMs < Date.now()
}

function isTokenExpiredIso(expiresAt: string | undefined): boolean {
	if (!expiresAt) return false
	const expiryDate = new Date(expiresAt)
	const bufferMs = 5 * 60 * 1000
	return expiryDate.getTime() - bufferMs < Date.now()
}

function loadFromOpenCode(): LoadCredentialsResult {
	const authPath = getOpenCodeAuthPath()

	if (!existsSync(authPath)) {
		return { success: false, error: "opencode-not-found" }
	}

	try {
		const content = readFileSync(authPath, "utf-8")
		const parsed: OpenCodeAuthFile = JSON.parse(content)

		if (!parsed.anthropic?.access) {
			return { success: false, error: "No Anthropic OAuth in OpenCode auth file." }
		}

		const { access, refresh, expires } = parsed.anthropic

		if (!access.startsWith("sk-ant-oat")) {
			return { success: false, error: "Invalid OAuth token format in OpenCode." }
		}

		if (isTokenExpiredMs(expires)) {
			return { success: false, error: "OpenCode OAuth token expired. Run 'opencode auth login'." }
		}

		return {
			success: true,
			credentials: {
				accessToken: access,
				refreshToken: refresh,
				expiresAt: expires ? new Date(expires).toISOString() : undefined,
				scopes: undefined,
			},
			source: "opencode",
		}
	} catch (error) {
		return {
			success: false,
			error: `Failed to parse OpenCode auth: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

function loadFromClaudeCode(): LoadCredentialsResult {
	const credentialsPath = getClaudeCodeCredentialsPath()

	if (!existsSync(credentialsPath)) {
		return { success: false, error: "claude-code-not-found" }
	}

	try {
		const content = readFileSync(credentialsPath, "utf-8")
		const parsed: ClaudeCodeCredentialsFile = JSON.parse(content)

		if (!parsed.claudeAiOauth?.accessToken) {
			return { success: false, error: "No OAuth credentials in Claude Code file." }
		}

		const { accessToken, refreshToken, expiresAt, scopes } = parsed.claudeAiOauth

		if (!accessToken.startsWith("sk-ant-oat")) {
			return { success: false, error: "Invalid OAuth token format in Claude Code." }
		}

		if (isTokenExpiredIso(expiresAt)) {
			return { success: false, error: "Claude Code OAuth token expired. Run 'claude'." }
		}

		return {
			success: true,
			credentials: { accessToken, refreshToken, expiresAt, scopes },
			source: "claude-code",
		}
	} catch (error) {
		return {
			success: false,
			error: `Failed to parse Claude Code credentials: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

function loadFromTestCredentials(): LoadCredentialsResult {
	const testPath = process.env.TEST_CREDENTIALS_PATH
	if (!testPath) {
		return { success: false, error: "test-path-not-set" }
	}

	if (!existsSync(testPath)) {
		return { success: false, error: "test-credentials-not-found" }
	}

	try {
		const content = readFileSync(testPath, "utf-8")
		const parsed = JSON.parse(content) as {
			access_token?: string
			refresh_token?: string
			expires_at?: number
		}

		if (!parsed.access_token) {
			return { success: false, error: "No access_token in test credentials file." }
		}

		return {
			success: true,
			credentials: {
				accessToken: parsed.access_token,
				refreshToken: parsed.refresh_token,
				expiresAt: parsed.expires_at ? new Date(parsed.expires_at).toISOString() : undefined,
				scopes: undefined,
			},
			source: "opencode",
		}
	} catch (error) {
		return {
			success: false,
			error: `Failed to parse test credentials: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

export function loadOAuthCredentials(): LoadCredentialsResult {
	if (process.env.TEST_CREDENTIALS_PATH) {
		return loadFromTestCredentials()
	}

	const openCodeResult = loadFromOpenCode()
	if (openCodeResult.success) return openCodeResult

	const claudeCodeResult = loadFromClaudeCode()
	if (claudeCodeResult.success) return claudeCodeResult

	const openCodeNotFound = openCodeResult.error === "opencode-not-found"
	const claudeCodeNotFound = claudeCodeResult.error === "claude-code-not-found"

	if (openCodeNotFound && claudeCodeNotFound) {
		return {
			success: false,
			error: "No credentials found. Run 'opencode auth login' or install Claude Code.",
		}
	}

	return openCodeNotFound ? claudeCodeResult : openCodeResult
}

export function getTokenExpiryInfo(credentials: OAuthCredentials): {
	expiresAt: Date | null
	isExpired: boolean
	expiresIn: number | null
} {
	if (!credentials.expiresAt) {
		return { expiresAt: null, isExpired: false, expiresIn: null }
	}

	const expiresAt = new Date(credentials.expiresAt)
	const now = new Date()
	const expiresIn = expiresAt.getTime() - now.getTime()

	return {
		expiresAt,
		isExpired: expiresIn <= 0,
		expiresIn: expiresIn > 0 ? expiresIn : null,
	}
}
