import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { assertCli } from "../harness/assertions"
import { type TestContext, createTestContext, runCli } from "../harness/cli-runner"
import { type MockServerHandle, startMockServer } from "../mock-server/oauth-server"

describe("Agent Subcommand Routing", () => {
	let mockServer: MockServerHandle
	let context: TestContext

	beforeAll(async () => {
		mockServer = await startMockServer({ scenario: "healthy" })
		context = await createTestContext({ mockServer, scenario: "healthy" })
	})

	afterAll(async () => {
		await mockServer.stop()
	})

	it("should show available agents for unknown agent name", async () => {
		const result = await runCli(["nonexistent-agent"], context)

		const combined = result.stdout + result.stderr
		expect(combined).toMatch(/unknown agent|not found|available/i)
		expect(combined).toMatch(/claude/)
		expect(combined).toMatch(/opencode/)
	})

	it("should list agents in help text", async () => {
		const result = await runCli(["--help"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("AGENTS:")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should recognize 'claude' as an agent subcommand", async () => {
		// Without tmux, this should fail gracefully but show it recognized the agent
		const result = await runCli(["claude", "--help"], context)

		const combined = result.stdout + result.stderr
		// Should either show agent-specific help or launch help (not "unknown agent")
		expect(combined).not.toMatch(/unknown agent/i)
	})

	it("should recognize 'opencode' as an agent subcommand", async () => {
		const result = await runCli(["opencode", "--help"], context)

		const combined = result.stdout + result.stderr
		expect(combined).not.toMatch(/unknown agent/i)
	})
})
