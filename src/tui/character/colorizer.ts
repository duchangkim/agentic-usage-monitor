import type { ColorLevel } from "../theme"
import { getCharacterPalette, resolveColor } from "../theme"
import { type MetallicTones, deriveMetallicTones } from "./metallic"
import type { LuminanceTier } from "./metallic"
import { getShimmerIntensity } from "./shimmer"
import type { ShimmerState } from "./shimmer"
import type { CharacterState } from "./types"

export interface CharacterColorScheme {
	readonly body: string
	readonly eyes: string
	readonly reset: string
}

export interface MetallicColorScheme {
	readonly tones: MetallicTones
	readonly eyesTones: MetallicTones
	readonly reset: string
}

// biome-ignore format: compact set of block drawing characters
const BLOCK_CHARS = new Set(["▗", "▟", "█", "▙", "▖", "▐", "▌", "▄", "▀", "▝", "▜", "▛", "▘"])

const STATE_COLOR_MAP: Record<
	CharacterState,
	{
		body: keyof ReturnType<typeof getCharacterPalette>
		eyes: keyof ReturnType<typeof getCharacterPalette>
	}
> = {
	relaxed: { body: "green", eyes: "white" },
	normal: { body: "cyan", eyes: "white" },
	concerned: { body: "yellow", eyes: "white" },
	critical: { body: "red", eyes: "yellow" },
	rateLimit: { body: "magenta", eyes: "gray" },
	error: { body: "gray", eyes: "white" },
}

export function getCharacterColors(
	state: CharacterState,
	colorLevel: ColorLevel,
): CharacterColorScheme {
	if (colorLevel === "none") {
		return { body: "", eyes: "", reset: "" }
	}

	const palette = getCharacterPalette()
	const mapping = STATE_COLOR_MAP[state]

	return {
		body: resolveColor(palette[mapping.body], "fg", colorLevel),
		eyes: resolveColor(palette[mapping.eyes], "fg", colorLevel),
		reset: "\x1b[0m",
	}
}

export function getMetallicCharacterColors(
	state: CharacterState,
	colorLevel: ColorLevel,
): MetallicColorScheme | null {
	if (colorLevel !== "truecolor") return null

	const palette = getCharacterPalette()
	const mapping = STATE_COLOR_MAP[state]

	return {
		tones: deriveMetallicTones(palette[mapping.body]),
		eyesTones: deriveMetallicTones(palette[mapping.eyes]),
		reset: "\x1b[0m",
	}
}

function charColor(ch: string, scheme: CharacterColorScheme): string {
	if (ch === " ") return ""
	if (BLOCK_CHARS.has(ch)) return scheme.body
	return scheme.eyes
}

function colorizeFaceLine(line: string, scheme: CharacterColorScheme): string {
	let result = ""
	let currentColor = ""

	for (const ch of line) {
		const target = charColor(ch, scheme)
		if (target !== currentColor) {
			if (currentColor) result += scheme.reset
			result += target
			currentColor = target
		}
		result += ch
	}

	if (currentColor) result += scheme.reset
	return result
}

function colorizeBodyLine(line: string, scheme: CharacterColorScheme): string {
	let result = ""
	let inColor = false

	for (const ch of line) {
		if (ch === " ") {
			if (inColor) {
				result += scheme.reset
				inColor = false
			}
			result += ch
		} else {
			if (!inColor) {
				result += scheme.body
				inColor = true
			}
			result += ch
		}
	}

	if (inColor) result += scheme.reset
	return result
}

function isFaceLine(lineIndex: number, totalLines: number): boolean {
	if (totalLines >= 2) return lineIndex === 1
	return false
}

function findContentBounds(line: string): { start: number; end: number } {
	let start = 0
	while (start < line.length && line[start] === " ") start++
	let end = line.length - 1
	while (end >= start && line[end] === " ") end--
	return { start, end: end + 1 }
}

function resolveTier(
	lineIndex: number,
	colIndex: number,
	contentStart: number,
	luminanceMap: LuminanceTier[][],
	shimmer: ShimmerState,
): LuminanceTier {
	const mapRow = luminanceMap[lineIndex]
	if (!mapRow) return "base"
	const mapCols = mapRow.length
	const contentCol = colIndex - contentStart
	if (contentCol < 0 || contentCol >= mapCols) return "base"
	const intensity = getShimmerIntensity(lineIndex, contentCol, shimmer)
	if (intensity > 0) return "specular"
	return mapRow[contentCol] ?? "base"
}

function resolveMetallicColor(
	ch: string,
	tier: LuminanceTier,
	scheme: MetallicColorScheme,
	colorLevel: ColorLevel,
): string {
	if (ch === " ") return ""
	const tones = BLOCK_CHARS.has(ch) ? scheme.tones : scheme.eyesTones
	return resolveColor(tones[tier], "fg", colorLevel)
}

export function colorizeLineMetallic(
	line: string,
	lineIndex: number,
	scheme: MetallicColorScheme,
	_totalLines: number,
	luminanceMap: LuminanceTier[][],
	shimmer: ShimmerState,
	colorLevel: ColorLevel,
): string {
	const { start: contentStart } = findContentBounds(line)
	let result = ""
	let currentColor = ""
	let colIndex = 0

	for (const ch of line) {
		const tier = resolveTier(lineIndex, colIndex, contentStart, luminanceMap, shimmer)
		const target = resolveMetallicColor(ch, tier, scheme, colorLevel)

		if (target !== currentColor) {
			if (currentColor) result += scheme.reset
			result += target
			currentColor = target
		}
		result += ch
		colIndex++
	}

	if (currentColor) result += scheme.reset
	return result
}

export function colorizeLine(
	line: string,
	lineIndex: number,
	scheme: CharacterColorScheme,
	totalLines: number,
	metallicScheme?: MetallicColorScheme | null,
	luminanceMap?: LuminanceTier[][],
	shimmer?: ShimmerState,
	colorLevel?: ColorLevel,
): string {
	if (metallicScheme && luminanceMap && shimmer && colorLevel) {
		return colorizeLineMetallic(
			line,
			lineIndex,
			metallicScheme,
			totalLines,
			luminanceMap,
			shimmer,
			colorLevel,
		)
	}

	if (!scheme.body && !scheme.eyes) return line

	if (isFaceLine(lineIndex, totalLines)) {
		return colorizeFaceLine(line, scheme)
	}
	return colorizeBodyLine(line, scheme)
}
