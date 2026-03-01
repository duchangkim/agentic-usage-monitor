import { execSync, spawnSync } from "node:child_process"

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

export function launchWithWindowsTerminal(
	mainCmd: string,
	monitorCmd: string,
	position: Position,
	sessionName: string,
): void {
	if (!isInsideWindowsTerminal()) {
		console.error("Warning: Not running inside Windows Terminal (WT_SESSION not set).")
		console.error("The split pane will open in a new window instead of the current one.")
		console.error("")
	}

	const plan = buildWtLaunchPlan(mainCmd, monitorCmd, position)

	console.log("Starting with Windows Terminal pane split")
	console.log(`  Command: ${mainCmd}`)
	console.log(`  Monitor: ${position}`)
	console.log("")

	// Spawn wt.exe to create the split pane
	const env = { ...process.env, USAGE_MONITOR_SESSION: sessionName }
	spawnSync("wt.exe", plan.wtArgs, { stdio: "ignore", env })

	// Run the current pane command (inherits stdio)
	const cmdParts = plan.currentPaneCmd.split(" ")
	const currentEnv = plan.monitorInCurrentPane
		? { ...process.env, USAGE_MONITOR_SESSION: sessionName }
		: process.env
	const cmd = cmdParts[0]
	if (cmd) {
		spawnSync(cmd, cmdParts.slice(1), { stdio: "inherit", env: currentEnv })
	}
}
