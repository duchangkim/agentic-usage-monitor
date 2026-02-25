export type {
	CharacterState,
	CharacterFrame,
	CharacterStateAnimation,
	AnimationTiming,
	SpeechTiming,
	SpeechMessages,
	CharacterPreset,
	CharacterRenderResult,
} from "./types"

export {
	getCharacterColors,
	type CharacterColorScheme,
	type MetallicColorScheme,
} from "./colorizer"
export { deriveCharacterState } from "./state"
export { renderCharacter, getCharacterHeight, renderMiniCharacter } from "./renderer"
export { CharacterAnimator, type CharacterAnimatorOptions } from "./animation"
export { getCharacterPreset, getCharacterPresetNames } from "./presets"
export { ShimmerAnimator, type ShimmerState, type ShimmerConfig } from "./shimmer"
export type { MetallicTones, LuminanceTier } from "./metallic"
