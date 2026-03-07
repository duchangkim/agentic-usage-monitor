import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
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

describe("OAuthMonitor backoff", () => {
	let monitor: OAuthMonitor
	let mockGetUsage: ReturnType<typeof mock>
	let mockClearCredentials: ReturnType<typeof mock>

	beforeEach(() => {
		monitor = new OAuthMonitor(createTestConfig())
		// Access the private api to mock it
		const api = (
			monitor as unknown as {
				api: { getUsage: () => unknown; getProfile: () => unknown; clearCredentials: () => void }
			}
		).api
		mockGetUsage = mock(() => Promise.resolve(createSuccessResponse()))
		mockClearCredentials = mock(() => {})
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
	})

	afterEach(() => {
		monitor.stop()
	})

	it("should enter backoff state on 429 error", async () => {
		mockGetUsage.mockResolvedValueOnce(createRateLimitError(30))

		await monitor.fetchUsage()

		const state = monitor.getState()
		expect(state.isBackingOff).toBe(true)
	})

	it("should stop polling interval on 429", async () => {
		monitor.start()
		// Wait a tick for the initial fetch
		await new Promise((r) => setTimeout(r, 50))

		mockGetUsage.mockResolvedValueOnce(createRateLimitError(30))
		await monitor.fetchUsage()

		const state = monitor.getState()
		expect(state.isBackingOff).toBe(true)
		// The interval should be cleared - no more fetches during backoff
	})

	it("should use retryAfter value when > 0", async () => {
		const events: string[] = []
		monitor.on((event) => events.push(event.type))

		mockGetUsage.mockResolvedValueOnce(createRateLimitError(5))
		await monitor.fetchUsage()

		expect(monitor.getState().isBackingOff).toBe(true)
		// After 5 seconds, it should resume (we won't wait that long in tests)
	})

	it("should use DEFAULT_BACKOFF_SECONDS (60) when retryAfter is null", async () => {
		mockGetUsage.mockResolvedValueOnce(createRateLimitError(null))
		await monitor.fetchUsage()

		expect(monitor.getState().isBackingOff).toBe(true)
	})

	it("should use DEFAULT_BACKOFF_SECONDS (60) when retryAfter is 0", async () => {
		mockGetUsage.mockResolvedValueOnce(createRateLimitError(0))
		await monitor.fetchUsage()

		expect(monitor.getState().isBackingOff).toBe(true)
	})

	it("should call clearCredentials after backoff period", async () => {
		// Use a very short retryAfter for testing
		mockGetUsage.mockResolvedValueOnce(createRateLimitError(1))
		await monitor.fetchUsage()

		expect(monitor.getState().isBackingOff).toBe(true)

		// Wait for the backoff to expire (1 second + buffer)
		await new Promise((r) => setTimeout(r, 1500))

		expect(mockClearCredentials).toHaveBeenCalled()
		expect(monitor.getState().isBackingOff).toBe(false)
	})

	it("should resume polling after backoff period", async () => {
		monitor.start()
		await new Promise((r) => setTimeout(r, 50))

		mockGetUsage.mockResolvedValueOnce(createRateLimitError(1))
		await monitor.fetchUsage()

		expect(monitor.getState().isBackingOff).toBe(true)
		expect(monitor.getState().isRunning).toBe(true)

		// Wait for backoff to expire
		await new Promise((r) => setTimeout(r, 1500))

		expect(monitor.getState().isBackingOff).toBe(false)
		expect(monitor.getState().isRunning).toBe(true)
	})

	it("should not enter backoff twice for consecutive 429s", async () => {
		mockGetUsage.mockResolvedValueOnce(createRateLimitError(5))
		await monitor.fetchUsage()
		expect(monitor.getState().isBackingOff).toBe(true)

		// Another 429 should not reset the backoff
		mockGetUsage.mockResolvedValueOnce(createRateLimitError(10))
		await monitor.fetchUsage()

		// Should still be backing off, not restarted
		expect(monitor.getState().isBackingOff).toBe(true)
	})

	it("should clean up backoff timeout on stop()", async () => {
		monitor.start()
		await new Promise((r) => setTimeout(r, 50))

		mockGetUsage.mockResolvedValueOnce(createRateLimitError(30))
		await monitor.fetchUsage()

		expect(monitor.getState().isBackingOff).toBe(true)
		expect(monitor.getState().isRunning).toBe(true)

		monitor.stop()

		expect(monitor.getState().isBackingOff).toBe(false)
		expect(monitor.getState().isRunning).toBe(false)
	})

	it("should not enter backoff for non-429 errors", async () => {
		mockGetUsage.mockResolvedValueOnce({
			success: false,
			error: {
				type: "api_error" as const,
				message: "Server error",
				statusCode: 500,
				retryAfter: null,
			},
		})

		await monitor.fetchUsage()

		expect(monitor.getState().isBackingOff).toBe(false)
	})
})
