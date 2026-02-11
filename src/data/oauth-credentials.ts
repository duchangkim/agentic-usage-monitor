import { execSync } from "node:child_process"
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
	source: "claude-code" | "opencode"
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

// Claude Code credentials structure (file or Keychain)
interface ClaudeCodeCredentials {
	claudeAiOauth?: {
		accessToken?: string
		refreshToken?: string
		expiresAt?: string | number // ISO date string or Unix timestamp in ms
		scopes?: string[]
	}
}

function getOpenCodeAuthPath(): string {
	return join(homedir(), ".local", "share", "opencode", "auth.json")
}

function getClaudeCodeCredentialsPath(): string {
	return join(homedir(), ".claude", ".credentials.json")
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

function parseClaudeCodeCredentials(parsed: ClaudeCodeCredentials): LoadCredentialsResult {
	if (!parsed.claudeAiOauth?.accessToken) {
		return { success: false, error: "No OAuth credentials in Claude Code data." }
	}

	const { accessToken, refreshToken, expiresAt, scopes } = parsed.claudeAiOauth

	if (!accessToken.startsWith("sk-ant-oat")) {
		return { success: false, error: "Invalid OAuth token format in Claude Code." }
	}

	const expiresAtIso =
		typeof expiresAt === "number"
			? new Date(expiresAt).toISOString()
			: typeof expiresAt === "string"
				? expiresAt
				: undefined

	return {
		success: true,
		credentials: { accessToken, refreshToken, expiresAt: expiresAtIso, scopes },
		source: "claude-code",
	}
}

function loadFromClaudeCodeKeychain(): LoadCredentialsResult {
	if (process.platform !== "darwin") {
		return { success: false, error: "keychain-not-supported" }
	}

	try {
		const output = execSync(
			'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
			{ encoding: "utf-8", timeout: 5000 },
		).trim()

		const parsed: ClaudeCodeCredentials = JSON.parse(output)
		return parseClaudeCodeCredentials(parsed)
	} catch {
		return { success: false, error: "claude-code-keychain-not-found" }
	}
}

function loadFromClaudeCodeFile(): LoadCredentialsResult {
	const credentialsPath = getClaudeCodeCredentialsPath()

	if (!existsSync(credentialsPath)) {
		return { success: false, error: "claude-code-file-not-found" }
	}

	try {
		const content = readFileSync(credentialsPath, "utf-8")
		const parsed: ClaudeCodeCredentials = JSON.parse(content)
		return parseClaudeCodeCredentials(parsed)
	} catch (error) {
		return {
			success: false,
			error: `Failed to parse Claude Code credentials: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

function loadFromClaudeCode(): LoadCredentialsResult {
	const keychainResult = loadFromClaudeCodeKeychain()
	if (keychainResult.success) return keychainResult

	const fileResult = loadFromClaudeCodeFile()
	if (fileResult.success) return fileResult

	return { success: false, error: "claude-code-not-found" }
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

	const claudeCodeResult = loadFromClaudeCode()
	if (claudeCodeResult.success) return claudeCodeResult

	const openCodeResult = loadFromOpenCode()
	if (openCodeResult.success) return openCodeResult

	const claudeCodeNotFound = claudeCodeResult.error === "claude-code-not-found"
	const openCodeNotFound = openCodeResult.error === "opencode-not-found"

	if (claudeCodeNotFound && openCodeNotFound) {
		return {
			success: false,
			error: "No credentials found. Please authenticate via Claude Code or OpenCode.",
		}
	}

	return claudeCodeNotFound ? openCodeResult : claudeCodeResult
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
