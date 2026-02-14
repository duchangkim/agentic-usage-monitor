import { execSync } from "node:child_process"

export type PaneMoveDirection = "up" | "down" | "left" | "right"

export interface MoveResult {
	success: boolean
	newCompactMode: boolean
}

const HORIZONTAL_PANE_SIZE = 20
const VERTICAL_PANE_LINES = 3

/**
 * Move the monitor pane to a new position within the tmux session.
 *
 * Uses `process.env.TMUX_PANE` (set by tmux for every pane process) to identify
 * the monitor pane by its stable pane ID (e.g., `%3`), avoiding the bug where
 * a hardcoded index like `0.0` would target the wrong pane depending on position.
 *
 * After `break-pane`, only the main pane remains at `0.0` in window 0,
 * so `join-pane -t session:0.0` correctly targets the main pane as the destination.
 */
export function moveMonitorPane(
	tmuxSession: string,
	monitorPaneId: string,
	direction: PaneMoveDirection,
	currentCompactMode: boolean,
): MoveResult {
	const s = JSON.stringify(tmuxSession)

	// Remove any existing window-layout-changed hook BEFORE break/join-pane.
	// Without this, the old hook (e.g., "resize-pane -t 0.1 -y 3" from a bottom position)
	// fires during join-pane and resizes the WRONG pane (main instead of monitor).
	try {
		execSync(`tmux set-hook -u -t ${s} window-layout-changed`, { stdio: "ignore" })
	} catch {
		// Hook may not exist, ignore
	}

	try {
		// Break monitor pane out to a temporary window using its own pane ID
		// Note: break-pane uses -s (source pane), not -t (which is the destination window)
		execSync(`tmux break-pane -s ${monitorPaneId} -d -n _monitor_tmp`, { stdio: "ignore" })
	} catch {
		return { success: false, newCompactMode: currentCompactMode }
	}

	try {
		switch (direction) {
			case "left":
				execSync(
					`tmux join-pane -h -b -t ${s}:0.0 -s ${s}:_monitor_tmp -l ${HORIZONTAL_PANE_SIZE}%`,
					{ stdio: "ignore" },
				)
				// Set title; select-pane -T also keeps focus on the monitor pane
				execSync(`tmux select-pane -t ${s}:0.0 -T monitor`, { stdio: "ignore" })
				return { success: true, newCompactMode: false }

			case "right":
				execSync(`tmux join-pane -h -t ${s}:0.0 -s ${s}:_monitor_tmp -l ${HORIZONTAL_PANE_SIZE}%`, {
					stdio: "ignore",
				})
				execSync(`tmux select-pane -t ${s}:0.1 -T monitor`, { stdio: "ignore" })
				return { success: true, newCompactMode: false }

			case "up":
				execSync(
					`tmux join-pane -v -b -t ${s}:0.0 -s ${s}:_monitor_tmp -l ${VERTICAL_PANE_LINES}`,
					{ stdio: "ignore" },
				)
				execSync(`tmux select-pane -t ${s}:0.0 -T monitor`, { stdio: "ignore" })
				// Lock monitor pane height
				execSync(
					`tmux set-hook -t ${s} window-layout-changed "resize-pane -t '${tmuxSession}:0.0' -y ${VERTICAL_PANE_LINES}"`,
					{ stdio: "ignore" },
				)
				return { success: true, newCompactMode: true }

			case "down":
				execSync(`tmux join-pane -v -t ${s}:0.0 -s ${s}:_monitor_tmp -l ${VERTICAL_PANE_LINES}`, {
					stdio: "ignore",
				})
				execSync(`tmux select-pane -t ${s}:0.1 -T monitor`, { stdio: "ignore" })
				// Lock monitor pane height
				execSync(
					`tmux set-hook -t ${s} window-layout-changed "resize-pane -t '${tmuxSession}:0.1' -y ${VERTICAL_PANE_LINES}"`,
					{ stdio: "ignore" },
				)
				return { success: true, newCompactMode: true }
		}
	} catch {
		// join-pane failed — try to recover the monitor pane back to its original position
		try {
			execSync(`tmux join-pane -v -t ${s}:0.0 -s ${s}:_monitor_tmp`, { stdio: "ignore" })
		} catch {
			// Unable to recover
		}
		return { success: false, newCompactMode: currentCompactMode }
	}
}
