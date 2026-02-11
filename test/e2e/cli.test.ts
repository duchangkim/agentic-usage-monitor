import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { assertCli } from "../harness/assertions"
import { type TestContext, createTestContext, runCli } from "../harness/cli-runner"
import { type MockServerHandle, startMockServer } from "../mock-server/oauth-server"

describe("CLI Argument Parsing", () => {
	let mockServer: MockServerHandle
	let context: TestContext

	beforeAll(async () => {
		mockServer = await startMockServer({ scenario: "healthy" })
		context = await createTestContext({ mockServer, scenario: "healthy" })
	})

	afterAll(async () => {
		await mockServer.stop()
	})

	it("should display help with --help", async () => {
		const result = await runCli(["--help"], context)

		const assertions = assertCli(result)
			.exitSuccess()
			.stdoutContains("USAGE:")
			.stdoutContains("OPTIONS:")
			.stdoutContains("--once")
			.stdoutContains("--help")
			.performance(2000)

		expect(assertions.allPassed()).toBe(true)
	})

	it("should display help with -h", async () => {
		const result = await runCli(["-h"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("USAGE:")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should display version with --version", async () => {
		const result = await runCli(["--version"], context)

		const assertions = assertCli(result)
			.exitSuccess()
			.stdoutContains("usage-monitor")
			.stdoutContains("v")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should run once with --once flag", async () => {
		const result = await runCli(["--once"], context)

		const assertions = assertCli(result).exitSuccess().didNotTimeout().performance(5000)

		expect(assertions.allPassed()).toBe(true)
	})

	it("should run once with -1 flag", async () => {
		const result = await runCli(["-1"], context)

		const assertions = assertCli(result).exitSuccess().didNotTimeout()

		expect(assertions.allPassed()).toBe(true)
	})
})
