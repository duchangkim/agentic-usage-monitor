export type WidgetPosition = "top" | "bottom" | "left" | "right" | "floating"

export interface TerminalSize {
	rows: number
	cols: number
}

export interface WidgetLayout {
	row: number
	col: number
	width: number
	height: number
}

export function getTerminalSize(): TerminalSize {
	return {
		rows: process.stdout.rows || 24,
		cols: process.stdout.columns || 80,
	}
}

export function calculateLayout(
	position: WidgetPosition,
	widgetWidth: number,
	widgetHeight: number,
	terminal: TerminalSize = getTerminalSize(),
): WidgetLayout {
	switch (position) {
		case "top":
			return {
				row: 1,
				col: Math.floor((terminal.cols - widgetWidth) / 2) + 1,
				width: widgetWidth,
				height: widgetHeight,
			}

		case "bottom":
			return {
				row: terminal.rows - widgetHeight,
				col: Math.floor((terminal.cols - widgetWidth) / 2) + 1,
				width: widgetWidth,
				height: widgetHeight,
			}

		case "left":
			return {
				row: Math.floor((terminal.rows - widgetHeight) / 2) + 1,
				col: 1,
				width: widgetWidth,
				height: widgetHeight,
			}

		case "right":
			return {
				row: Math.floor((terminal.rows - widgetHeight) / 2) + 1,
				col: terminal.cols - widgetWidth + 1,
				width: widgetWidth,
				height: widgetHeight,
			}

		case "floating":
			return {
				row: Math.floor((terminal.rows - widgetHeight) / 2) + 1,
				col: Math.floor((terminal.cols - widgetWidth) / 2) + 1,
				width: widgetWidth,
				height: widgetHeight,
			}
	}
}
