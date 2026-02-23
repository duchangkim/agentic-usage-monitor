export type CharacterState = "relaxed" | "normal" | "concerned" | "critical" | "rateLimit" | "error"

export type CharacterFrame = readonly string[]

export interface AnimationTiming {
	readonly minIntervalMs: number
	readonly maxIntervalMs: number
}

export interface SpeechTiming {
	readonly minIntervalMs: number
	readonly maxIntervalMs: number
}

export interface CharacterStateAnimation {
	readonly frames: readonly CharacterFrame[]
	readonly timing?: AnimationTiming
	/** Per-frame duration override in ms. null/undefined = use state timing. */
	readonly frameDurations?: readonly (number | null)[]
}

export type SpeechMessages = Readonly<Record<CharacterState, readonly string[]>>

export interface CharacterPreset {
	readonly name: string
	readonly width: number
	readonly height: number
	readonly states: Readonly<Record<CharacterState, CharacterStateAnimation>>
	readonly speechBubbles: Readonly<Record<string, SpeechMessages>>
	readonly miniStates?: Readonly<Record<CharacterState, CharacterFrame>>
	readonly defaultTiming?: AnimationTiming
	readonly speechTiming?: SpeechTiming
}

export interface CharacterRenderResult {
	readonly lines: string[]
	readonly totalHeight: number
	readonly width: number
}
