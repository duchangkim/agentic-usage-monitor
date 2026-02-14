import { execSync } from "node:child_process"
import { existsSync, unlinkSync } from "node:fs"

function isBinaryInstall(): boolean {
	const execPath = process.execPath
	return !execPath.includes("bun") && !execPath.includes("node")
}

async function confirm(message: string): Promise<boolean> {
	process.stdout.write(`  ${message} [y/N] `)

	return new Promise((resolve) => {
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(true)
		}
		process.stdin.resume()
		process.stdin.once("data", (data: Buffer) => {
			const key = data.toString().toLowerCase()
			if (process.stdin.isTTY) {
				process.stdin.setRawMode(false)
			}
			process.stdin.pause()
			console.log(key)
			resolve(key === "y")
		})
	})
}

export async function runUninstall(): Promise<void> {
	console.log("")
	console.log("  Agentic Usage Monitor — Uninstall")
	console.log("")

	if (!isBinaryInstall()) {
		console.log("  This installation was not done via standalone binary.")
		console.log("  Uninstall using your package manager instead:")
		console.log("")
		console.log("    bun remove -g agentic-usage-monitor")
		console.log("")
		process.exit(0)
	}

	const binaryPath = process.execPath

	console.log(`  Binary location: ${binaryPath}`)
	console.log("")

	const confirmed = await confirm("Are you sure you want to uninstall?")
	if (!confirmed) {
		console.log("")
		console.log("  Cancelled.")
		console.log("")
		process.exit(0)
	}

	try {
		if (existsSync(binaryPath)) {
			unlinkSync(binaryPath)
			console.log("")
			console.log(`  Removed: ${binaryPath}`)
		} else {
			console.log("")
			console.log(`  Binary not found at: ${binaryPath}`)
		}

		// Check for config files
		const homeDir = process.env.HOME || process.env.USERPROFILE || ""
		const configPaths = [`${homeDir}/.config/usage-monitor`, `${homeDir}/.usage-monitor.yaml`]

		const existingConfigs = configPaths.filter((p) => existsSync(p))
		if (existingConfigs.length > 0) {
			console.log("")
			console.log("  Configuration files remain (remove manually if desired):")
			for (const p of existingConfigs) {
				console.log(`    ${p}`)
			}
		}

		// Check if another usage-monitor remains in PATH
		try {
			const remaining = execSync("which usage-monitor 2>/dev/null", {
				encoding: "utf-8",
			}).trim()
			if (remaining) {
				console.log("")
				console.log(`  Warning: Another 'usage-monitor' still found at: ${remaining}`)
				console.log("  To remove it as well:")
				if (remaining.includes(".bun")) {
					console.log("    bun remove -g agentic-usage-monitor")
				} else {
					console.log(`    rm ${remaining}`)
				}
			}
		} catch {
			// No other usage-monitor in PATH — clean uninstall
		}

		console.log("")
		console.log("  Uninstalled successfully.")
		console.log("")
	} catch (error) {
		console.error(`  Error during uninstall: ${error}`)
		process.exit(1)
	}
}
