import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { assertCli } from "../harness/assertions"
import { type TestContext, createTestContext, runCli } from "../harness/cli-runner"
import {
	EXPIRED_TOKEN,
	type MockServerHandle,
	REFRESHED_TOKEN,
	VALID_REFRESH_TOKEN,
	startMockServer,
} from "../mock-server/oauth-server"

describe("API Response Handling", () => {
	describe("Successful Responses", () => {
		let mockServer: MockServerHandle
		let context: TestContext

		beforeAll(async () => {
			mockServer = await startMockServer({ scenario: "healthy" })
			context = await createTestContext({ mockServer, scenario: "healthy" })
		})

		afterAll(async () => {
			await mockServer.stop()
		})

		it("should fetch and display usage data", async () => {
			const result = await runCli(["--once"], context)

			const assertions = assertCli(result).exitSuccess().stdoutContains("44%").stdoutContains("12%")

			expect(assertions.allPassed()).toBe(true)
		})

		it("should fetch and display profile data", async () => {
			const result = await runCli(["--once"], context)

			const assertions = assertCli(result).exitSuccess().stdoutContains("Test")

			expect(assertions.allPassed()).toBe(true)
		})
	})

	describe("Error Responses", () => {
		it("should handle 401 authentication error", async () => {
			const server = await startMockServer({ scenario: "authError" })
			const ctx = await createTestContext({ mockServer: server, scenario: "authError" })

			try {
				const result = await runCli(["--once"], ctx)

				expect(result.stdout + result.stderr).toMatch(/invalid|error|auth/i)
			} finally {
				await server.stop()
			}
		})

		it("should handle 429 rate limit error", async () => {
			const server = await startMockServer({ scenario: "rateLimited" })
			const ctx = await createTestContext({ mockServer: server, scenario: "rateLimited" })

			try {
				const result = await runCli(["--once"], ctx)

				expect(result.stdout + result.stderr).toMatch(/rate|limit|429/i)
			} finally {
				await server.stop()
			}
		})

		it("should handle 500 server error", async () => {
			const server = await startMockServer({ scenario: "serverError" })
			const ctx = await createTestContext({ mockServer: server, scenario: "serverError" })

			try {
				const result = await runCli(["--once"], ctx)

				expect(result.stdout + result.stderr).toMatch(/error|500|internal/i)
			} finally {
				await server.stop()
			}
		})
	})

	describe("Network Conditions", () => {
		it("should complete within timeout", async () => {
			const server = await startMockServer({ scenario: "healthy" })
			const ctx = await createTestContext({
				mockServer: server,
				scenario: "healthy",
				timeout: 5000,
			})

			try {
				const result = await runCli(["--once"], ctx)

				const assertions = assertCli(result).didNotTimeout().performance(5000)

				expect(assertions.allPassed()).toBe(true)
			} finally {
				await server.stop()
			}
		})
	})
})

describe("API Request Verification", () => {
	it("should make requests to correct endpoints", async () => {
		const server = await startMockServer({ scenario: "healthy" })
		const ctx = await createTestContext({ mockServer: server, scenario: "healthy" })

		try {
			await runCli(["--once"], ctx)

			const requests = server.getRequestLog()
			const paths = requests.map((r) => r.path)

			expect(paths).toContain("/api/oauth/usage")
			expect(paths).toContain("/api/oauth/profile")
		} finally {
			await server.stop()
		}
	})

	it("should send authorization header", async () => {
		const server = await startMockServer({ scenario: "healthy" })
		const ctx = await createTestContext({ mockServer: server, scenario: "healthy" })

		try {
			await runCli(["--once"], ctx)

			const requests = server.getRequestLog()
			const hasAuth = requests.some((r) => r.headers.authorization?.startsWith("Bearer "))

			expect(hasAuth).toBe(true)
		} finally {
			await server.stop()
		}
	})
})

describe("Expired Token Handling", () => {
	it("should not block API calls when token expiresAt is in the past", async () => {
		const expiredCredentials = {
			access_token: "mock-access-token-for-testing",
			refresh_token: "mock-refresh-token-for-testing",
			expires_at: Date.now() - 3600 * 1000, // 1 hour ago
		}
		const tmpPath = join(tmpdir(), `expired-creds-${Date.now()}.json`)
		writeFileSync(tmpPath, JSON.stringify(expiredCredentials))

		const server = await startMockServer({ scenario: "healthy" })
		const ctx = await createTestContext({ mockServer: server, scenario: "healthy" })
		ctx.credentialsPath = tmpPath

		try {
			const result = await runCli(["--once"], ctx)

			// Should still fetch and display usage data despite expired expiresAt
			const assertions = assertCli(result).exitSuccess().stdoutContains("44%").stdoutContains("12%")
			expect(assertions.allPassed()).toBe(true)

			// Verify API calls were actually made (not blocked client-side)
			const requests = server.getRequestLog()
			const paths = requests.map((r) => r.path)
			expect(paths).toContain("/api/oauth/usage")
			expect(paths).toContain("/api/oauth/profile")
		} finally {
			await server.stop()
		}
	})
})

