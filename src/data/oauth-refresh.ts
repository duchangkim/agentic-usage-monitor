import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { OAuthCredentials } from "./oauth-credentials"

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
const TOKEN_ENDPOINT = process.env.OAUTH_TOKEN_URL ?? "https://console.anthropic.com/v1/oauth/token"

export interface RefreshSuccess {
	success: true
	credentials: OAuthCredentials
}

export interface RefreshError {
	success: false
	error: string
}

export type RefreshResult = RefreshSuccess | RefreshError

/**
 * Exchange a refresh token for a new access token via Anthropic's OAuth token endpoint.
 */
export async function refreshOAuthToken(refreshToken: string): Promise<RefreshResult> {
	try {
		const response = await fetch(TOKEN_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				grant_type: "refresh_token",
				refresh_token: refreshToken,
				client_id: CLIENT_ID,
			}),
		})

		if (!response.ok) {
			const text = await response.text()
			let message = `Token refresh failed: ${response.status}`
			try {
				const parsed = JSON.parse(text) as { error_description?: string; error?: string }
				message = parsed.error_description ?? parsed.error ?? message
			} catch {
				// Use default message
			}
			return { success: false, error: message }
		}

		const data = (await response.json()) as {
			access_token: string
			refresh_token: string
			expires_in: number
		}

		return {
			success: true,
			credentials: {
				accessToken: data.access_token,
				refreshToken: data.refresh_token,
				expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
				scopes: undefined,
			},
		}
	} catch (error) {
		return {
			success: false,
			error: `Token refresh network error: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

/**
 * Write refreshed credentials back to the credential store on disk.
 *
 * In test mode (TEST_CREDENTIALS_PATH), writes to the test file.
 * Otherwise, writes to the source-appropriate credential file:
 *   - "claude-code" → ~/.claude/.credentials.json
 *   - "opencode"    → ~/.local/share/opencode/auth.json
 */
export function writeBackCredentials(
	source: "claude-code" | "opencode",
	credentials: OAuthCredentials,
): boolean {
	try {
		// Test mode: write back to the test credentials file
		const testPath = process.env.TEST_CREDENTIALS_PATH
		if (testPath) {
			writeTestCredentials(testPath, credentials)
			return true
		}

		if (source === "claude-code") {
			return writeClaudeCodeCredentials(credentials)
		}
		if (source === "opencode") {
			return writeOpenCodeCredentials(credentials)
		}
		return false
	} catch {
		return false
	}
}

function writeTestCredentials(filePath: string, credentials: OAuthCredentials): void {
	const data = {
		access_token: credentials.accessToken,
		refresh_token: credentials.refreshToken,
		expires_at: credentials.expiresAt ? new Date(credentials.expiresAt).getTime() : undefined,
	}
	writeFileSync(filePath, JSON.stringify(data, null, "\t"))
}

function writeClaudeCodeCredentials(credentials: OAuthCredentials): boolean {
	const filePath = join(homedir(), ".claude", ".credentials.json")

	// Read existing file to preserve other fields
	let existing: Record<string, unknown> = {}
	if (existsSync(filePath)) {
		try {
			existing = JSON.parse(readFileSync(filePath, "utf-8"))
		} catch {
			// Start fresh if file is corrupted
		}
	}

	const claudeAiOauth = (existing.claudeAiOauth as Record<string, unknown>) ?? {}
	existing.claudeAiOauth = {
		...claudeAiOauth,
		accessToken: credentials.accessToken,
		refreshToken: credentials.refreshToken,
		expiresAt: credentials.expiresAt,
	}

	writeFileSync(filePath, JSON.stringify(existing, null, "\t"))
	return true
}

function writeOpenCodeCredentials(credentials: OAuthCredentials): boolean {
	const filePath = join(homedir(), ".local", "share", "opencode", "auth.json")

	// Read existing file to preserve other provider entries
	let existing: Record<string, unknown> = {}
	if (existsSync(filePath)) {
		try {
			existing = JSON.parse(readFileSync(filePath, "utf-8"))
		} catch {
			// Start fresh if file is corrupted
		}
	}

	existing.anthropic = {
		type: "oauth",
		access: credentials.accessToken,
		refresh: credentials.refreshToken,
		expires: credentials.expiresAt ? new Date(credentials.expiresAt).getTime() : undefined,
	}

	writeFileSync(filePath, JSON.stringify(existing, null, "\t"))
	return true
}
