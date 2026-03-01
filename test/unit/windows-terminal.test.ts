import { describe, expect, it } from "bun:test"
import { buildMonitorCmd } from "../../src/cli/launch"
import {
	buildWtLaunchPlan,
	isInsideWindowsTerminal,
	windowsTerminalAvailable,
} from "../../src/cli/windows-terminal"

// ---- 1. windowsTerminalAvailable ----

describe("windowsTerminalAvailable", () => {
	it("returns true when wt command is found", () => {
		expect(windowsTerminalAvailable(() => true)).toBe(true)
	})

	it("returns false when wt command is not found", () => {
		expect(windowsTerminalAvailable(() => false)).toBe(false)
	})
})

// ---- 2. isInsideWindowsTerminal ----

describe("isInsideWindowsTerminal", () => {
	it("returns true when WT_SESSION is set", () => {
		expect(isInsideWindowsTerminal({ WT_SESSION: "some-guid-value" })).toBe(true)
	})

	it("returns false when WT_SESSION is absent", () => {
		expect(isInsideWindowsTerminal({})).toBe(false)
	})
})

// ---- 3. buildWtLaunchPlan ----

describe("buildWtLaunchPlan", () => {
	const mainCmd = "opencode"
	const monitorCmd = "usage-monitor --compact"

	describe("bottom position", () => {
		it("uses horizontal split flag (-H)", () => {
			const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "bottom")
			expect(plan.wtArgs).toContain("-H")
			expect(plan.wtArgs).not.toContain("-V")
		})

		it("runs monitor in new pane and main in current pane", () => {
			const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "bottom")
			expect(plan.wtArgs.join(" ")).toContain(monitorCmd)
			expect(plan.currentPaneCmd).toBe(mainCmd)
			expect(plan.monitorInCurrentPane).toBe(false)
		})
	})

	describe("right position", () => {
		it("uses vertical split flag (-V)", () => {
			const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "right")
			expect(plan.wtArgs).toContain("-V")
			expect(plan.wtArgs).not.toContain("-H")
		})

		it("runs monitor in new pane and main in current pane", () => {
			const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "right")
			expect(plan.wtArgs.join(" ")).toContain(monitorCmd)
			expect(plan.currentPaneCmd).toBe(mainCmd)
			expect(plan.monitorInCurrentPane).toBe(false)
		})
	})

	describe("top position (role swap)", () => {
		it("uses horizontal split flag (-H)", () => {
			const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "top")
			expect(plan.wtArgs).toContain("-H")
		})

		it("runs main in new pane and monitor in current pane", () => {
			const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "top")
			expect(plan.wtArgs.join(" ")).toContain(mainCmd)
			expect(plan.currentPaneCmd).toBe(monitorCmd)
			expect(plan.monitorInCurrentPane).toBe(true)
		})
	})

	describe("left position (role swap)", () => {
		it("uses vertical split flag (-V)", () => {
			const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "left")
			expect(plan.wtArgs).toContain("-V")
		})

		it("runs main in new pane and monitor in current pane", () => {
			const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "left")
			expect(plan.wtArgs.join(" ")).toContain(mainCmd)
			expect(plan.currentPaneCmd).toBe(monitorCmd)
			expect(plan.monitorInCurrentPane).toBe(true)
		})
	})

	it("includes -w 0 and sp subcommand", () => {
		const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "bottom")
		expect(plan.wtArgs[0]).toBe("-w")
		expect(plan.wtArgs[1]).toBe("0")
		expect(plan.wtArgs[2]).toBe("sp")
	})

	it("includes --size flag with valid fraction", () => {
		const plan = buildWtLaunchPlan(mainCmd, monitorCmd, "bottom")
		const sizeIdx = plan.wtArgs.indexOf("--size")
		expect(sizeIdx).toBeGreaterThan(-1)
		const sizeStr = plan.wtArgs[sizeIdx + 1] ?? ""
		const sizeValue = Number.parseFloat(sizeStr)
		expect(sizeValue).toBeGreaterThan(0)
		expect(sizeValue).toBeLessThan(1)
	})
})

// ---- 4. buildMonitorCmd platform handling ----

describe("buildMonitorCmd platform handling", () => {
	it("on Windows: returns command without inline env var", () => {
		const result = buildMonitorCmd("usage-monitor", "my-session", "bottom", undefined, "win32")
		expect(result).not.toContain("USAGE_MONITOR_SESSION=")
		expect(result).toContain("usage-monitor")
		expect(result).toContain("--compact")
	})

	it("on non-Windows: returns command with inline env var", () => {
		const result = buildMonitorCmd("usage-monitor", "my-session", "bottom", undefined, "darwin")
		expect(result).toContain("USAGE_MONITOR_SESSION=")
		expect(result).toContain("usage-monitor")
		expect(result).toContain("--compact")
	})
})
