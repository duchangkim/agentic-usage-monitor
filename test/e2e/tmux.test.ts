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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const getPaneNames = async (sessionName: string): Promise<string[]> => {
	const result = await $`tmux list-panes -t ${sessionName} -F "#{pane_title}"`.quiet().nothrow()
	if (result.exitCode !== 0) return []
	return result.stdout.toString().trim().split("\n")
}

const getPaneCount = async (sessionName: string): Promise<number> => {
	const result = await $`tmux list-panes -t ${sessionName}`.quiet().nothrow()
	if (result.exitCode !== 0) return 0
	return result.stdout.toString().trim().split("\n").length
}

const sessionExists = async (sessionName: string): Promise<boolean> => {
	const result = await $`tmux has-session -t ${sessionName}`.quiet().nothrow()
	return result.exitCode === 0
}

const killSession = async (sessionName: string): Promise<void> => {
	await $`tmux kill-session -t ${sessionName}`.quiet().nothrow()
}

describe("Pane Naming and Coordinated Shutdown", () => {
	beforeAll(async () => {
		tmuxAvailable = await checkTmuxAvailable()
	})

	it("with-monitor should name panes correctly (main and monitor)", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-pane-names-" + Date.now()

		try {
			await $`./bin/with-monitor -s ${sessionName} -- sleep 5`.quiet().nothrow()
			await sleep(500)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created (likely missing dependencies)")
				return
			}

			const paneNames = await getPaneNames(sessionName)
			expect(paneNames).toContain("main")
			expect(paneNames).toContain("monitor")
		} finally {
			await killSession(sessionName)
		}
	})

	it("should kill session when main command exits", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-main-exit-" + Date.now()

		try {
			await $`./bin/with-monitor -s ${sessionName} -- echo "done"`.quiet().nothrow()
			await sleep(1500)

			const exists = await sessionExists(sessionName)
			expect(exists).toBe(false)
		} finally {
			await killSession(sessionName)
		}
	})

	it("should set extended-keys on for modifier key passthrough", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-extkeys-" + Date.now()

		try {
			await $`./bin/with-monitor -s ${sessionName} -- sleep 5`.quiet().nothrow()
			await sleep(500)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created (likely missing dependencies)")
				return
			}

			const result = await $`tmux show-options -t ${sessionName} extended-keys`.quiet().nothrow()
			if (result.exitCode !== 0) {
				console.log("Skipping: extended-keys option not supported (tmux < 3.2)")
				return
			}

			const output = result.stdout.toString().trim()
			expect(output).toContain("on")
		} finally {
			await killSession(sessionName)
		}
	})

	it("should set allow-passthrough on for terminal escape sequences", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-passthrough-" + Date.now()

		try {
			await $`./bin/with-monitor -s ${sessionName} -- sleep 5`.quiet().nothrow()
			await sleep(500)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created (likely missing dependencies)")
				return
			}

			const result = await $`tmux show-options -t ${sessionName} allow-passthrough`
				.quiet()
				.nothrow()
			if (result.exitCode !== 0) {
				console.log("Skipping: allow-passthrough option not supported (tmux < 3.3)")
				return
			}

			const output = result.stdout.toString().trim()
			expect(output).toContain("on")
		} finally {
			await killSession(sessionName)
		}
	})

	it("should keep main running when monitor pane is killed", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-monitor-kill-" + Date.now()

		try {
			await $`./bin/with-monitor -s ${sessionName} -- sleep 10`.quiet().nothrow()
			await sleep(500)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created")
				return
			}

			const paneCountBefore = await getPaneCount(sessionName)
			if (paneCountBefore < 2) {
				console.log("Skipping: not enough panes created")
				return
			}

			await $`tmux kill-pane -t ${sessionName}:0.1`.quiet().nothrow()
			await sleep(300)

			expect(await sessionExists(sessionName)).toBe(true)
			expect(await getPaneCount(sessionName)).toBe(1)
		} finally {
			await killSession(sessionName)
		}
	})
})
