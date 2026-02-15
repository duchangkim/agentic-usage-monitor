import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { assertCli } from "../harness/assertions"
import { type TestContext, createTestContext, runCli } from "../harness/cli-runner"
import { type MockServerHandle, startMockServer } from "../mock-server/oauth-server"

describe("TUI Rendering", () => {
	let mockServer: MockServerHandle
	let context: TestContext

	beforeAll(async () => {
		mockServer = await startMockServer({ scenario: "healthy" })
		context = await createTestContext({ mockServer, scenario: "healthy", termWidth: 52 })
	})

	afterAll(async () => {
		await mockServer.stop()
	})

	it("should render rate limits widget", async () => {
		const result = await runCli(["--once"], context)

		const assertions = assertCli(result).exitSuccess().hasBoxDrawing().stdoutContains("Rate Limits")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should display progress bars", async () => {
		const result = await runCli(["--once"], context)

		const assertions = assertCli(result).exitSuccess().hasProgressBar()

		expect(assertions.allPassed()).toBe(true)
	})

	it("should display utilization percentages", async () => {
		const result = await runCli(["--once"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("44%").stdoutContains("12%")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should display user info", async () => {
		const result = await runCli(["--once"], context)

		const assertions = assertCli(result)
			.exitSuccess()
			.stdoutContains("User:")
			.stdoutContains("Test")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should display plan badge for MAX users", async () => {
		const result = await runCli(["--once"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("MAX")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should display 5-Hour and 7-Day labels", async () => {
		const result = await runCli(["--once"], context)

		const assertions = assertCli(result)
			.exitSuccess()
			.stdoutMatches(/5-Hour|5h:/)
			.stdoutMatches(/7-Day|7d:/)

		expect(assertions.allPassed()).toBe(true)
	})

	it("should adapt to narrow terminal width", async () => {
		const narrowContext = await createTestContext({
			mockServer,
			scenario: "healthy",
			termWidth: 30,
		})

		const result = await runCli(["--once"], narrowContext)

		const assertions = assertCli(result).exitSuccess().stdoutContains("5h:").stdoutContains("7d:")

		expect(assertions.allPassed()).toBe(true)
	})
})

describe("TUI Rendering - Compact Mode", () => {
	let mockServer: MockServerHandle
	let context: TestContext

	beforeAll(async () => {
		mockServer = await startMockServer({ scenario: "healthy" })
		context = await createTestContext({ mockServer, scenario: "healthy" })
	})

	afterAll(async () => {
		await mockServer.stop()
	})

	it("should render exactly 3 lines in compact mode", async () => {
		const result = await runCli(["--once", "--compact"], context)

		const assertions = assertCli(result).exitSuccess()
		expect(assertions.allPassed()).toBe(true)

		const lines = result.stdout
			.trim()
			.split("\n")
			.filter((l: string) => l.trim() !== "")
		expect(lines.length).toBe(3)
	})

	it("should display rate limit labels in compact mode", async () => {
		const result = await runCli(["--once", "--compact"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("5h:").stdoutContains("7d:")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should display plan badge in compact mode", async () => {
		const result = await runCli(["--once", "--compact"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("MAX")

		expect(assertions.allPassed()).toBe(true)
	})
})

describe("TUI Rendering - Different Scenarios", () => {
	it("should render enterprise org info", async () => {
		const server = await startMockServer({ scenario: "enterpriseOrg" })
		const ctx = await createTestContext({
			mockServer: server,
			scenario: "enterpriseOrg",
			termWidth: 60,
		})

		try {
			const result = await runCli(["--once"], ctx)

			const assertions = assertCli(result)
				.exitSuccess()
				.stdoutMatches(/Enterprise|ENT/)

			expect(assertions.allPassed()).toBe(true)
		} finally {
			await server.stop()
		}
	})

	it("should display Opus 7-day usage when data is available", async () => {
		const server = await startMockServer({ scenario: "enterpriseOrg" })
		const ctx = await createTestContext({
			mockServer: server,
			scenario: "enterpriseOrg",
			termWidth: 60,
		})

		try {
			const result = await runCli(["--once"], ctx)

			// enterpriseOrg scenario has seven_day_opus at 8%
			const assertions = assertCli(result)
				.exitSuccess()
				.stdoutContains("8%")
				.stdoutMatches(/Opus|Op:/)

			expect(assertions.allPassed()).toBe(true)
		} finally {
			await server.stop()
		}
	})

	it("should not display Opus row when data is null", async () => {
		const server = await startMockServer({ scenario: "healthy" })
		const ctx = await createTestContext({
			mockServer: server,
			scenario: "healthy",
			termWidth: 60,
		})

		try {
			const result = await runCli(["--once"], ctx)

			// healthy scenario has no opus data
			const assertions = assertCli(result).exitSuccess()
			expect(assertions.allPassed()).toBe(true)

			// Should NOT contain Opus label
			expect(result.stdout).not.toMatch(/Opus|opus/i)
		} finally {
			await server.stop()
		}
	})

	it("should render PRO badge for pro users", async () => {
		const server = await startMockServer({ scenario: "lowUsage" })
		const ctx = await createTestContext({ mockServer: server, scenario: "lowUsage" })

		try {
			const result = await runCli(["--once"], ctx)

			const assertions = assertCli(result).exitSuccess().stdoutContains("PRO")

			expect(assertions.allPassed()).toBe(true)
		} finally {
			await server.stop()
		}
	})

	it("should handle high usage scenario", async () => {
		const server = await startMockServer({ scenario: "highUsage" })
		const ctx = await createTestContext({ mockServer: server, scenario: "highUsage" })

		try {
			const result = await runCli(["--once"], ctx)

			const assertions = assertCli(result).exitSuccess().stdoutContains("85%").stdoutContains("78%")

			expect(assertions.allPassed()).toBe(true)
		} finally {
			await server.stop()
		}
	})

	it("should handle no limits scenario", async () => {
		const server = await startMockServer({ scenario: "noLimits" })
		const ctx = await createTestContext({ mockServer: server, scenario: "noLimits" })

		try {
			const result = await runCli(["--once"], ctx)

			const assertions = assertCli(result).exitSuccess().stdoutContains("No limits")

			expect(assertions.allPassed()).toBe(true)
		} finally {
			await server.stop()
		}
	})
})

describe("TUI Rendering - Color System", () => {
	const ESC = String.fromCharCode(27)
	const ANSI_PATTERN = new RegExp(ESC + "\\[")
	const RGB_PATTERN = new RegExp(ESC + "\\[38;2;\\d{1,3};\\d{1,3};\\d{1,3}m")

	let mockServer: MockServerHandle

	beforeAll(async () => {
		mockServer = await startMockServer({ scenario: "healthy" })
	})

	afterAll(async () => {
		await mockServer.stop()
	})

	it("should contain ANSI escape codes when colors enabled", async () => {
		const context = await createTestContext({
			mockServer,
			scenario: "healthy",
			env: { NO_COLOR: undefined },
		})
		const result = await runCli(["--once"], context)

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toMatch(ANSI_PATTERN)
	})

	it("should produce RGB escape codes when COLORTERM=truecolor", async () => {
		const context = await createTestContext({
			mockServer,
			scenario: "healthy",
			env: {
				NO_COLOR: undefined,
				COLORTERM: "truecolor",
			},
		})
		const result = await runCli(["--once"], context)

		expect(result.exitCode).toBe(0)
		expect(result.stdout).toMatch(RGB_PATTERN)
	})

	it("should not contain ANSI escape codes when NO_COLOR=1", async () => {
		const context = await createTestContext({
			mockServer,
			scenario: "healthy",
			env: { NO_COLOR: "1" },
		})
		const result = await runCli(["--once"], context)

		expect(result.exitCode).toBe(0)
		expect(result.stdout).not.toMatch(ANSI_PATTERN)
	})

	it("--theme nord should produce different RGB values than default", async () => {
		const defaultCtx = await createTestContext({
			mockServer,
			scenario: "healthy",
			env: { NO_COLOR: undefined, COLORTERM: "truecolor" },
		})
		const defaultResult = await runCli(["--once"], defaultCtx)

		const nordCtx = await createTestContext({
			mockServer,
			scenario: "healthy",
			env: { NO_COLOR: undefined, COLORTERM: "truecolor" },
		})
		const nordResult = await runCli(["--once", "--theme", "nord"], nordCtx)

		expect(defaultResult.exitCode).toBe(0)
		expect(nordResult.exitCode).toBe(0)
		// Both should have RGB codes
		expect(defaultResult.stdout).toMatch(RGB_PATTERN)
		expect(nordResult.stdout).toMatch(RGB_PATTERN)
		// Nord uses different RGB values, so output should differ
		expect(nordResult.stdout).not.toBe(defaultResult.stdout)
	})

	it("--theme with invalid name should show error", async () => {
		const context = await createTestContext({
			mockServer,
			scenario: "healthy",
		})
		const result = await runCli(["--once", "--theme", "nonexistent"], context)

		expect(result.exitCode).toBe(1)
		expect(result.stderr).toContain("Invalid theme")
	})
})
