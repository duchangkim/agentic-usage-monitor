import type { Provider, UsageData } from "../types"
import type { WidgetPosition } from "./positions"
import { calculateLayout, getTerminalSize } from "./positions"
import { boxBottom, boxDivider, boxRow, boxTop, moveCursor, text } from "./renderer"
import { ANSI, type BoxStyle, ICONS } from "./styles"

export interface WidgetConfig {
	width: number
	position: WidgetPosition
	boxStyle: BoxStyle
	title: string
	showProviderIcons: boolean
	compactMode: boolean
	refreshInterval: number
}

const DEFAULT_CONFIG: WidgetConfig = {
	width: 44,
	position: "floating",
	boxStyle: "rounded",
	title: "Usage Monitor",
	showProviderIcons: true,
	compactMode: false,
	refreshInterval: 5000,
}

export class UsageWidget {
	private config: WidgetConfig
	private visible = true
	private usageData: UsageData[] = []

	constructor(config: Partial<WidgetConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config }
	}

	setConfig(config: Partial<WidgetConfig>): void {
		this.config = { ...this.config, ...config }
	}

	setPosition(position: WidgetPosition): void {
		this.config.position = position
	}

	toggle(): void {
		this.visible = !this.visible
	}

	show(): void {
		this.visible = true
	}

	hide(): void {
		this.visible = false
	}

	isVisible(): boolean {
		return this.visible
	}

	setUsageData(data: UsageData[]): void {
		this.usageData = data
	}

	private getProviderIcon(provider: Provider): string {
		if (!this.config.showProviderIcons) return ""
		return ICONS[provider] || "•"
	}

	private formatTokens(tokens: number): string {
		if (tokens >= 1_000_000) {
			return `${(tokens / 1_000_000).toFixed(1)}M`
		}
		if (tokens >= 1_000) {
			return `${(tokens / 1_000).toFixed(1)}K`
		}
		return tokens.toString()
	}

	private formatCost(amount: number, currency: string): string {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency,
			minimumFractionDigits: 2,
			maximumFractionDigits: 4,
		}).format(amount)
	}

	private renderProviderRow(data: UsageData): string[] {
		const icon = this.getProviderIcon(data.provider)
		const name = data.provider.charAt(0).toUpperCase() + data.provider.slice(1)
		const tokens = this.formatTokens(data.usage.totalTokens)
		const cost = this.formatCost(data.cost.amount, data.cost.currency)

		if (this.config.compactMode) {
			return [`${icon} ${text(name, ANSI.bold)}: ${tokens} ${text(cost, ANSI.fg.green)}`]
		}

		return [
			`${icon} ${text(name, ANSI.bold)}`,
			`  ${ICONS.tokens} Tokens: ${text(tokens, ANSI.fg.cyan)}`,
			`  ${ICONS.cost} Cost:   ${text(cost, ANSI.fg.green)}`,
		]
	}

	private renderTotalRow(): string[] {
		const totalTokens = this.usageData.reduce((sum, d) => sum + d.usage.totalTokens, 0)
		const totalCost = this.usageData.reduce((sum, d) => sum + d.cost.amount, 0)

		return [
			text("Total", ANSI.bold, ANSI.fg.yellow),
			`  ${ICONS.tokens} ${text(this.formatTokens(totalTokens), ANSI.fg.cyan)}`,
			`  ${ICONS.cost} ${text(this.formatCost(totalCost, "USD"), ANSI.fg.green)}`,
		]
	}

	private renderEmptyState(): string[] {
		return [
			text("No usage data", ANSI.dim),
			"",
			"Configure API keys to start",
			"tracking your LLM usage.",
		]
	}

	render(): string[] {
		if (!this.visible) return []

		const { width, boxStyle, title } = this.config
		const lines: string[] = []

		lines.push(boxTop(width, title, { boxStyle }))

		if (this.usageData.length === 0) {
			for (const line of this.renderEmptyState()) {
				lines.push(boxRow(line, width, { boxStyle }))
			}
		} else {
			for (let i = 0; i < this.usageData.length; i++) {
				const data = this.usageData[i]
				if (data) {
					if (i > 0) {
						lines.push(boxDivider(width, { boxStyle }))
					}
					for (const row of this.renderProviderRow(data)) {
						lines.push(boxRow(row, width, { boxStyle }))
					}
				}
			}

			if (this.usageData.length > 1) {
				lines.push(boxDivider(width, { boxStyle }))
				for (const row of this.renderTotalRow()) {
					lines.push(boxRow(row, width, { boxStyle }))
				}
			}
		}

		lines.push(boxBottom(width, { boxStyle }))

		return lines
	}

	renderAtPosition(): string {
		if (!this.visible) return ""

		const lines = this.render()
		const height = lines.length
		const layout = calculateLayout(
			this.config.position,
			this.config.width,
			height,
			getTerminalSize(),
		)

		let output = ""
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			if (line !== undefined) {
				output += moveCursor(layout.row + i, layout.col) + line
			}
		}

		return output
	}

	toString(): string {
		return this.render().join("\n")
	}

	getHeight(): number {
		return this.render().length
	}

	getWidth(): number {
		return this.config.width
	}
}

export function createWidget(config?: Partial<WidgetConfig>): UsageWidget {
	return new UsageWidget(config)
}
