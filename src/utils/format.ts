import { createWidget } from "../tui"
import type { CostInfo, DisplayOptions, TokenUsage, UsageData } from "../types"

const CURRENCY_SYMBOLS: Record<string, string> = {
	USD: "$",
	EUR: "€",
	KRW: "₩",
	JPY: "¥",
	GBP: "£",
}

export function formatCurrency(cost: CostInfo, locale = "en-US"): string {
	const symbol = CURRENCY_SYMBOLS[cost.currency] ?? cost.currency
	const formatted = new Intl.NumberFormat(locale, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(cost.amount)

	return `${symbol}${formatted}`
}

export function formatTokens(count: number, locale = "en-US"): string {
	return new Intl.NumberFormat(locale).format(count)
}

export function formatTokenUsage(usage: TokenUsage, locale = "en-US"): string {
	const input = formatTokens(usage.inputTokens, locale)
	const output = formatTokens(usage.outputTokens, locale)
	const total = formatTokens(usage.totalTokens, locale)

	return `${total} tokens (${input} in / ${output} out)`
}

export function formatPeriod(start: Date, end: Date, locale = "en-US"): string {
	const dateFormatter = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	})

	const startStr = dateFormatter.format(start)
	const endStr = dateFormatter.format(end)

	if (startStr === endStr) {
		return startStr
	}

	return `${startStr} - ${endStr}`
}

export function formatUsageData(data: UsageData, options: DisplayOptions): string {
	const lines: string[] = []
	const locale = options.locale

	lines.push(`**${data.provider.toUpperCase()}**`)
	lines.push(`Period: ${formatPeriod(data.period.start, data.period.end, locale)}`)
	lines.push(`Usage: ${formatTokenUsage(data.usage, locale)}`)
	lines.push(`Cost: ${formatCurrency(data.cost, locale)}`)

	if (options.showModelBreakdown && data.modelBreakdown?.length) {
		lines.push("")
		lines.push("Model breakdown:")
		for (const model of data.modelBreakdown) {
			const modelLine = options.compactMode
				? `  • ${model.modelName}: ${formatCurrency(model.cost, locale)}`
				: `  • ${model.modelName}: ${formatTokens(model.usage.totalTokens, locale)} tokens, ${formatCurrency(model.cost, locale)} (${model.requestCount} requests)`
			lines.push(modelLine)
		}
	}

	return lines.join("\n")
}

export function formatUsageSummary(usageList: UsageData[], options: DisplayOptions): string {
	if (usageList.length === 0) {
		return "No usage data available."
	}

	const sections = usageList.map((data) => formatUsageData(data, options))
	const totalCost = usageList.reduce((sum, data) => sum + data.cost.amount, 0)
	const totalTokens = usageList.reduce((sum, data) => sum + data.usage.totalTokens, 0)

	const summary = [
		"## LLM Usage Summary",
		"",
		...sections,
		"",
		"---",
		`**Total**: ${formatTokens(totalTokens, options.locale)} tokens, ${formatCurrency({ amount: totalCost, currency: options.currency }, options.locale)}`,
	]

	return summary.join("\n")
}

export function formatUsageTui(usageList: UsageData[], options: DisplayOptions): string {
	const widget = createWidget({
		compactMode: options.compactMode,
		title: "Usage Monitor",
	})
	widget.setUsageData(usageList)
	return widget.toString()
}
