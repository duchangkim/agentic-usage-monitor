import {
	ANSI,
	type WidgetPosition,
	clearScreen,
	createWidget,
	hideCursor,
	showCursor,
	text,
} from "../tui"
import type { UsageData } from "../types"

const MOCK_DATA: UsageData[] = [
	{
		provider: "anthropic",
		usage: { inputTokens: 125000, outputTokens: 45000, totalTokens: 170000 },
		cost: { amount: 4.25, currency: "USD" },
		period: { start: new Date("2025-01-22"), end: new Date("2025-01-29") },
	},
	{
		provider: "openai",
		usage: { inputTokens: 89000, outputTokens: 32000, totalTokens: 121000 },
		cost: { amount: 2.87, currency: "USD" },
		period: { start: new Date("2025-01-22"), end: new Date("2025-01-29") },
	},
	{
		provider: "openrouter",
		usage: { inputTokens: 45000, outputTokens: 15000, totalTokens: 60000 },
		cost: { amount: 0.95, currency: "USD" },
		period: { start: new Date("2025-01-22"), end: new Date("2025-01-29") },
	},
]

const POSITIONS: WidgetPosition[] = ["floating", "top", "bottom", "left", "right"]

function printHelp(): void {
	console.log(`
${text("Usage Monitor TUI Demo", ANSI.bold, ANSI.fg.cyan)}

${text("Controls:", ANSI.bold)}
  ${text("t", ANSI.fg.yellow)} - Toggle widget visibility
  ${text("p", ANSI.fg.yellow)} - Cycle through positions (floating → top → bottom → left → right)
  ${text("c", ANSI.fg.yellow)} - Toggle compact mode
  ${text("s", ANSI.fg.yellow)} - Cycle box styles (rounded → single → double)
  ${text("d", ANSI.fg.yellow)} - Toggle demo data (with/without data)
  ${text("q", ANSI.fg.yellow)} - Quit

${text("Press any key to start...", ANSI.dim)}
`)
}

async function runDemo(): Promise<void> {
	const widget = createWidget({
		position: "floating",
		boxStyle: "rounded",
		compactMode: false,
	})

	widget.setUsageData(MOCK_DATA)

	let positionIndex = 0
	let styleIndex = 0
	let hasData = true
	const styles = ["rounded", "single", "double"] as const

	const stdin = process.stdin
	stdin.setRawMode(true)
	stdin.resume()
	stdin.setEncoding("utf8")

	function render(): void {
		const output = widget.renderAtPosition()
		process.stdout.write(clearScreen())
		process.stdout.write(output)

		const status = [
			`Position: ${text(widget.isVisible() ? (POSITIONS[positionIndex] ?? "floating") : "hidden", ANSI.fg.cyan)}`,
			`Style: ${text(styles[styleIndex] ?? "rounded", ANSI.fg.magenta)}`,
			`Compact: ${text(widget.isVisible() ? "off" : "on", ANSI.fg.yellow)}`,
			`Data: ${text(hasData ? "mock" : "empty", ANSI.fg.green)}`,
		].join("  │  ")

		process.stdout.write(`\x1b[${process.stdout.rows};1H${text(status, ANSI.dim)}`)
		process.stdout.write(
			`\x1b[${process.stdout.rows};${process.stdout.columns - 20}H${text("Press 'q' to quit", ANSI.dim)}`,
		)
	}

	process.stdout.write(hideCursor())
	render()

	stdin.on("data", (key: string) => {
		switch (key) {
			case "t":
				widget.toggle()
				break

			case "p":
				positionIndex = (positionIndex + 1) % POSITIONS.length
				widget.setPosition(POSITIONS[positionIndex] ?? "floating")
				break

			case "c":
				widget.setConfig({ compactMode: !widget.isVisible() })
				break

			case "s": {
				styleIndex = (styleIndex + 1) % styles.length
				const newStyle = styles[styleIndex]
				if (newStyle) {
					widget.setConfig({ boxStyle: newStyle })
				}
				break
			}

			case "d":
				hasData = !hasData
				widget.setUsageData(hasData ? MOCK_DATA : [])
				break

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
		const widget = createWidget()
		widget.setUsageData(MOCK_DATA)
		console.log(widget.toString())
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
