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

export { getCharacterColors, type CharacterColorScheme } from "./colorizer"
export { deriveCharacterState } from "./state"
export { renderCharacter, getCharacterHeight, renderMiniCharacter } from "./renderer"
export { CharacterAnimator, type CharacterAnimatorOptions } from "./animation"
export { getCharacterPreset, getCharacterPresetNames } from "./presets"
