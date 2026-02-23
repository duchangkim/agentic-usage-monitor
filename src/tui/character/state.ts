import type { UsageData } from "../widget"
import type { CharacterState } from "./types"

export function deriveCharacterState(
	usage: UsageData | null,
	error: string | null,
): CharacterState {
	if (!usage && error) return "error"
	if (!usage) return "relaxed"

	const values: number[] = []
	if (usage.fiveHour) values.push(usage.fiveHour.utilization)
	if (usage.sevenDay) values.push(usage.sevenDay.utilization)
	if (usage.sevenDayOpus) values.push(usage.sevenDayOpus.utilization)

	if (values.length === 0) return "relaxed"

	const max = Math.max(...values)

	if (max >= 100) return "rateLimit"
	if (max >= 80) return "critical"
	if (max >= 60) return "concerned"
	if (max >= 30) return "normal"
	return "relaxed"
}
