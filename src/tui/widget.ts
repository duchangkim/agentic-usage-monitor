import { colorByPercentage, formatTimeRemaining } from "./progress"
import { boxBottom, boxDivider, boxRow, boxTop, stripAnsi, text } from "./renderer"
import { ANSI, type BoxStyle } from "./styles"

export interface WidgetConfig {
	title: string
	width: number
	boxStyle?: BoxStyle
	compact?: boolean
}

export interface RateLimitData {
	utilization: number
	resetsAt: Date
}

export interface ProfileData {
	displayName: string
	organization?: string | undefined
	planBadge?: "ENT" | "MAX" | "PRO" | undefined
}

export interface UsageData {
	fiveHour?: RateLimitData | undefined
	sevenDay?: RateLimitData | undefined
}

function createProgressBar(percentage: number, barWidth: number): string {
	const filledCount = Math.round((percentage / 100) * barWidth)
	const emptyCount = barWidth - filledCount
	const color = colorByPercentage(percentage)

	const filled = text("━".repeat(filledCount), color)
	const empty = text("░".repeat(emptyCount), ANSI.dim)
	return filled + empty
}

function calculateBarWidth(totalWidth: number, compact: boolean): number {
	const labelWidth = compact ? 4 : 8
	const pctWidth = 5
	const resetWidth = 12
	const padding = 4
	return Math.max(5, totalWidth - labelWidth - pctWidth - resetWidth - padding)
}

function renderRateLimitRow(
	label: string,
	data: RateLimitData,
	totalWidth: number,
	compact: boolean,
): string {
	const innerWidth = totalWidth - 4
	const barWidth = calculateBarWidth(innerWidth, compact)

	const bar = createProgressBar(data.utilization, barWidth)
	const pct = `${Math.round(data.utilization)}%`.padStart(4)
	const resetText = formatTimeRemaining(data.resetsAt)
	const resetMaxLen = compact ? 6 : 10
	const reset = text(`(${resetText.slice(0, resetMaxLen)})`, ANSI.dim)

	return `${label}${bar} ${pct} ${reset}`
}

export function renderUsageWidget(
	config: WidgetConfig,
	profile: ProfileData | null,
	usage: UsageData | null,
	lastFetch: Date | null,
	error: string | null,
): string[] {
	const { title, width, boxStyle = "rounded", compact = false } = config
	const lines: string[] = []

	lines.push(boxTop(width, title, { boxStyle }))

	if (profile) {
		const maxNameLen = width - 12
		const name =
			profile.displayName.length > maxNameLen
				? `${profile.displayName.slice(0, maxNameLen - 1)}…`
				: profile.displayName

		lines.push(boxRow(`${text("User:", ANSI.dim)} ${name}`, width, { boxStyle }))

		if (profile.organization && !compact) {
			const maxOrgLen = width - 12
			const org =
				profile.organization.length > maxOrgLen
					? `${profile.organization.slice(0, maxOrgLen - 1)}…`
					: profile.organization
			lines.push(boxRow(`${text("Org:", ANSI.dim)}  ${org}`, width, { boxStyle }))
		}

		if (profile.planBadge) {
			const badgeColors = {
				ENT: ANSI.fg.cyan,
				MAX: ANSI.fg.magenta,
				PRO: ANSI.fg.green,
			} as const
			const badge = text(` ${profile.planBadge}`, badgeColors[profile.planBadge])
			lines.push(boxRow(`${text("Plan:", ANSI.dim)}${badge}`, width, { boxStyle }))
		}

		lines.push(boxDivider(width, { boxStyle }))
	}

	if (!usage) {
		if (error) {
			lines.push(boxRow(text(error, ANSI.fg.red), width, { boxStyle }))
		} else {
			lines.push(boxRow(text("Loading...", ANSI.dim), width, { boxStyle }))
		}
	} else {
		const label5h = compact ? "5h: " : "5-Hour: "
		const label7d = compact ? "7d: " : "7-Day:  "

		if (usage.fiveHour) {
			lines.push(
				boxRow(renderRateLimitRow(label5h, usage.fiveHour, width, compact), width, { boxStyle }),
			)
		}

		if (usage.sevenDay) {
			lines.push(
				boxRow(renderRateLimitRow(label7d, usage.sevenDay, width, compact), width, { boxStyle }),
			)
		}

		if (!usage.fiveHour && !usage.sevenDay) {
			lines.push(boxRow(text("No limits", ANSI.fg.green), width, { boxStyle }))
		}
	}

	if (lastFetch) {
		lines.push(boxDivider(width, { boxStyle }))
		lines.push(
			boxRow(text(`Updated: ${lastFetch.toLocaleTimeString()}`, ANSI.dim), width, { boxStyle }),
		)
	}

	lines.push(boxBottom(width, { boxStyle }))

	return lines
}

export function renderStatusBar(
	isRunning: boolean,
	lastError: string | null,
	refreshInterval: number,
	maxWidth: number,
): string {
	const status = isRunning ? text("● Running", ANSI.fg.green) : text("○ Stopped", ANSI.dim)
	const interval = `Refresh: ${refreshInterval}s`

	if (!lastError) {
		return `${status} | ${interval}`
	}

	const baseLen = stripAnsi(`${status} | ${interval} | Error: `).length
	const maxErrorLen = Math.max(10, maxWidth - baseLen)
	const error =
		lastError.length > maxErrorLen ? `${lastError.slice(0, maxErrorLen - 1)}…` : lastError

	return `${status} | ${interval} | ${text(`Error: ${error}`, ANSI.fg.red)}`
}
