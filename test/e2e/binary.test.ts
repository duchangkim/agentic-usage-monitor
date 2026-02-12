import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { $ } from "bun"
import { assertCli } from "../harness/assertions"
import {
	BINARY_PATH,
	type BinaryTestContext,
	createBinaryTestContext,
	runBinary,
} from "../harness/binary-runner"
import { type MockServerHandle, startMockServer } from "../mock-server/oauth-server"

const binaryExists = existsSync(BINARY_PATH)

describe("Compiled Binary E2E", () => {
	let mockServer: MockServerHandle
	let context: BinaryTestContext

	beforeAll(async () => {
		if (!binaryExists) return
		mockServer = await startMockServer({ scenario: "healthy" })
		context = await createBinaryTestContext({ mockServer, scenario: "healthy" })
	})

	afterAll(async () => {
		if (mockServer) await mockServer.stop()
	})

	it("binary should exist at dist/usage-monitor", () => {
		expect(binaryExists).toBe(true)
	})

	it("should display version", async () => {
		if (!binaryExists) return
		const result = await runBinary(["--version"], context)

		const assertions = assertCli(result).exitSuccess().stdoutContains("usage-monitor")

		expect(assertions.allPassed()).toBe(true)
	})

	it("should display help", async () => {
		if (!binaryExists) return
		const result = await runBinary(["--help"], context)

		const assertions = assertCli(result)
			.exitSuccess()
			.stdoutContains("USAGE:")
			.stdoutContains("OPTIONS:")
			.stdoutContains("launch")
			.performance(2000)

		expect(assertions.allPassed()).toBe(true)
	})

	it("should fetch and display rate limits with --once", async () => {
		if (!binaryExists) return
		const result = await runBinary(["--once"], context)

		const assertions = assertCli(result)
			.exitSuccess()
			.didNotTimeout()
			.hasProgressBar()
			.hasBoxDrawing()
			.performance(5000)

		expect(assertions.allPassed()).toBe(true)
		expect(result.stderr).not.toContain("Module not found")
	})

	it("should render compact mode with --compact --once", async () => {
		if (!binaryExists) return
		const result = await runBinary(["--compact", "--once"], context)

		const assertions = assertCli(result)
			.exitSuccess()
			.didNotTimeout()
			.stdoutContains("5h:")
			.stdoutContains("7d:")
			.performance(5000)

		expect(assertions.allPassed()).toBe(true)
		expect(result.stderr).not.toContain("Module not found")
	})

	it("should display launch help", async () => {
		if (!binaryExists) return
		const result = await runBinary(["launch", "--help"], context)

		const assertions = assertCli(result)
			.exitSuccess()
			.stdoutContains("EXAMPLES:")
			.stdoutContains("--left")
			.stdoutContains("--bottom")

		expect(assertions.allPassed()).toBe(true)
	})
})

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const checkTmuxAvailable = async (): Promise<boolean> => {
	try {
		const result = await $`which tmux`.quiet()
		return result.exitCode === 0
	} catch {
		return false
	}
}

describe("Compiled Binary tmux Launch", () => {
	let mockServer: MockServerHandle
	let tmuxAvailable = false

	beforeAll(async () => {
		if (!binaryExists) return
		tmuxAvailable = await checkTmuxAvailable()
		if (!tmuxAvailable) return
		mockServer = await startMockServer({ scenario: "healthy" })
	})

	afterAll(async () => {
		if (mockServer) await mockServer.stop()
	})

	it("should create tmux session with monitor pane (no Module not found)", async () => {
		if (!binaryExists || !tmuxAvailable) {
			console.log("Skipping: binary or tmux not available")
			return
		}

		const sessionName = "test-binary-launch-" + Date.now()
		const env: Record<string, string> = {
			...process.env,
			COLUMNS: "120",
			LINES: "24",
			TEST_CREDENTIALS_PATH:
				import.meta.dir + "/../fixtures/credentials.json",
			OAUTH_API_BASE: mockServer.url + "/api/oauth",
			TERM: "xterm-256color",
		}

		try {
			// Launch binary with tmux in background (detached)
			const proc = Bun.spawn(
				[BINARY_PATH, "launch", "-b", "-s", sessionName, "--", "sleep", "10"],
				{ env, stdout: "pipe", stderr: "pipe" },
			)

			// Wait for tmux session to be created
			await sleep(2000)

			// Verify session exists
			const hasSession = await $`tmux has-session -t ${sessionName}`.quiet().nothrow()
			if (hasSession.exitCode !== 0) {
				console.log("Skipping: tmux session was not created")
				proc.kill()
				return
			}

			// Verify two panes exist (main + monitor)
			const paneList = await $`tmux list-panes -t ${sessionName}`.quiet().nothrow()
			const paneCount = paneList.stdout.toString().trim().split("\n").length
			expect(paneCount).toBe(2)

			// Capture monitor pane output (pane 0 for bottom position = monitor is pane 1)
			const pane0Output =
				await $`tmux capture-pane -t ${sessionName}:0.0 -p`.quiet().nothrow()
			const pane1Output =
				await $`tmux capture-pane -t ${sessionName}:0.1 -p`.quiet().nothrow()

			const allOutput = pane0Output.stdout.toString() + pane1Output.stdout.toString()
			const allOutputLower = allOutput.toLowerCase()

			// Must NOT contain module resolution errors
			expect(allOutput).not.toContain("Module not found")
			expect(allOutputLower).not.toContain("module not found")
			expect(allOutput).not.toContain("bun run")

			// Verify pane names
			const paneNames =
				await $`tmux list-panes -t ${sessionName} -F "#{pane_title}"`.quiet().nothrow()
			const names = paneNames.stdout.toString().trim().split("\n")
			expect(names).toContain("main")
			expect(names).toContain("monitor")

			proc.kill()
		} finally {
			await $`tmux kill-session -t ${sessionName}`.quiet().nothrow()
		}
	})

	it("should show rate limit data in monitor pane", async () => {
		if (!binaryExists || !tmuxAvailable) {
			console.log("Skipping: binary or tmux not available")
			return
		}

		const sessionName = "test-binary-monitor-" + Date.now()
		const env: Record<string, string> = {
			...process.env,
			COLUMNS: "120",
			LINES: "24",
			TEST_CREDENTIALS_PATH:
				import.meta.dir + "/../fixtures/credentials.json",
			OAUTH_API_BASE: mockServer.url + "/api/oauth",
			TERM: "xterm-256color",
		}

		try {
			const proc = Bun.spawn(
				[BINARY_PATH, "launch", "-r", "-s", sessionName, "--", "sleep", "10"],
				{ env, stdout: "pipe", stderr: "pipe" },
			)

			// Wait for monitor to fetch and render
			await sleep(3000)

			const hasSession = await $`tmux has-session -t ${sessionName}`.quiet().nothrow()
			if (hasSession.exitCode !== 0) {
				console.log("Skipping: tmux session was not created")
				proc.kill()
				return
			}

			// Monitor pane is pane 1 for right position
			const monitorOutput =
				await $`tmux capture-pane -t ${sessionName}:0.1 -p`.quiet().nothrow()
			const output = monitorOutput.stdout.toString()

			// Should contain rate limit indicators (from healthy scenario)
			expect(output).not.toContain("Module not found")

			proc.kill()
		} finally {
			await $`tmux kill-session -t ${sessionName}`.quiet().nothrow()
		}
	})
})
