export type CharacterState = "relaxed" | "normal" | "concerned" | "critical" | "rateLimit" | "error"

export type CharacterFrame = readonly string[]

export interface CharacterStateAnimation {
	readonly frames: readonly CharacterFrame[]
}

export type SpeechMessages = Readonly<Record<CharacterState, readonly string[]>>

export interface CharacterPreset {
	readonly name: string
	readonly width: number
	readonly height: number
	readonly states: Readonly<Record<CharacterState, CharacterStateAnimation>>
	readonly speechBubbles: Readonly<Record<string, SpeechMessages>>
	readonly miniStates?: Readonly<Record<CharacterState, CharacterFrame>>
}

export interface CharacterRenderResult {
	readonly lines: string[]
	readonly totalHeight: number
	readonly width: number
}
