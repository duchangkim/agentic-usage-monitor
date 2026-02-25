import type { CharacterPalette, ColorDef } from "../theme"

export interface MetallicTones {
	shadow: ColorDef
	base: ColorDef
	highlight: ColorDef
	specular: ColorDef
}

export type LuminanceTier = "shadow" | "base" | "highlight" | "specular"

// Light source: top-left (↘ direction)
// biome-ignore format: luminance map grid
export const ROBOT_LUMINANCE_MAP: LuminanceTier[][] = [
	["base", "base", "highlight", "highlight", "specular", "highlight", "highlight", "base", "base", "base", "base"],
	["base", "highlight", "highlight", "base", "base", "base", "base", "base", "base", "shadow", "base"],
	["base", "highlight", "base", "base", "base", "base", "base", "base", "shadow", "shadow", "base"],
	["base", "base", "base", "base", "base", "base", "base", "shadow", "shadow", "base", "base"],
]

// biome-ignore format: luminance map grid
export const ROBOT_MINI_LUMINANCE_MAP: LuminanceTier[][] = [
	["base", "base", "highlight", "highlight", "specular", "highlight", "highlight", "base", "base", "base", "base"],
	["base", "highlight", "highlight", "base", "base", "base", "base", "base", "base", "shadow", "base"],
]

const LUMINANCE_MAPS: Record<string, { full: LuminanceTier[][]; mini: LuminanceTier[][] }> = {
	robot: { full: ROBOT_LUMINANCE_MAP, mini: ROBOT_MINI_LUMINANCE_MAP },
}

function clampRgb(value: number): number {
	return Math.max(0, Math.min(255, Math.floor(value)))
}

function deriveSpecular(base: ColorDef): ColorDef {
	const [r, g, b] = base.rgb
	// Lighten first (same as highlight), then desaturate toward white
	const lr = r + (255 - r) * 0.4
	const lg = g + (255 - g) * 0.4
	const lb = b + (255 - b) * 0.4
	// Blend toward white for specular glint
	const whiteBlend = 0.5
	const sr = clampRgb(lr + (255 - lr) * whiteBlend)
	const sg = clampRgb(lg + (255 - lg) * whiteBlend)
	const sb = clampRgb(lb + (255 - lb) * whiteBlend)
	return { rgb: [sr, sg, sb], ansi: "\x1b[1m\x1b[37m" }
}

export function deriveMetallicTones(base: ColorDef): MetallicTones {
	const [r, g, b] = base.rgb

	const shadow: ColorDef = {
		rgb: [clampRgb(r * 0.5), clampRgb(g * 0.5), clampRgb(b * 0.5)],
		ansi: `\x1b[2m${base.ansi}`,
	}

	const highlight: ColorDef = {
		rgb: [
			clampRgb(r + (255 - r) * 0.4),
			clampRgb(g + (255 - g) * 0.4),
			clampRgb(b + (255 - b) * 0.4),
		],
		ansi: `\x1b[1m${base.ansi}`,
	}

	return {
		shadow,
		base,
		highlight,
		specular: deriveSpecular(base),
	}
}

export function getLuminanceMap(presetName: string, mini?: boolean): LuminanceTier[][] | undefined {
	const entry = LUMINANCE_MAPS[presetName]
	if (!entry) return undefined
	return mini ? entry.mini : entry.full
}

export function buildMetallicPalette(palette: CharacterPalette): Record<string, MetallicTones> {
	const result: Record<string, MetallicTones> = {}
	for (const key of Object.keys(palette)) {
		result[key] = deriveMetallicTones(palette[key as keyof CharacterPalette])
	}
	return result
}
