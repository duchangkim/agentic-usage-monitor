import type { CharacterPreset } from "../types"
import { robotPreset } from "./robot"

const CHARACTER_PRESETS: Record<string, CharacterPreset> = {
	robot: robotPreset,
}

export function getCharacterPreset(name: string): CharacterPreset | undefined {
	return CHARACTER_PRESETS[name]
}

export function getCharacterPresetNames(): string[] {
	return Object.keys(CHARACTER_PRESETS)
}
