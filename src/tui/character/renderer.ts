import { getColorLevel } from "../theme"
import { colorizeLine, getCharacterColors, getMetallicCharacterColors } from "./colorizer"
import { getLuminanceMap } from "./metallic"
import type { ShimmerState } from "./shimmer"
import type { CharacterPreset, CharacterRenderResult, CharacterState } from "./types"

const SPEECH_BUBBLE_LINES = 3

function centerPad(str: string, width: number): string {
	const len = str.length
	if (len >= width) return str.slice(0, width)
	const left = Math.floor((width - len) / 2)
	const right = width - len - left
	return " ".repeat(left) + str + " ".repeat(right)
}

function pickMessage(preset: CharacterPreset, state: CharacterState, language: string): string {
	const langBubbles = preset.speechBubbles[language]
	const enBubbles = preset.speechBubbles.en
	const messages = langBubbles?.[state] ?? enBubbles?.[state]
	if (!messages || messages.length === 0) return ""
	return messages[Math.floor(Math.random() * messages.length)] ?? ""
}

function renderSpeechBubble(message: string, availableWidth: number): string[] {
	const maxMsgWidth = availableWidth - 4
	const truncated = message.length > maxMsgWidth ? `${message.slice(0, maxMsgWidth - 1)}…` : message
	const innerWidth = truncated.length + 2
	const top = centerPad(`┌${"─".repeat(innerWidth)}┐`, availableWidth)
	const mid = centerPad(`│ ${truncated} │`, availableWidth)
	const bot = centerPad(`└─┬${"─".repeat(Math.max(0, innerWidth - 2))}┘`, availableWidth)
	return [top, mid, bot]
}

export function renderCharacter(
	preset: CharacterPreset,
	state: CharacterState,
	frameIndex: number,
	availableWidth: number,
	language: string,
	showSpeechBubble: boolean,
	message?: string,
	shimmer?: ShimmerState | null,
): CharacterRenderResult {
	const stateAnim = preset.states[state]
	const safeIndex = frameIndex % stateAnim.frames.length
	const frame = stateAnim.frames[safeIndex] ?? stateAnim.frames[0]

	const lines: string[] = []

	if (showSpeechBubble) {
		const msg = message ?? pickMessage(preset, state, language)
		const bubbleLines = renderSpeechBubble(msg, availableWidth)
		lines.push(...bubbleLines)
	}

	const colorLevel = getColorLevel()
	const scheme = getCharacterColors(state, colorLevel)
	const metallicScheme = getMetallicCharacterColors(state, colorLevel)
	const luminanceMap = metallicScheme ? getLuminanceMap(preset.name) : undefined
	const shimmerState = shimmer ?? undefined

	const frameLines = frame ?? []
	for (let i = 0; i < frameLines.length; i++) {
		const padded = centerPad(frameLines[i] ?? "", availableWidth)
		lines.push(
			colorizeLine(
				padded,
				i,
				scheme,
				frameLines.length,
				metallicScheme,
				luminanceMap,
				shimmerState,
				colorLevel,
			),
		)
	}

	return {
		lines,
		totalHeight: lines.length,
		width: availableWidth,
	}
}

export function getCharacterHeight(preset: CharacterPreset, showSpeechBubble: boolean): number {
	return preset.height + (showSpeechBubble ? SPEECH_BUBBLE_LINES : 0)
}

export function renderMiniCharacter(
	preset: CharacterPreset,
	state: CharacterState,
	shimmer?: ShimmerState | null,
): string[] | null {
	if (!preset.miniStates) return null
	const miniFrame = preset.miniStates[state]
	const colorLevel = getColorLevel()
	const scheme = getCharacterColors(state, colorLevel)
	const metallicScheme = getMetallicCharacterColors(state, colorLevel)
	const luminanceMap = metallicScheme ? getLuminanceMap(preset.name, true) : undefined
	const shimmerState = shimmer ?? undefined

	return miniFrame.map((line, i) =>
		colorizeLine(
			line,
			i,
			scheme,
			miniFrame.length,
			metallicScheme,
			luminanceMap,
			shimmerState,
			colorLevel,
		),
	)
}
