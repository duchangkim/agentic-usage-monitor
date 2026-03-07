import type { ResolvedConfig } from "../config"
import {
	type ClaudeOAuthApi,
	type ProfileData,
	type UsageData,
	createOAuthApi,
} from "../data/oauth-api"
import type { CredentialSource } from "../data/oauth-credentials"

export interface RateLimitState {
	fiveHour: {
		utilization: number
		resetsAt: Date
	} | null
	sevenDay: {
		utilization: number
		resetsAt: Date
	} | null
	sevenDayOpus: {
		utilization: number
		resetsAt: Date
	} | null
}

export interface OAuthMonitorState {
	isRunning: boolean
	isBackingOff: boolean
	lastFetch: Date | null
	lastError: string | null
	rateLimits: RateLimitState | null
	profile: ProfileData | null
}

export type OAuthMonitorEventType = "update" | "error" | "start" | "stop" | "resume"

export interface OAuthMonitorEvent {
	type: OAuthMonitorEventType
	state: OAuthMonitorState
	timestamp: Date
}

type OAuthMonitorListener = (event: OAuthMonitorEvent) => void

const DEFAULT_BACKOFF_SECONDS = 60

export class OAuthMonitor {
	private config: ResolvedConfig
	private api: ClaudeOAuthApi
	private intervalId: ReturnType<typeof setInterval> | null = null
	private backoffTimeoutId: ReturnType<typeof setTimeout> | null = null
	private listeners: Set<OAuthMonitorListener> = new Set()
	private state: OAuthMonitorState = {
		isRunning: false,
		isBackingOff: false,
		lastFetch: null,
		lastError: null,
		rateLimits: null,
		profile: null,
	}

	constructor(config: ResolvedConfig, credentialSource?: CredentialSource) {
		this.config = config
		this.api = createOAuthApi(undefined, credentialSource)
	}

	getState(): OAuthMonitorState {
		return { ...this.state }
	}

	on(listener: OAuthMonitorListener): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	private emit(type: OAuthMonitorEventType): void {
		const event: OAuthMonitorEvent = {
			type,
			state: this.getState(),
			timestamp: new Date(),
		}
		for (const listener of this.listeners) {
			listener(event)
		}
	}

	async fetchUsage(): Promise<UsageData | null> {
		const result = await this.api.getUsage()

		if (!result.success) {
			this.state.lastError = result.error.message
			this.state.lastFetch = new Date()
			this.emit("error")
			if (result.error.statusCode === 429) {
				this.enterBackoff(result.error.retryAfter)
			}
			return null
		}

		this.state.rateLimits = {
			fiveHour: result.data.fiveHour
				? {
						utilization: result.data.fiveHour.utilization,
						resetsAt: result.data.fiveHour.resetsAt,
					}
				: null,
			sevenDay: result.data.sevenDay
				? {
						utilization: result.data.sevenDay.utilization,
						resetsAt: result.data.sevenDay.resetsAt,
					}
				: null,
			sevenDayOpus: result.data.sevenDayOpus
				? {
						utilization: result.data.sevenDayOpus.utilization,
						resetsAt: result.data.sevenDayOpus.resetsAt,
					}
				: null,
		}
		this.state.lastFetch = new Date()
		this.state.lastError = null
		this.emit("update")

		return result.data
	}

	async fetchProfile(): Promise<ProfileData | null> {
		const result = await this.api.getProfile()

		if (!result.success) {
			this.state.lastError = result.error.message
			this.emit("error")
			return null
		}

		this.state.profile = result.data
		return result.data
	}

	async fetch(): Promise<{ usage: UsageData | null; profile: ProfileData | null }> {
		const [usage, profile] = await Promise.all([
			this.fetchUsage(),
			this.config.oauth.showProfile ? this.fetchProfile() : Promise.resolve(this.state.profile),
		])

		return { usage, profile }
	}

	private enterBackoff(retryAfter: number | null): void {
		if (this.state.isBackingOff) return

		const backoffSeconds = retryAfter && retryAfter > 0 ? retryAfter : DEFAULT_BACKOFF_SECONDS
		this.state.isBackingOff = true

		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}

		this.backoffTimeoutId = setTimeout(() => {
			this.resumeAfterBackoff()
		}, backoffSeconds * 1000)
	}

	private resumeAfterBackoff(): void {
		this.backoffTimeoutId = null
		this.state.isBackingOff = false
		this.api.clearCredentials()

		this.fetchUsage()

		if (this.state.isRunning) {
			const intervalMs = this.config.display.refreshInterval * 1000
			this.intervalId = setInterval(() => {
				this.fetchUsage()
			}, intervalMs)
		}

		this.emit("resume")
	}

	setPollingInterval(intervalSeconds: number): void {
		if (!this.state.isRunning || this.state.isBackingOff) return

		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}

		const intervalMs = intervalSeconds * 1000
		this.intervalId = setInterval(() => {
			this.fetchUsage()
		}, intervalMs)
	}

	start(): void {
		if (this.state.isRunning) return
		if (!this.config.oauth.enabled) return

		this.state.isRunning = true
		this.emit("start")

		this.fetch()

		const intervalMs = this.config.display.refreshInterval * 1000
		this.intervalId = setInterval(() => {
			this.fetchUsage()
		}, intervalMs)
	}

	stop(): void {
		if (!this.state.isRunning) return

		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}

		if (this.backoffTimeoutId) {
			clearTimeout(this.backoffTimeoutId)
			this.backoffTimeoutId = null
		}

		this.state.isBackingOff = false
		this.state.isRunning = false
		this.emit("stop")
	}

	updateConfig(config: ResolvedConfig): void {
		const wasRunning = this.state.isRunning
		const intervalChanged = this.config.display.refreshInterval !== config.display.refreshInterval
		const enabledChanged = this.config.oauth.enabled !== config.oauth.enabled

		this.config = config

		if (enabledChanged && !config.oauth.enabled && wasRunning) {
			this.stop()
		} else if (enabledChanged && config.oauth.enabled && !wasRunning) {
			this.start()
		} else if (wasRunning && intervalChanged) {
			this.stop()
			this.start()
		}
	}
}

export function createOAuthMonitor(
	config: ResolvedConfig,
	credentialSource?: CredentialSource,
): OAuthMonitor {
	return new OAuthMonitor(config, credentialSource)
}
