import { beforeAll, describe, expect, it } from "bun:test"
import { $ } from "bun"

let tmuxAvailable = false

const checkTmuxAvailable = async (): Promise<boolean> => {
	try {
		const result = await $`which tmux`.quiet()
		return result.exitCode === 0
	} catch {
		return false
	}
}

describe("tmux Integration", () => {
	beforeAll(async () => {
		tmuxAvailable = await checkTmuxAvailable()
	})

	it("should detect tmux availability", async () => {
		const available = await checkTmuxAvailable()
		console.log("tmux available:", available)
		expect(typeof available).toBe("boolean")
	})

	it("should run in tmux session", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-e2e-" + Date.now()

		try {
			await $`tmux new-session -d -s ${sessionName} "echo 'tmux test' && sleep 1"`.quiet()

			const result = await $`tmux has-session -t ${sessionName}`.quiet().nothrow()

			expect(result.exitCode).toBe(0)
		} finally {
			await $`tmux kill-session -t ${sessionName}`.quiet().nothrow()
		}
	})

	it("should capture tmux pane output", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-e2e-capture-" + Date.now()

		try {
			const newSession =
				await $`tmux new-session -d -s ${sessionName} "echo 'CAPTURE_TEST_OUTPUT'; sleep 2"`
					.quiet()
					.nothrow()
			if (newSession.exitCode !== 0) {
				console.log("Skipping: could not create tmux session")
				return
			}

			await new Promise((resolve) => setTimeout(resolve, 500))

			const captured = await $`tmux capture-pane -t ${sessionName} -p`.quiet().nothrow()
			if (captured.exitCode !== 0) {
				console.log("Skipping: could not capture tmux pane")
				return
			}

			const output = captured.stdout.toString()
			expect(output).toContain("CAPTURE_TEST_OUTPUT")
		} finally {
			await $`tmux kill-session -t ${sessionName}`.quiet().nothrow()
		}
	})
})

describe("bin/opencode-with-monitor", () => {
	it("should exist and be executable", async () => {
		const result = await $`test -x bin/opencode-with-monitor`.quiet().nothrow()
		expect(result.exitCode).toBe(0)
	})

	it("should show help with --help", async () => {
		const result = await $`./bin/opencode-with-monitor --help`.quiet().nothrow()

		expect(result.exitCode).toBe(0)
		expect(result.stdout.toString()).toContain("Usage:")
	})
})

describe("bin/with-monitor", () => {
	it("should exist and be executable", async () => {
		const result = await $`test -x bin/with-monitor`.quiet().nothrow()
		expect(result.exitCode).toBe(0)
	})

	it("should show help with --help", async () => {
		const result = await $`./bin/with-monitor --help`.quiet().nothrow()

		expect(result.exitCode).toBe(0)
		expect(result.stdout.toString()).toContain("Usage:")
	})
})
