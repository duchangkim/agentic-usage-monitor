import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { assertCli } from "../harness/assertions"
import { type TestContext, createTestContext, runCli } from "../harness/cli-runner"
import { type MockServerHandle, startMockServer } from "../mock-server/oauth-server"

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
