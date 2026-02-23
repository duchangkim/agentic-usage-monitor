import type { CharacterPreset, CharacterState } from "./types"

export interface CharacterAnimatorOptions {
	minIntervalMs?: number
	maxIntervalMs?: number
}

const DEFAULT_MIN_INTERVAL = 3000
const DEFAULT_MAX_INTERVAL = 5000

export class CharacterAnimator {
	private preset: CharacterPreset
	private callback: (frameIndex: number) => void
	private minInterval: number
	private maxInterval: number

	private _state: CharacterState = "relaxed"
	private _currentFrame = 0
	private timer: ReturnType<typeof setTimeout> | null = null
	private running = false

	constructor(
		preset: CharacterPreset,
		callback: (frameIndex: number) => void,
		options?: CharacterAnimatorOptions,
	) {
		this.preset = preset
		this.callback = callback
		this.minInterval = options?.minIntervalMs ?? DEFAULT_MIN_INTERVAL
		this.maxInterval = options?.maxIntervalMs ?? DEFAULT_MAX_INTERVAL
	}

	get currentFrame(): number {
		return this._currentFrame
	}

	get state(): CharacterState {
		return this._state
	}

	setState(state: CharacterState): void {
		if (this._state === state) return
		this._state = state
		this._currentFrame = 0
	}

	start(): void {
		if (this.running) return
		this.running = true
		this.scheduleNext()
	}

	stop(): void {
		this.running = false
		if (this.timer) {
			clearTimeout(this.timer)
			this.timer = null
		}
	}

	updatePreset(preset: CharacterPreset): void {
		this.preset = preset
		this._currentFrame = 0
	}

	private scheduleNext(): void {
		if (!this.running) return
		const delay = this.minInterval + Math.random() * (this.maxInterval - this.minInterval)
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
}
