import { createAdminApi } from "../data"
import {
	ANSI,
	type UsageLimitDisplay,
	clearScreen,
	hideCursor,
	progressBarWithThreshold,
	showCursor,
	text,
} from "../tui"
import { boxBottom, boxRow, boxTop } from "../tui/renderer"

const MOCK_LIMITS: UsageLimitDisplay[] = [
	{
		label: "Session",
		current: 16,
		max: 100,
		resetTime: new Date(Date.now() + 3 * 60 * 60 * 1000 + 58 * 60 * 1000),
	},
	{
		label: "Weekly",
		current: 2,
		max: 100,
		resetTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
	},
	{
		label: "Sonnet",
		current: 0,
		max: 100,
		resetTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
	},
]

function renderLimitsWidget(limits: UsageLimitDisplay[], width: number): string[] {
	const lines: string[] = []
	lines.push(boxTop(width, "Claude.ai Limits", { boxStyle: "rounded" }))

	for (const limit of limits) {
		const barWidth = width - 28
		const percentage = limit.max > 0 ? (limit.current / limit.max) * 100 : 0
		const bar = progressBarWithThreshold(limit.current, limit.max, "", {
			width: barWidth,
			showPercentage: false,
			showLabel: false,
		})

		const pctStr = `${Math.round(percentage)}%`.padStart(3)
		const resetStr = limit.resetTime ? text(formatTimeShort(limit.resetTime), ANSI.dim) : ""

		const content = `${limit.label.padEnd(8)} ${bar} ${pctStr} ${resetStr}`
		lines.push(boxRow(content, width, { boxStyle: "rounded" }))
	}

	lines.push(boxBottom(width, { boxStyle: "rounded" }))
	return lines
}

function formatTimeShort(date: Date): string {
	const diff = date.getTime() - Date.now()
	if (diff <= 0) return "(now)"

	const hours = Math.floor(diff / (1000 * 60 * 60))
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

	if (hours > 24) {
		const days = Math.floor(hours / 24)
		return `(${days}d)`
	}
	if (hours > 0) {
		return `(${hours}h ${minutes}m)`
	}
	return `(${minutes}m)`
}

function renderApiUsageWidget(
	inputTokens: number,
	outputTokens: number,
	cost: number,
	width: number,
): string[] {
	const lines: string[] = []
	lines.push(boxTop(width, "API Usage (This Month)", { boxStyle: "rounded" }))

	const formatTokens = (n: number): string => {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
		if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
		return n.toString()
	}

	lines.push(
		boxRow(
			`Tokens:  ${text(formatTokens(inputTokens), ANSI.fg.cyan)} in / ${text(formatTokens(outputTokens), ANSI.fg.cyan)} out`,
			width,
			{ boxStyle: "rounded" },
		),
	)
	lines.push(
		boxRow(`Cost:    ${text(`$${cost.toFixed(2)}`, ANSI.fg.green)} USD`, width, {
			boxStyle: "rounded",
		}),
	)

	lines.push(boxBottom(width, { boxStyle: "rounded" }))
	return lines
}

function printHelp(): void {
	console.log(`
${text("Usage Monitor TUI Demo", ANSI.bold, ANSI.fg.cyan)}

${text("Controls:", ANSI.bold)}
  ${text("t", ANSI.fg.yellow)} - Toggle widget visibility
  ${text("p", ANSI.fg.yellow)} - Cycle through positions
  ${text("1", ANSI.fg.yellow)} - Show Claude.ai Limits widget
  ${text("2", ANSI.fg.yellow)} - Show API Usage widget  
  ${text("3", ANSI.fg.yellow)} - Show both widgets
  ${text("a", ANSI.fg.yellow)} - Fetch real API data (requires ANTHROPIC_ADMIN_API_KEY)
  ${text("q", ANSI.fg.yellow)} - Quit

${text("Press any key to start...", ANSI.dim)}
`)
}

