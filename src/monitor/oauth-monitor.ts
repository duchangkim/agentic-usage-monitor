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
	lastFetch: Date | null
	lastError: string | null
	rateLimits: RateLimitState | null
	profile: ProfileData | null
}

export type OAuthMonitorEventType = "update" | "error" | "start" | "stop"

export interface OAuthMonitorEvent {
	type: OAuthMonitorEventType
	state: OAuthMonitorState
	timestamp: Date
}

type OAuthMonitorListener = (event: OAuthMonitorEvent) => void

export class OAuthMonitor {
	private config: ResolvedConfig
	private api: ClaudeOAuthApi
	private intervalId: ReturnType<typeof setInterval> | null = null
	private listeners: Set<OAuthMonitorListener> = new Set()
	private state: OAuthMonitorState = {
		isRunning: false,
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
