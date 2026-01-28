import { ANSI, type BoxStyle, getBoxChars } from "./styles"

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
	return styles.join("") + content + ANSI.reset
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
	return str.slice(0, maxLength - ellipsis.length) + ellipsis
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
			text(titleText, ANSI.bold) +
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
	const paddedContent =
		" ".repeat(options.padding) + pad(content, innerWidth) + " ".repeat(options.padding)
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