describe("Token Auto-Refresh", () => {
	it("should auto-refresh expired token and display usage data", async () => {
		// Credential file with an expired access token but a valid refresh token.
		// The mock server returns 401 for EXPIRED_TOKEN, triggering the refresh flow.
		const credentials = {
			access_token: EXPIRED_TOKEN,
			refresh_token: VALID_REFRESH_TOKEN,
			expires_at: Date.now() - 3600 * 1000,
		}
		const tmpPath = join(tmpdir(), `refresh-ok-${Date.now()}.json`)
		writeFileSync(tmpPath, JSON.stringify(credentials))

		const server = await startMockServer({ scenario: "healthy" })
		const ctx = await createTestContext({ mockServer: server, scenario: "healthy" })
		ctx.credentialsPath = tmpPath

		try {
			const result = await runCli(["--once"], ctx)

			// After auto-refresh, the retried request should succeed
			const assertions = assertCli(result).exitSuccess().stdoutContains("44%").stdoutContains("12%")
			expect(assertions.allPassed()).toBe(true)

			// Verify the refresh endpoint was called
			const requests = server.getRequestLog()
			const paths = requests.map((r) => r.path)
			expect(paths).toContain("/v1/oauth/token")
		} finally {
			await server.stop()
		}
	})

	it("should write refreshed token back to credentials file", async () => {
		const credentials = {
			access_token: EXPIRED_TOKEN,
			refresh_token: VALID_REFRESH_TOKEN,
			expires_at: Date.now() - 3600 * 1000,
		}
		const tmpPath = join(tmpdir(), `refresh-writeback-${Date.now()}.json`)
		writeFileSync(tmpPath, JSON.stringify(credentials))

		const server = await startMockServer({ scenario: "healthy" })
		const ctx = await createTestContext({ mockServer: server, scenario: "healthy" })
		ctx.credentialsPath = tmpPath

		try {
			await runCli(["--once"], ctx)

			// Read back the credentials file — it should now have the refreshed token
			const updated = JSON.parse(readFileSync(tmpPath, "utf-8"))
			expect(updated.access_token).toBe(REFRESHED_TOKEN)
			expect(updated.access_token).not.toBe(EXPIRED_TOKEN)
		} finally {
			await server.stop()
		}
	})

	it("should show error when refresh token is invalid", async () => {
		// Credential file with expired access token AND an invalid refresh token
		const credentials = {
			access_token: EXPIRED_TOKEN,
			refresh_token: "mock-invalid-refresh-token",
			expires_at: Date.now() - 3600 * 1000,
		}
		const tmpPath = join(tmpdir(), `refresh-fail-${Date.now()}.json`)
		writeFileSync(tmpPath, JSON.stringify(credentials))

		const server = await startMockServer({ scenario: "healthy" })
		const ctx = await createTestContext({ mockServer: server, scenario: "healthy" })
		ctx.credentialsPath = tmpPath

		try {
			const result = await runCli(["--once"], ctx)

			// Should show actionable re-authenticate message
			const output = result.stdout + result.stderr
			expect(output).toMatch(/expired|re-authenticate|login/i)
		} finally {
			await server.stop()
		}
	})

	it("should show error when no refresh token is available", async () => {
		// Credential file with expired access token and NO refresh token
		const credentials = {
			access_token: EXPIRED_TOKEN,
			expires_at: Date.now() - 3600 * 1000,
		}
		const tmpPath = join(tmpdir(), `no-refresh-${Date.now()}.json`)
		writeFileSync(tmpPath, JSON.stringify(credentials))

		const server = await startMockServer({ scenario: "healthy" })
		const ctx = await createTestContext({ mockServer: server, scenario: "healthy" })
		ctx.credentialsPath = tmpPath

		try {
			const result = await runCli(["--once"], ctx)

			// Should show actionable re-authenticate message
			const output = result.stdout + result.stderr
			expect(output).toMatch(/expired|re-authenticate|login/i)
		} finally {
			await server.stop()
		}
	})
})
