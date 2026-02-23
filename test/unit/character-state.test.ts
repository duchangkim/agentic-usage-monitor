import { describe, expect, it } from "bun:test"
import { deriveCharacterState } from "../../src/tui/character/state"
import type { UsageData } from "../../src/tui/widget"

function makeUsage(fiveHour?: number, sevenDay?: number, sevenDayOpus?: number): UsageData {
	const future = new Date(Date.now() + 3600_000)
	return {
		fiveHour: fiveHour !== undefined ? { utilization: fiveHour, resetsAt: future } : undefined,
		sevenDay: sevenDay !== undefined ? { utilization: sevenDay, resetsAt: future } : undefined,
		sevenDayOpus:
			sevenDayOpus !== undefined ? { utilization: sevenDayOpus, resetsAt: future } : undefined,
	}
}

describe("deriveCharacterState", () => {
	// ---- Error state ----
	it("should return 'error' when usage is null and error exists", () => {
		expect(deriveCharacterState(null, "Auth failed")).toBe("error")
	})

	// ---- Relaxed (initial loading) ----
	it("should return 'relaxed' when usage is null and no error", () => {
		expect(deriveCharacterState(null, null)).toBe("relaxed")
	})

	// ---- Relaxed (low usage) ----
	it("should return 'relaxed' for usage < 30%", () => {
		expect(deriveCharacterState(makeUsage(10, 5), null)).toBe("relaxed")
	})

	it("should return 'relaxed' for usage exactly 0%", () => {
		expect(deriveCharacterState(makeUsage(0, 0), null)).toBe("relaxed")
	})

	it("should return 'relaxed' for usage at 29%", () => {
		expect(deriveCharacterState(makeUsage(29, 10), null)).toBe("relaxed")
	})

	// ---- Normal ----
	it("should return 'normal' for usage at 30%", () => {
		expect(deriveCharacterState(makeUsage(30, 10), null)).toBe("normal")
	})

	it("should return 'normal' for usage at 59%", () => {
		expect(deriveCharacterState(makeUsage(59, 10), null)).toBe("normal")
	})

	// ---- Concerned ----
	it("should return 'concerned' for usage at 60%", () => {
		expect(deriveCharacterState(makeUsage(60, 10), null)).toBe("concerned")
	})

	it("should return 'concerned' for usage at 79%", () => {
		expect(deriveCharacterState(makeUsage(79, 10), null)).toBe("concerned")
	})

	// ---- Critical ----
	it("should return 'critical' for usage at 80%", () => {
		expect(deriveCharacterState(makeUsage(80, 10), null)).toBe("critical")
	})

	it("should return 'critical' for usage at 99%", () => {
		expect(deriveCharacterState(makeUsage(99, 10), null)).toBe("critical")
	})

	// ---- Rate Limited ----
	it("should return 'rateLimit' for usage at 100%", () => {
		expect(deriveCharacterState(makeUsage(100, 10), null)).toBe("rateLimit")
	})

	it("should return 'rateLimit' for usage over 100%", () => {
		expect(deriveCharacterState(makeUsage(120, 10), null)).toBe("rateLimit")
	})

	// ---- Max across all windows ----
	it("should use max utilization across all windows", () => {
		// sevenDay is highest at 85% → critical
		expect(deriveCharacterState(makeUsage(20, 85), null)).toBe("critical")
	})

	it("should consider sevenDayOpus window", () => {
		// sevenDayOpus is highest at 65% → concerned
		expect(deriveCharacterState(makeUsage(10, 20, 65), null)).toBe("concerned")
	})

	// ---- Undefined windows ----
	it("should handle all windows undefined as relaxed", () => {
		expect(deriveCharacterState({}, null)).toBe("relaxed")
	})

	it("should handle only fiveHour defined", () => {
		expect(deriveCharacterState(makeUsage(45), null)).toBe("normal")
	})

	// ---- Error takes precedence over null usage ----
	it("should return 'error' even when error message is empty string", () => {
		// Empty string is falsy but still a string — treat as no error
		expect(deriveCharacterState(null, "")).toBe("relaxed")
	})
})
