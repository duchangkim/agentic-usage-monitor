import { afterEach, describe, expect, it, mock } from "bun:test"
import { getDefaultConfig } from "../../src/config/schema"
import type { OAuthApiError } from "../../src/data/oauth-api"
import { OAuthMonitor } from "../../src/monitor/oauth-monitor"

function createTestConfig(overrides?: { refreshInterval?: number }) {
	const config = getDefaultConfig()
	config.display.refreshInterval = overrides?.refreshInterval ?? 10
	return config
}

function createRateLimitError(retryAfter: number | null): {
	success: false
	error: OAuthApiError
} {
	return {
		success: false,
		error: {
			type: "rate_limit_error",
			message: "Rate limit exceeded",
			statusCode: 429,
			retryAfter,
		},
	}
}

function createSuccessResponse() {
	return {
		success: true as const,
		data: {
			fiveHour: { utilization: 44, resetsAt: new Date() },
			sevenDay: { utilization: 12, resetsAt: new Date() },
			sevenDayOauthApps: null,
			sevenDayOpus: null,
		},
	}
}

function setupMonitor(refreshInterval?: number) {
	const monitor = new OAuthMonitor(createTestConfig({ refreshInterval }))
	const api = (
		monitor as unknown as {
			api: { getUsage: () => unknown; getProfile: () => unknown; clearCredentials: () => void }
		}
	).api
	const mockGetUsage = mock(() => Promise.resolve(createSuccessResponse()))
	const mockClearCredentials = mock(() => {})
	api.getUsage = mockGetUsage as typeof api.getUsage
	api.getProfile = mock(() =>
		Promise.resolve({
			success: true,
			data: {
				account: {
					uuid: "test",
					fullName: "Test",
					displayName: "Test",
					email: "test@test.com",
					hasClaudeMax: true,
					hasClaudePro: false,
				},
				organization: null,
			},
		}),
	) as typeof api.getProfile
	api.clearCredentials = mockClearCredentials as typeof api.clearCredentials

	return { monitor, mockGetUsage, mockClearCredentials }
}

describe("OAuthMonitor setPollingInterval", () => {
	let monitor: OAuthMonitor

	afterEach(() => {
		monitor.stop()
	})

	it("should change polling interval", async () => {
		const { monitor: m, mockGetUsage } = setupMonitor(60)
		monitor = m

		monitor.start()
		await new Promise((r) => setTimeout(r, 50))

		// Reset call count after initial fetch
		const callsBeforeChange = mockGetUsage.mock.calls.length

		// Change interval to 1 second
		monitor.setPollingInterval(1)

		// Wait 2.5 seconds — should see at least 2 new calls
		await new Promise((r) => setTimeout(r, 2500))

		const newCalls = mockGetUsage.mock.calls.length - callsBeforeChange
		expect(newCalls).toBeGreaterThanOrEqual(2)
	})

	it("should be ignored during backoff", async () => {
		const { monitor: m, mockGetUsage } = setupMonitor(60)
		monitor = m

		monitor.start()
		await new Promise((r) => setTimeout(r, 50))

		// Trigger backoff
		mockGetUsage.mockResolvedValueOnce(createRateLimitError(30))
		await monitor.fetchUsage()
		expect(monitor.getState().isBackingOff).toBe(true)

		const callsBeforeChange = mockGetUsage.mock.calls.length

		// Try to change interval — should be ignored
		monitor.setPollingInterval(1)

		await new Promise((r) => setTimeout(r, 1500))

		const newCalls = mockGetUsage.mock.calls.length - callsBeforeChange
		expect(newCalls).toBe(0)
	})

	it("should be ignored when not running", () => {
		const { monitor: m } = setupMonitor(60)
		monitor = m

		// Don't start the monitor
		// setPollingInterval should not throw or create an interval
		monitor.setPollingInterval(1)

		// Verify no interval was created by checking state
		expect(monitor.getState().isRunning).toBe(false)
	})
})

describe("OAuthMonitor resume event", () => {
	let monitor: OAuthMonitor

	afterEach(() => {
		monitor.stop()
	})

	it("should emit resume event after backoff recovery", async () => {
		const { monitor: m, mockGetUsage } = setupMonitor(60)
		monitor = m

		const events: string[] = []
		monitor.on((event) => events.push(event.type))

		monitor.start()
		await new Promise((r) => setTimeout(r, 50))

		// Trigger short backoff
		mockGetUsage.mockResolvedValueOnce(createRateLimitError(1))
		await monitor.fetchUsage()

		expect(monitor.getState().isBackingOff).toBe(true)

		// Wait for backoff to expire
		await new Promise((r) => setTimeout(r, 1500))

		expect(monitor.getState().isBackingOff).toBe(false)
		expect(events).toContain("resume")
	})
})
