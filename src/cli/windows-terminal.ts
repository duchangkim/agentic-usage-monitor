import { execSync } from "node:child_process"

type Position = "left" | "right" | "top" | "bottom"

const HORIZONTAL_PANE_FRACTION = 0.2
const VERTICAL_PANE_FRACTION = 0.2

export interface WtLaunchPlan {
	wtArgs: string[]
	currentPaneCmd: string
	monitorInCurrentPane: boolean
}

function defaultCommandCheck(cmd: string): boolean {
	try {
		execSync(`where ${cmd}`, { stdio: "ignore" })
		return true
	} catch {
		return false
	}
}

export function windowsTerminalAvailable(
	checkCommand: (cmd: string) => boolean = defaultCommandCheck,
): boolean {
	return checkCommand("wt")
}

export function isInsideWindowsTerminal(
	env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
	return !!env.WT_SESSION
}

export function buildWtLaunchPlan(
	mainCmd: string,
	monitorCmd: string,
	position: Position,
): WtLaunchPlan {
	// wt.exe sp always creates the new pane after (below or right of) the current one.
	// For top/left, we swap roles: main goes to the new (larger) pane, monitor stays in current.
	const isRoleSwap = position === "top" || position === "left"
	const isHorizontal = position === "top" || position === "bottom"
	const splitFlag = isHorizontal ? "-H" : "-V"
	const fraction = isHorizontal ? HORIZONTAL_PANE_FRACTION : VERTICAL_PANE_FRACTION

	const splitPaneCmd = isRoleSwap ? mainCmd : monitorCmd
	const currentPaneCmd = isRoleSwap ? monitorCmd : mainCmd
	const size = isRoleSwap ? 1 - fraction : fraction

	const wtArgs = ["-w", "0", "sp", splitFlag, "--size", String(size), splitPaneCmd]

	return {
		wtArgs,
		currentPaneCmd,
		monitorInCurrentPane: isRoleSwap,
	}
}
