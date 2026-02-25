import type { CharacterState } from "./types"

export interface ShimmerConfig {
	frameIntervalMs: number
	cycleMinMs: number
	cycleMaxMs: number
}

export interface ShimmerState {
	active: boolean
	position: { row: number; col: number } | null
	radius: number
}

const DEFAULT_CONFIG: ShimmerConfig = {
	frameIntervalMs: 150,
	cycleMinMs: 3000,
	cycleMaxMs: 5000,
}

const CRITICAL_CONFIG: Partial<ShimmerConfig> = {
	cycleMinMs: 1500,
	cycleMaxMs: 2500,
}

const GRID_ROWS = 4
const GRID_COLS = 11
const SHIMMER_RADIUS = 2

export class ShimmerAnimator {
	private callback: () => void
	private config: ShimmerConfig
	private _active = false
	private _position: { row: number; col: number } | null = null
	private sweepStep = 0
	private sweepTotal: number
	private sweepTimer: ReturnType<typeof setTimeout> | null = null
	private cycleTimer: ReturnType<typeof setTimeout> | null = null

	constructor(callback: () => void, config?: Partial<ShimmerConfig>) {
		this.callback = callback
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.sweepTotal = GRID_ROWS + GRID_COLS - 1
	}

	get state(): ShimmerState {
		return {
			active: this._active,
			position: this._position,
			radius: SHIMMER_RADIUS,
		}
	}

	start(): void {
		if (this._active) return
		this._active = true
		this.scheduleCycle()
	}

	stop(): void {
		this._active = false
		this._position = null
		if (this.sweepTimer) {
			clearTimeout(this.sweepTimer)
			this.sweepTimer = null
		}
		if (this.cycleTimer) {
			clearTimeout(this.cycleTimer)
			this.cycleTimer = null
		}
	}

	updateForState(state: CharacterState): void {
		if (state === "critical" || state === "rateLimit") {
			this.config = {
				...DEFAULT_CONFIG,
				...CRITICAL_CONFIG,
			}
		} else {
			this.config = { ...DEFAULT_CONFIG }
		}
	}

	private scheduleCycle(): void {
		if (!this._active) return
		const delay =
			this.config.cycleMinMs + Math.random() * (this.config.cycleMaxMs - this.config.cycleMinMs)
		this.cycleTimer = setTimeout(() => {
			if (!this._active) return
			this.startSweep()
		}, delay)
	}

	private startSweep(): void {
		this.sweepStep = 0
		this.advanceSweep()
	}

	private advanceSweep(): void {
		if (!this._active) return
		if (this.sweepStep >= this.sweepTotal) {
			this._position = null
			this.callback()
			this.scheduleCycle()
			return
		}
		// Diagonal sweep: top-right → bottom-left
		// step k: cells where (row + (GRID_COLS - 1 - col)) === k
		const k = this.sweepStep
		const col = Math.max(0, GRID_COLS - 1 - k)
		const row = Math.max(0, k - (GRID_COLS - 1))
		this._position = { row, col }
		this.sweepStep++
		this.callback()
		this.sweepTimer = setTimeout(() => this.advanceSweep(), this.config.frameIntervalMs)
	}
}

export function getShimmerIntensity(row: number, col: number, shimmer: ShimmerState): number {
	if (!shimmer.active || !shimmer.position) return 0
	const dr = Math.abs(row - shimmer.position.row)
	const dc = Math.abs(col - shimmer.position.col)
	const dist = Math.max(dr, dc)
	if (dist > shimmer.radius) return 0
	return 1 - dist / (shimmer.radius + 1)
}