async function fetchRealData(): Promise<{
	inputTokens: number
	outputTokens: number
	cost: number
} | null> {
	const apiKey = process.env.ANTHROPIC_ADMIN_API_KEY
	if (!apiKey) {
		console.log(text("ANTHROPIC_ADMIN_API_KEY not set in .env", ANSI.fg.yellow))
		console.log(text("Note: Admin API key is different from regular API key.", ANSI.dim))
		console.log(text("Get it from: Console > Settings > Admin API Keys", ANSI.dim))
		return null
	}

	console.log(text("Fetching from Admin API...", ANSI.fg.cyan))
	const api = createAdminApi(apiKey)
	const result = await api.getMonthlyUsageSummary()

	if (!result.success) {
		if (result.error.type === "authentication_error") {
			console.log(text("Authentication failed.", ANSI.fg.red))
			console.log(
				text("Your key might be a regular API key, not an Admin API key.", ANSI.fg.yellow),
			)
			console.log(text("Admin keys: 'sk-ant-admin...' vs Regular: 'sk-ant-api...'", ANSI.dim))
		} else {
			console.log(text(`API Error: ${result.error.message}`, ANSI.fg.red))
		}
		return null
	}

	console.log(text("Success!", ANSI.fg.green))
	return {
		inputTokens: result.data.totalInputTokens,
		outputTokens: result.data.totalOutputTokens,
		cost: result.data.totalCost,
	}
}

async function runDemo(): Promise<void> {
	let visible = true
	let showLimits = true
	let showApiUsage = true
	let apiData = { inputTokens: 1_234_567, outputTokens: 456_789, cost: 47.25 }

	const stdin = process.stdin
	stdin.setRawMode(true)
	stdin.resume()
	stdin.setEncoding("utf8")

	function render(): void {
		process.stdout.write(clearScreen())

		if (!visible) {
			process.stdout.write(text("Widget hidden. Press 't' to show.", ANSI.dim))
			return
		}

		const width = 44
		let row = 2

		if (showLimits) {
			const limitsLines = renderLimitsWidget(MOCK_LIMITS, width)
			for (const line of limitsLines) {
				process.stdout.write(`\x1b[${row};2H${line}`)
				row++
			}
			row++
		}

		if (showApiUsage) {
			const apiLines = renderApiUsageWidget(
				apiData.inputTokens,
				apiData.outputTokens,
				apiData.cost,
				width,
			)
			for (const line of apiLines) {
				process.stdout.write(`\x1b[${row};2H${line}`)
				row++
			}
		}

		const status = [
			`Limits: ${showLimits ? "on" : "off"}`,
			`API: ${showApiUsage ? "on" : "off"}`,
		].join(" | ")

		process.stdout.write(
			`\x1b[${process.stdout.rows};1H${text(status, ANSI.dim)}  ${text("Press 'q' to quit", ANSI.dim)}`,
		)
	}

	process.stdout.write(hideCursor())
	render()

	stdin.on("data", async (key: string) => {
		switch (key) {
			case "t":
				visible = !visible
				break

			case "1":
				showLimits = true
				showApiUsage = false
				break

			case "2":
				showLimits = false
				showApiUsage = true
				break

			case "3":
				showLimits = true
				showApiUsage = true
				break

			case "a": {
				process.stdout.write(clearScreen())
				process.stdout.write(text("Fetching API data...", ANSI.fg.yellow))
				const data = await fetchRealData()
				if (data) {
					apiData = data
				}
				break
			}

			case "q":
			case "\x03":
				process.stdout.write(showCursor())
				process.stdout.write(clearScreen())
				console.log("Goodbye!")
				process.exit(0)
				break
		}

		render()
	})

	process.on("SIGINT", () => {
		process.stdout.write(showCursor())
		process.stdout.write(clearScreen())
		process.exit(0)
	})

	process.stdout.on("resize", () => {
		render()
	})
}

async function main(): Promise<void> {
	const args = process.argv.slice(2)

	if (args.includes("--help") || args.includes("-h")) {
		printHelp()
		return
	}

	if (args.includes("--static")) {
		const width = 44
		console.log(renderLimitsWidget(MOCK_LIMITS, width).join("\n"))
		console.log()
		console.log(renderApiUsageWidget(1_234_567, 456_789, 47.25, width).join("\n"))
		return
	}

	if (args.includes("--api")) {
		const data = await fetchRealData()
		if (data) {
			const width = 44
			console.log(
				renderApiUsageWidget(data.inputTokens, data.outputTokens, data.cost, width).join("\n"),
			)
		}
		return
	}

	printHelp()

	process.stdin.setRawMode(true)
	process.stdin.resume()

	await new Promise<void>((resolve) => {
		process.stdin.once("data", () => {
			resolve()
		})
	})

	await runDemo()
}

main().catch(console.error)
