import type { AnimationTiming, CharacterPreset, CharacterState } from "./types"

export interface CharacterAnimatorOptions {
	minIntervalMs?: number
	maxIntervalMs?: number
	language?: string
}

const DEFAULT_MIN_INTERVAL = 3000
const DEFAULT_MAX_INTERVAL = 5000
const DEFAULT_SPEECH_MIN_INTERVAL = 45000
const DEFAULT_SPEECH_MAX_INTERVAL = 75000

export class CharacterAnimator {
	private preset: CharacterPreset
	private callback: (frameIndex: number) => void
	private minInterval: number
	private maxInterval: number
	private hasExplicitTiming: boolean

	private _state: CharacterState = "relaxed"
	private _currentFrame = 0
	private _currentMessage = ""
	private _language: string
	private timer: ReturnType<typeof setTimeout> | null = null
	private speechTimer: ReturnType<typeof setTimeout> | null = null
	private running = false

	constructor(
		preset: CharacterPreset,
		callback: (frameIndex: number) => void,
		options?: CharacterAnimatorOptions,
	) {
		this.preset = preset
		this.callback = callback
		this.hasExplicitTiming =
			options?.minIntervalMs !== undefined || options?.maxIntervalMs !== undefined
		this.minInterval = options?.minIntervalMs ?? DEFAULT_MIN_INTERVAL
		this.maxInterval = options?.maxIntervalMs ?? DEFAULT_MAX_INTERVAL
		this._language = options?.language ?? "en"
	}

	get currentFrame(): number {
		return this._currentFrame
	}

	get state(): CharacterState {
		return this._state
	}

	get currentMessage(): string {
		return this._currentMessage
	}

	setState(state: CharacterState): void {
		if (this._state === state) return
		this._state = state
		this._currentFrame = 0
		this._currentMessage = this.pickMessage()
		if (this.running) {
			this.rescheduleAnimation()
		}
	}

	start(): void {
		if (this.running) return
		this.running = true
		this._currentMessage = this.pickMessage()
		this.scheduleNext()
		this.scheduleSpeech()
	}

	stop(): void {
		this.running = false
		if (this.timer) {
			clearTimeout(this.timer)
			this.timer = null
		}
		if (this.speechTimer) {
			clearTimeout(this.speechTimer)
			this.speechTimer = null
		}
	}

	updatePreset(preset: CharacterPreset): void {
		this.preset = preset
		this._currentFrame = 0
	}

	private getTimingForCurrentState(): AnimationTiming {
		// Explicit constructor options override everything (used in tests)
		if (this.hasExplicitTiming) {
			return { minIntervalMs: this.minInterval, maxIntervalMs: this.maxInterval }
		}
		const stateTiming = this.preset.states[this._state].timing
		if (stateTiming) return stateTiming
		if (this.preset.defaultTiming) return this.preset.defaultTiming
		return { minIntervalMs: this.minInterval, maxIntervalMs: this.maxInterval }
	}

	private rescheduleAnimation(): void {
		if (this.timer) {
			clearTimeout(this.timer)
			this.timer = null
		}
		this.scheduleNext()
	}

	private getDelayForCurrentFrame(): number {
		const stateAnim = this.preset.states[this._state]
		const frameDuration = stateAnim.frameDurations?.[this._currentFrame]
		if (frameDuration != null) return frameDuration
		const timing = this.getTimingForCurrentState()
		return timing.minIntervalMs + Math.random() * (timing.maxIntervalMs - timing.minIntervalMs)
	}

	private scheduleNext(): void {
		if (!this.running) return
		const delay = this.getDelayForCurrentFrame()
		this.timer = setTimeout(() => {
			if (!this.running) return
			this.advanceFrame()
			this.scheduleNext()
		}, delay)
	}

	private advanceFrame(): void {
		const frameCount = this.preset.states[this._state].frames.length
		this._currentFrame = (this._currentFrame + 1) % frameCount
		this.callback(this._currentFrame)
	}

	private pickMessage(): string {
		const langBubbles = this.preset.speechBubbles[this._language]
		const enBubbles = this.preset.speechBubbles.en
		const messages = langBubbles?.[this._state] ?? enBubbles?.[this._state]
		if (!messages || messages.length === 0) return ""
		return messages[Math.floor(Math.random() * messages.length)] ?? ""
	}

	private scheduleSpeech(): void {
		if (!this.running) return
		const speechTiming = this.preset.speechTiming
		const minMs = speechTiming?.minIntervalMs ?? DEFAULT_SPEECH_MIN_INTERVAL
		const maxMs = speechTiming?.maxIntervalMs ?? DEFAULT_SPEECH_MAX_INTERVAL
		const delay = minMs + Math.random() * (maxMs - minMs)
		this.speechTimer = setTimeout(() => {
			if (!this.running) return
			this._currentMessage = this.pickMessage()
			this.callback(this._currentFrame)
			this.scheduleSpeech()
		}, delay)
	}
}
