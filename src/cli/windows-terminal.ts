import { execSync } from "node:child_process"

type Position = "left" | "right" | "top" | "bottom"

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
	void checkCommand
	return false
}

export function isInsideWindowsTerminal(
	env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): boolean {
	void env
	return false
}

export function buildWtLaunchPlan(
	_mainCmd: string,
	_monitorCmd: string,
	_position: Position,
): WtLaunchPlan {
	return { wtArgs: [], currentPaneCmd: "", monitorInCurrentPane: false }
}
