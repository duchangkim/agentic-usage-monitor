import { ANSI, type BoxStyle, getBoxChars } from "./styles"
import { getTheme } from "./theme"

export interface RenderOptions {
	width: number
	boxStyle: BoxStyle
	showBorder: boolean
	padding: number
}

const DEFAULT_OPTIONS: RenderOptions = {
	width: 40,
	boxStyle: "rounded",
	showBorder: true,
	padding: 1,
}

export function text(content: string, ...styles: string[]): string {
	if (styles.length === 0) return content
	const effective = styles.filter((s) => s.length > 0)
	if (effective.length === 0) return content
	return effective.join("") + content + ANSI.reset
}

export function pad(
	str: string,
	width: number,
	align: "left" | "right" | "center" = "left",
): string {
	const visibleLength = stripAnsi(str).length
	const diff = width - visibleLength
	if (diff <= 0) return str

	switch (align) {
		case "right":
			return " ".repeat(diff) + str
		case "center": {
			const left = Math.floor(diff / 2)
			const right = diff - left
			return " ".repeat(left) + str + " ".repeat(right)
		}
		default:
			return str + " ".repeat(diff)
	}
}

const ANSI_PATTERN = new RegExp(`${"\x1b"}\\[[0-9;]*m`, "g")

export function stripAnsi(str: string): string {
	return str.replace(ANSI_PATTERN, "")
}

export function truncate(str: string, maxLength: number, ellipsis = "…"): string {
	const visible = stripAnsi(str)
	if (visible.length <= maxLength) return str

	let visibleCount = 0
	let i = 0
	const targetLength = maxLength - ellipsis.length
	const ESC = "\x1b"

	while (i < str.length && visibleCount < targetLength) {
		if (str[i] === ESC) {
			const remaining = str.slice(i)
			const match = remaining.match(ANSI_PATTERN)
			if (match && remaining.indexOf(match[0]) === 0) {
				i += match[0].length
				continue
			}
		}
		visibleCount++
		i++
	}

	return str.slice(0, i) + ANSI.reset + ellipsis
}

export function horizontalLine(width: number, char = "─"): string {
	return char.repeat(width)
}

export function boxTop(width: number, title: string, opts: Partial<RenderOptions> = {}): string {
	const options = { ...DEFAULT_OPTIONS, ...opts }
	const box = getBoxChars(options.boxStyle)
	const innerWidth = width - 2

	if (title) {
		const titleText = ` ${title} `
		const titleLen = stripAnsi(titleText).length
		const leftLine = Math.floor((innerWidth - titleLen) / 2)
		const rightLine = innerWidth - titleLen - leftLine
		return (
			box.topLeft +
			horizontalLine(leftLine, box.horizontal) +
			text(titleText, getTheme().colors.box.title) +
			horizontalLine(rightLine, box.horizontal) +
			box.topRight
		)
	}

	return box.topLeft + horizontalLine(innerWidth, box.horizontal) + box.topRight
}

export function boxBottom(width: number, opts: Partial<RenderOptions> = {}): string {
	const options = { ...DEFAULT_OPTIONS, ...opts }
	const box = getBoxChars(options.boxStyle)
	return box.bottomLeft + horizontalLine(width - 2, box.horizontal) + box.bottomRight
}

export function boxRow(content: string, width: number, opts: Partial<RenderOptions> = {}): string {
	const options = { ...DEFAULT_OPTIONS, ...opts }
	const box = getBoxChars(options.boxStyle)
	const innerWidth = width - 2 - options.padding * 2
	const visibleLength = stripAnsi(content).length

	const safeContent = visibleLength > innerWidth ? truncate(content, innerWidth) : content
	const paddedContent =
		" ".repeat(options.padding) + pad(safeContent, innerWidth) + " ".repeat(options.padding)
	return box.vertical + paddedContent + box.vertical
}

export function boxDivider(width: number, opts: Partial<RenderOptions> = {}): string {
	const options = { ...DEFAULT_OPTIONS, ...opts }
	const box = getBoxChars(options.boxStyle)
	if (options.boxStyle === "rounded" || options.boxStyle === "single") {
		return `├${horizontalLine(width - 2, box.horizontal)}┤`
	}
	return box.vertical + horizontalLine(width - 2, box.horizontal) + box.vertical
}

export function renderBox(
	lines: string[],
	width: number,
	title = "",
	opts: Partial<RenderOptions> = {},
): string[] {
	const result: string[] = []
	result.push(boxTop(width, title, opts))
	for (const line of lines) {
		result.push(boxRow(line, width, opts))
	}
	result.push(boxBottom(width, opts))
	return result
}

export function clearScreen(): string {
	return "\x1b[2J\x1b[H"
}

export function moveCursor(row: number, col: number): string {
	return `\x1b[${row};${col}H`
}

export function hideCursor(): string {
	return "\x1b[?25l"
}

export function showCursor(): string {
	return "\x1b[?25h"
}
