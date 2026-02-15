import { text } from "./renderer"
import { getTheme } from "./theme"

export interface ProgressBarOptions {
	width: number
	filledChar: string
	emptyChar: string
	showPercentage: boolean
	showLabel: boolean
	labelWidth: number
	filledColor: string
	emptyColor: string
	percentageColor: string
}

function getDefaultOptions(): ProgressBarOptions {
	const { colors } = getTheme()
	return {
		width: 20,
		filledChar: "━",
		emptyChar: "░",
		showPercentage: true,
		showLabel: true,
		labelWidth: 12,
		filledColor: colors.status.info,
		emptyColor: colors.progress.empty,
		percentageColor: colors.fg.default,
	}
}

export function progressBar(
	value: number,
	max: number,
	label = "",
	opts: Partial<ProgressBarOptions> = {},
): string {
	const options = { ...getDefaultOptions(), ...opts }
	const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
	const filledCount = Math.round((percentage / 100) * options.width)
	const emptyCount = options.width - filledCount

	const filled = text(options.filledChar.repeat(filledCount), options.filledColor)
	const empty = text(options.emptyChar.repeat(emptyCount), options.emptyColor)
	const bar = filled + empty

	const parts: string[] = []

	if (options.showLabel && label) {
		const paddedLabel = label.padEnd(options.labelWidth)
		parts.push(paddedLabel)
	}

	parts.push(bar)

	if (options.showPercentage) {
		const pct = text(`${Math.round(percentage).toString().padStart(3)}%`, options.percentageColor)
		parts.push(pct)
	}

	return parts.join(" ")
}

export function colorByPercentage(percentage: number): string {
	const { progress } = getTheme().colors
	if (percentage >= 90) return progress.critical
	if (percentage >= 70) return progress.high
	if (percentage >= 50) return progress.medium
	return progress.low
}

export function progressBarWithThreshold(
	value: number,
	max: number,
	label = "",
	opts: Partial<ProgressBarOptions> = {},
): string {
	const percentage = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
	const color = colorByPercentage(percentage)

	return progressBar(value, max, label, {
		...opts,
		filledColor: color,
	})
}

export function formatTimeRemaining(resetTime: Date): string {
	const now = new Date()
	const diff = resetTime.getTime() - now.getTime()

	if (diff <= 0) return "now"

	const hours = Math.floor(diff / (1000 * 60 * 60))
	const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

	if (hours > 24) {
		const days = Math.floor(hours / 24)
		return `${days}d ${hours % 24}h`
	}

	if (hours > 0) {
		return `${hours}h ${minutes}m`
	}

	return `${minutes}m`
}

export function formatResetTime(resetTime: Date): string {
	const options: Intl.DateTimeFormatOptions = {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
	}
	return resetTime.toLocaleString("en-US", options)
}

export interface UsageLimitDisplay {
	label: string
	current: number
	max: number
	resetTime?: Date
}

export function renderUsageLimit(limit: UsageLimitDisplay, width: number): string {
	const percentage = limit.max > 0 ? (limit.current / limit.max) * 100 : 0
	const barWidth = width - 20

	const bar = progressBarWithThreshold(limit.current, limit.max, "", {
		width: barWidth,
		showPercentage: false,
		showLabel: false,
	})

	const pctStr = `${Math.round(percentage)}%`.padStart(4)
	const resetStr = limit.resetTime
		? text(`(${formatTimeRemaining(limit.resetTime)})`, getTheme().colors.fg.subtle)
		: ""

	return `${limit.label.padEnd(10)} ${bar} ${pctStr} ${resetStr}`
}
