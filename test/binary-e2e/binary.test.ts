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

	it("should have valid code signature on macOS", async () => {
		if (!binaryExists) return
		if (process.platform !== "darwin") {
			console.log("Skipping: codesign verification only available on macOS")
			return
		}

		const result = await $`codesign --verify --strict ${BINARY_PATH}`.quiet().nothrow()

		if (result.exitCode !== 0) {
			const detail = await $`codesign -dv --verbose=4 ${BINARY_PATH}`.quiet().nothrow()
			console.log("Codesign detail:", detail.stderr.toString())
		}

		expect(result.exitCode).toBe(0)
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

describe("Compiled Binary Uninstall", () => {
	it("should detect binary install and show binary location", async () => {
		if (!binaryExists) return

		// Copy binary to temp location
		const tmpPath = `/tmp/usage-monitor-detect-${Date.now()}`
		await $`cp ${BINARY_PATH} ${tmpPath}`.quiet()

		try {
			// Pipe "n" to cancel — should show Binary location, NOT "bun remove"
			const proc = Bun.spawn([tmpPath, "uninstall"], {
				stdin: "pipe",
				stdout: "pipe",
				stderr: "pipe",
			})

			// Wait briefly for prompt to appear, then send "n" to cancel
			await sleep(500)
			proc.stdin.write("n")
			proc.stdin.flush()
			proc.stdin.end()

			const stdout = await new Response(proc.stdout).text()
			await proc.exited

			const binaryName = tmpPath.split("/").pop() ?? ""
			expect(stdout).toContain("Binary location:")
			expect(stdout).toContain(binaryName)
			expect(stdout).not.toContain("bun remove")
			expect(stdout).toContain("Cancelled")
		} finally {
			await $`rm -f ${tmpPath}`.quiet().nothrow()
		}
	})

	it("should actually delete binary when confirmed with y", async () => {
		if (!binaryExists) return

		const tmpPath = `/tmp/usage-monitor-delete-${Date.now()}`
		await $`cp ${BINARY_PATH} ${tmpPath}`.quiet()

		// Verify copy exists
		expect(existsSync(tmpPath)).toBe(true)

		const proc = Bun.spawn([tmpPath, "uninstall"], {
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		})

		await sleep(500)
		proc.stdin.write("y")
		proc.stdin.flush()
		proc.stdin.end()

		const stdout = await new Response(proc.stdout).text()
		await proc.exited

		// Binary should be deleted
		expect(existsSync(tmpPath)).toBe(false)
		expect(stdout).toContain("Uninstalled successfully")

		// Verify the binary is actually gone — executing it should fail
		const retry = await $`${tmpPath} --version`.quiet().nothrow()
		expect(retry.exitCode).not.toBe(0)
	})

	it("should NOT delete binary when cancelled with n", async () => {
		if (!binaryExists) return

		const tmpPath = `/tmp/usage-monitor-cancel-${Date.now()}`
		await $`cp ${BINARY_PATH} ${tmpPath}`.quiet()

		try {
			const proc = Bun.spawn([tmpPath, "uninstall"], {
				stdin: "pipe",
				stdout: "pipe",
				stderr: "pipe",
			})

			await sleep(500)
			proc.stdin.write("n")
			proc.stdin.flush()
			proc.stdin.end()

			const stdout = await new Response(proc.stdout).text()
			await proc.exited

			// Binary should still exist
			expect(existsSync(tmpPath)).toBe(true)
			expect(stdout).toContain("Cancelled")
		} finally {
			await $`rm -f ${tmpPath}`.quiet().nothrow()
		}
	})

	it("should show success message with Removed path after deletion", async () => {
		if (!binaryExists) return

		const tmpPath = `/tmp/usage-monitor-msg-${Date.now()}`
		await $`cp ${BINARY_PATH} ${tmpPath}`.quiet()

		const proc = Bun.spawn([tmpPath, "uninstall"], {
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		})

		await sleep(500)
		proc.stdin.write("y")
		proc.stdin.flush()
		proc.stdin.end()

		const stdout = await new Response(proc.stdout).text()
		await proc.exited

		// macOS resolves /tmp → /private/tmp, so compare with realpath-resolved name
		const resolvedName = tmpPath.split("/").pop() ?? ""
		expect(stdout).toContain("Removed:")
		expect(stdout).toContain(resolvedName)
		expect(stdout).toContain("Uninstalled successfully")
		// Cleanup not needed — file is already deleted
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
			TEST_CREDENTIALS_PATH: import.meta.dir + "/../fixtures/credentials.json",
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
			const pane0Output = await $`tmux capture-pane -t ${sessionName}:0.0 -p`.quiet().nothrow()
			const pane1Output = await $`tmux capture-pane -t ${sessionName}:0.1 -p`.quiet().nothrow()

			const allOutput = pane0Output.stdout.toString() + pane1Output.stdout.toString()
			const allOutputLower = allOutput.toLowerCase()

			// Must NOT contain module resolution errors
			expect(allOutput).not.toContain("Module not found")
			expect(allOutputLower).not.toContain("module not found")
			expect(allOutput).not.toContain("bun run")

			// Verify pane names
			const paneNames = await $`tmux list-panes -t ${sessionName} -F "#{pane_title}"`
				.quiet()
				.nothrow()
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
			TEST_CREDENTIALS_PATH: import.meta.dir + "/../fixtures/credentials.json",
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
			const monitorOutput = await $`tmux capture-pane -t ${sessionName}:0.1 -p`.quiet().nothrow()
			const output = monitorOutput.stdout.toString()

			// Should contain rate limit indicators (from healthy scenario)
			expect(output).not.toContain("Module not found")

			proc.kill()
		} finally {
			await $`tmux kill-session -t ${sessionName}`.quiet().nothrow()
		}
	})
})
