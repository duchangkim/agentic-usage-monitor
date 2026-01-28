export const ANSI = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",

	fg: {
		black: "\x1b[30m",
		red: "\x1b[31m",
		green: "\x1b[32m",
		yellow: "\x1b[33m",
		blue: "\x1b[34m",
		magenta: "\x1b[35m",
		cyan: "\x1b[36m",
		white: "\x1b[37m",
		gray: "\x1b[90m",
	},

	bg: {
		black: "\x1b[40m",
		red: "\x1b[41m",
		green: "\x1b[42m",
		yellow: "\x1b[43m",
		blue: "\x1b[44m",
		magenta: "\x1b[45m",
		cyan: "\x1b[46m",
		white: "\x1b[47m",
	},
} as const

export const BOX = {
	topLeft: "┌",
	topRight: "┐",
	bottomLeft: "└",
	bottomRight: "┘",
	horizontal: "─",
	vertical: "│",
	teeRight: "├",
	teeLeft: "┤",
	cross: "┼",
} as const

export const BOX_DOUBLE = {
	topLeft: "╔",
	topRight: "╗",
	bottomLeft: "╚",
	bottomRight: "╝",
	horizontal: "═",
	vertical: "║",
} as const

export const BOX_ROUNDED = {
	topLeft: "╭",
	topRight: "╮",
	bottomLeft: "╰",
	bottomRight: "╯",
	horizontal: "─",
	vertical: "│",
} as const

export const ICONS = {
	anthropic: "◆",
	openai: "●",
	google: "▲",
	openrouter: "◈",
	tokens: "⚡",
	cost: "$",
	check: "✓",
	cross: "✗",
	arrow: "→",
	bullet: "•",
} as const

export type BoxStyle = "single" | "double" | "rounded"

export function getBoxChars(style: BoxStyle) {
	switch (style) {
		case "double":
			return BOX_DOUBLE
		case "rounded":
			return BOX_ROUNDED
		default:
			return BOX
	}
}
