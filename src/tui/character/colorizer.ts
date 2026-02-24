import type { ColorLevel } from "../theme"
import { getCharacterPalette, resolveColor } from "../theme"
import type { CharacterState } from "./types"

export interface CharacterColorScheme {
	readonly body: string
	readonly eyes: string
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

export function colorizeLine(
	line: string,
	lineIndex: number,
	scheme: CharacterColorScheme,
	totalLines: number,
): string {
	if (!scheme.body && !scheme.eyes) return line

	if (isFaceLine(lineIndex, totalLines)) {
		return colorizeFaceLine(line, scheme)
	}
	return colorizeBodyLine(line, scheme)
}
