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
			.stdoutContains("--theme")
			.stdoutContains("config.json")
			.stdoutContains("KEYBOARD SHORTCUTS:")
			.stdoutContains("e")
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

describe("Credential Source Selection (--source)", () => {
	let mockServer: MockServerHandle
	let context: TestContext

	beforeAll(async () => {
		mockServer = await startMockServer({ scenario: "healthy" })
		context = await createTestContext({ mockServer, scenario: "healthy" })
	})

	afterAll(async () => {
		await mockServer.stop()
	})

	it("should accept --source flag and show usage data", async () => {
		const result = await runCli(["--once", "--source", "auto"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("44%").stdoutContains("12%")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should accept -s shorthand for --source", async () => {
		const result = await runCli(["--once", "-s", "auto"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("44%")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should show --source option in help text", async () => {
		const result = await runCli(["--help"], context)

		const assertions = assertCli(result)
			.exitSuccess()
			.stdoutContains("--source")
			.stdoutContains("claude-code")
			.stdoutContains("opencode")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should accept USAGE_MONITOR_SOURCE environment variable", async () => {
		const result = await runCli(["--once"], { ...context, env: { USAGE_MONITOR_SOURCE: "auto" } })

		const assertions = assertCli(result).exitSuccess().stdoutContains("44%")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should reject invalid source value", async () => {
		const result = await runCli(["--once", "--source", "invalid-source"], context)

		expect(result.stdout + result.stderr).toMatch(/invalid|unknown|source/i)
	})
})

describe("Subcommands", () => {
	let mockServer: MockServerHandle
	let context: TestContext

	beforeAll(async () => {
		mockServer = await startMockServer({ scenario: "healthy" })
		context = await createTestContext({ mockServer, scenario: "healthy" })
	})

	afterAll(async () => {
		await mockServer.stop()
	})

	it("should show update subcommand in help", async () => {
		const result = await runCli(["--help"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("update")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should show uninstall subcommand in help", async () => {
		const result = await runCli(["--help"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("uninstall")

		expect(assertions.allPassed()).toBe(true)
	})

	it("update subcommand should detect non-binary install", async () => {
		const result = await runCli(["update"], context)

		// When running via bun (not binary), it should suggest using package manager
		expect(result.stdout).toContain("bun")
	})

	it("uninstall subcommand should detect non-binary install", async () => {
		const result = await runCli(["uninstall"], context)

		// When running via bun (not binary), it should suggest using package manager
		expect(result.stdout).toContain("bun")
	})
})
