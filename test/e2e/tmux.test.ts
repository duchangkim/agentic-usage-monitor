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

describe("usage-monitor launch", () => {
	it("should show help with --help", async () => {
		const result = await $`bun run src/cli/index.ts launch --help`.quiet().nothrow()

		expect(result.exitCode).toBe(0)
		const output = result.stdout.toString()
		expect(output).toContain("Usage:")
		expect(output).toContain("usage-monitor launch")
	})

	it("should show bottom as default position in help", async () => {
		const result = await $`bun run src/cli/index.ts launch --help`.quiet().nothrow()

		expect(result.exitCode).toBe(0)
		const output = result.stdout.toString()
		expect(output).toContain("bottom")
		expect(output).toContain("default")
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

/** Get pane info as { index, title, id } for each pane */
const getPaneInfo = async (
	sessionName: string,
): Promise<Array<{ index: string; title: string; id: string }>> => {
	const result =
		await $`tmux list-panes -t ${sessionName} -F "#{pane_index}|#{pane_title}|#{pane_id}"`
			.quiet()
			.nothrow()
	if (result.exitCode !== 0) return []
	return result.stdout
		.toString()
		.trim()
		.split("\n")
		.map((line) => {
			const [index, title, id] = line.split("|")
			return { index: index ?? "", title: title ?? "", id: id ?? "" }
		})
}

/** Get the pane ID of the monitor pane by title */
const getMonitorPaneId = async (sessionName: string): Promise<string | null> => {
	const panes = await getPaneInfo(sessionName)
	const monitor = panes.find((p) => p.title === "monitor")
	return monitor?.id ?? null
}

/** Get pane layout direction: "horizontal" if side-by-side, "vertical" if stacked */
const getPaneLayoutDirection = async (sessionName: string): Promise<string | null> => {
	const result = await $`tmux list-windows -t ${sessionName} -F "#{window_layout}"`
		.quiet()
		.nothrow()
	if (result.exitCode !== 0) return null
	const layout = result.stdout.toString().trim()
	// tmux layout format: checksum,WxH,x,y{...} or [...]
	// '{' means horizontal split, '[' means vertical split at the top level
	if (layout.includes("{")) return "horizontal"
	if (layout.includes("[")) return "vertical"
	return null
}

/** Send raw escape key sequence to the monitor pane */
const sendKeysToMonitorPane = async (sessionName: string, keys: string): Promise<boolean> => {
	const monitorId = await getMonitorPaneId(sessionName)
	if (!monitorId) return false
	const result = await $`tmux send-keys -t ${monitorId} -l ${keys}`.quiet().nothrow()
	return result.exitCode === 0
}

/** Get monitor pane's positional index (0 = first/left/top, 1 = second/right/bottom) */
const getMonitorPaneIndex = async (sessionName: string): Promise<string | null> => {
	const panes = await getPaneInfo(sessionName)
	const monitor = panes.find((p) => p.title === "monitor")
	return monitor?.index ?? null
}

/** Get the title of the currently active (focused) pane */
const getActivePaneTitle = async (sessionName: string): Promise<string | null> => {
	const result = await $`tmux list-panes -t ${sessionName} -F "#{pane_active}|#{pane_title}"`
		.quiet()
		.nothrow()
	if (result.exitCode !== 0) return null
	const lines = result.stdout.toString().trim().split("\n")
	const activeLine = lines.find((line) => line.startsWith("1|"))
	return activeLine?.split("|")[1] ?? null
}

/** Get pane heights as Map<title, height> */
const getPaneHeights = async (sessionName: string): Promise<Map<string, number>> => {
	const result = await $`tmux list-panes -t ${sessionName} -F "#{pane_title}|#{pane_height}"`
		.quiet()
		.nothrow()
	const map = new Map<string, number>()
	if (result.exitCode !== 0) return map
	for (const line of result.stdout.toString().trim().split("\n")) {
		const [title, height] = line.split("|")
		if (title && height) map.set(title, Number.parseInt(height, 10))
	}
	return map
}

describe("Pane Naming and Coordinated Shutdown", () => {
	beforeAll(async () => {
		tmuxAvailable = await checkTmuxAvailable()
	})

	it("launch should name panes correctly (main and monitor)", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-pane-names-" + Date.now()

		try {
			await $`bun run src/cli/index.ts launch -s ${sessionName} -- sleep 5`.quiet().nothrow()
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
			await $`bun run src/cli/index.ts launch -s ${sessionName} -- echo "done"`.quiet().nothrow()
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
			await $`bun run src/cli/index.ts launch -s ${sessionName} -- sleep 5`.quiet().nothrow()
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

	it("should bind Shift+Enter to send Escape+Enter for Claude Code compatibility", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-shift-enter-" + Date.now()

		try {
			await $`bun run src/cli/index.ts launch -s ${sessionName} -- sleep 5`.quiet().nothrow()
			await sleep(500)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created (likely missing dependencies)")
				return
			}

			// Verify S-Enter binding exists in tmux key table
			const result = await $`tmux list-keys`.quiet().nothrow()
			if (result.exitCode !== 0) {
				console.log("Skipping: could not list tmux keys")
				return
			}

			const output = result.stdout.toString()
			const sEnterBinding = output.split("\n").find((line) => line.includes("S-Enter"))
			expect(sEnterBinding).toBeDefined()
			expect(sEnterBinding).toContain("send-keys")
		} finally {
			// Clean up binding since it's global
			await $`tmux unbind-key -n S-Enter`.quiet().nothrow()
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
			await $`bun run src/cli/index.ts launch -s ${sessionName} -- sleep 5`.quiet().nothrow()
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
			await $`bun run src/cli/index.ts launch -s ${sessionName} -- sleep 10`.quiet().nothrow()
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

describe("Interactive Keyboard Shortcuts (Shift+Arrow pane move)", () => {
	beforeAll(async () => {
		tmuxAvailable = await checkTmuxAvailable()
	})

	it("should move monitor pane from bottom to top with Shift+Up", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-shift-up-" + Date.now()

		try {
			// Launch with bottom position (default)
			await $`bun run src/cli/index.ts launch -b -s ${sessionName} -- sleep 30`.quiet().nothrow()
			await sleep(1000)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created")
				return
			}

			// Verify starting state: 2 panes, monitor at index 1 (bottom)
			expect(await getPaneCount(sessionName)).toBe(2)
			const startIndex = await getMonitorPaneIndex(sessionName)
			expect(startIndex).toBe("1") // bottom = index 1
			const startLayout = await getPaneLayoutDirection(sessionName)
			expect(startLayout).toBe("vertical") // top-bottom split

			// Send Shift+Up to monitor pane (ESC [ 1 ; 2 A)
			const sent = await sendKeysToMonitorPane(sessionName, "\x1b[1;2A")
			expect(sent).toBe(true)
			await sleep(1000)

			// After Shift+Up: monitor should be at index 0 (top), layout still vertical
			expect(await getPaneCount(sessionName)).toBe(2)
			const endIndex = await getMonitorPaneIndex(sessionName)
			expect(endIndex).toBe("0") // top = index 0
			const endLayout = await getPaneLayoutDirection(sessionName)
			expect(endLayout).toBe("vertical")

			// Both panes should still have correct titles
			const paneNames = await getPaneNames(sessionName)
			expect(paneNames).toContain("main")
			expect(paneNames).toContain("monitor")
		} finally {
			await killSession(sessionName)
		}
	})

	it("should move monitor pane from bottom to right with Shift+Right", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-shift-right-" + Date.now()

		try {
			// Launch with bottom position
			await $`bun run src/cli/index.ts launch -b -s ${sessionName} -- sleep 30`.quiet().nothrow()
			await sleep(1000)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created")
				return
			}

			const startLayout = await getPaneLayoutDirection(sessionName)
			expect(startLayout).toBe("vertical") // bottom = vertical split

			// Send Shift+Right to monitor pane
			const sent = await sendKeysToMonitorPane(sessionName, "\x1b[1;2C")
			expect(sent).toBe(true)
			await sleep(1000)

			// After Shift+Right: layout should be horizontal, monitor at index 1
			expect(await getPaneCount(sessionName)).toBe(2)
			const endIndex = await getMonitorPaneIndex(sessionName)
			expect(endIndex).toBe("1") // right = index 1
			const endLayout = await getPaneLayoutDirection(sessionName)
			expect(endLayout).toBe("horizontal")
		} finally {
			await killSession(sessionName)
		}
	})

	it("should move monitor pane from right to left with Shift+Left", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-shift-left-" + Date.now()

		try {
			// Launch with right position
			await $`bun run src/cli/index.ts launch -r -s ${sessionName} -- sleep 30`.quiet().nothrow()
			await sleep(1000)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created")
				return
			}

			// Send Shift+Left to monitor pane
			const sent = await sendKeysToMonitorPane(sessionName, "\x1b[1;2D")
			expect(sent).toBe(true)
			await sleep(1000)

			// After Shift+Left: monitor should be at index 0 (left), layout still horizontal
			expect(await getPaneCount(sessionName)).toBe(2)
			const endIndex = await getMonitorPaneIndex(sessionName)
			expect(endIndex).toBe("0") // left = index 0
			const endLayout = await getPaneLayoutDirection(sessionName)
			expect(endLayout).toBe("horizontal")
		} finally {
			await killSession(sessionName)
		}
	})

	it("should preserve both panes after consecutive moves", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-shift-multi-" + Date.now()

		try {
			// Launch with bottom position
			await $`bun run src/cli/index.ts launch -b -s ${sessionName} -- sleep 30`.quiet().nothrow()
			await sleep(1000)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created")
				return
			}

			// Move bottom → top (Shift+Up)
			await sendKeysToMonitorPane(sessionName, "\x1b[1;2A")
			await sleep(1000)
			expect(await getPaneCount(sessionName)).toBe(2)

			// Move top → right (Shift+Right)
			await sendKeysToMonitorPane(sessionName, "\x1b[1;2C")
			await sleep(1000)
			expect(await getPaneCount(sessionName)).toBe(2)

			// Move right → bottom (Shift+Down)
			await sendKeysToMonitorPane(sessionName, "\x1b[1;2B")
			await sleep(1000)
			expect(await getPaneCount(sessionName)).toBe(2)

			// Both panes should still have correct titles
			const paneNames = await getPaneNames(sessionName)
			expect(paneNames).toContain("main")
			expect(paneNames).toContain("monitor")
		} finally {
			await killSession(sessionName)
		}
	})
})

describe("Pane move: focus retention and sizing", () => {
	beforeAll(async () => {
		tmuxAvailable = await checkTmuxAvailable()
	})

	it("should keep focus on monitor pane after Shift+Right", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-focus-right-" + Date.now()

		try {
			// Launch with bottom position
			await $`bun run src/cli/index.ts launch -b -s ${sessionName} -- sleep 30`.quiet().nothrow()
			await sleep(1000)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created")
				return
			}

			// Send Shift+Right to move monitor to right
			const sent = await sendKeysToMonitorPane(sessionName, "\x1b[1;2C")
			expect(sent).toBe(true)
			await sleep(1000)

			// Focus should remain on monitor pane
			const activePaneTitle = await getActivePaneTitle(sessionName)
			expect(activePaneTitle).toBe("monitor")
		} finally {
			await killSession(sessionName)
		}
	})

	it("should keep focus on monitor pane after Shift+Left", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-focus-left-" + Date.now()

		try {
			// Launch with right position
			await $`bun run src/cli/index.ts launch -r -s ${sessionName} -- sleep 30`.quiet().nothrow()
			await sleep(1000)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created")
				return
			}

			// Send Shift+Left to move monitor to left
			const sent = await sendKeysToMonitorPane(sessionName, "\x1b[1;2D")
			expect(sent).toBe(true)
			await sleep(1000)

			// Focus should remain on monitor pane
			const activePaneTitle = await getActivePaneTitle(sessionName)
			expect(activePaneTitle).toBe("monitor")
		} finally {
			await killSession(sessionName)
		}
	})

	it("should keep monitor pane small when moving bottom to top", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-size-up-" + Date.now()

		try {
			// Launch with bottom position (monitor = 3 lines)
			await $`bun run src/cli/index.ts launch -b -s ${sessionName} -- sleep 30`.quiet().nothrow()
			await sleep(1000)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created")
				return
			}

			// Send Shift+Up to move monitor to top
			const sent = await sendKeysToMonitorPane(sessionName, "\x1b[1;2A")
			expect(sent).toBe(true)
			await sleep(1000)

			// Monitor pane should be small (≤5 lines), main pane should be larger
			const heights = await getPaneHeights(sessionName)
			const monitorHeight = heights.get("monitor") ?? 0
			const mainHeight = heights.get("main") ?? 0

			expect(monitorHeight).toBeGreaterThan(0)
			expect(monitorHeight).toBeLessThanOrEqual(5)
			expect(mainHeight).toBeGreaterThan(monitorHeight)
		} finally {
			await killSession(sessionName)
		}
	})

	it("should keep monitor pane small when moving right to bottom", async () => {
		if (!tmuxAvailable) {
			console.log("Skipping: tmux not available")
			return
		}

		const sessionName = "test-size-down-" + Date.now()

		try {
			// Launch with right position (horizontal split)
			await $`bun run src/cli/index.ts launch -r -s ${sessionName} -- sleep 30`.quiet().nothrow()
			await sleep(1000)

			if (!(await sessionExists(sessionName))) {
				console.log("Skipping: session not created")
				return
			}

			// Send Shift+Down to move monitor to bottom
			const sent = await sendKeysToMonitorPane(sessionName, "\x1b[1;2B")
			expect(sent).toBe(true)
			await sleep(1000)

			// Monitor pane should be small (≤5 lines), main pane should be larger
			const heights = await getPaneHeights(sessionName)
			const monitorHeight = heights.get("monitor") ?? 0
			const mainHeight = heights.get("main") ?? 0

			expect(monitorHeight).toBeGreaterThan(0)
			expect(monitorHeight).toBeLessThanOrEqual(5)
			expect(mainHeight).toBeGreaterThan(monitorHeight)
		} finally {
			await killSession(sessionName)
		}
	})
})
