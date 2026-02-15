// ---- Types ----

export type ColorLevel = "truecolor" | "basic" | "none"

export interface ColorDef {
	readonly rgb: readonly [number, number, number]
	readonly ansi: string
}

export interface ThemeColors {
	readonly fg: {
		readonly accent: string
		readonly default: string
		readonly subtle: string
		readonly muted: string
	}
	readonly status: {
		readonly success: string
		readonly warning: string
		readonly danger: string
		readonly info: string
	}
	readonly progress: {
		readonly low: string
		readonly medium: string
		readonly high: string
		readonly critical: string
		readonly empty: string
	}
	readonly badge: {
		readonly pro: string
		readonly max: string
		readonly ent: string
	}
	readonly box: {
		readonly border: string
		readonly title: string
	}
}

export interface Theme {
	readonly name: string
	readonly colors: ThemeColors
}

// ---- Primitives ----

const PRIMITIVES = {
	white: { rgb: [255, 255, 255], ansi: "\x1b[37m" },
	gray: { rgb: [156, 163, 175], ansi: "\x1b[90m" },
	dimGray: { rgb: [107, 114, 128], ansi: "\x1b[2m" },
	green: { rgb: [34, 197, 94], ansi: "\x1b[32m" },
	cyan: { rgb: [6, 182, 212], ansi: "\x1b[36m" },
	yellow: { rgb: [234, 179, 8], ansi: "\x1b[33m" },
	red: { rgb: [239, 68, 68], ansi: "\x1b[31m" },
	magenta: { rgb: [168, 85, 247], ansi: "\x1b[35m" },
} as const satisfies Record<string, ColorDef>

// ---- Color Resolution ----

export function detectColorLevel(env?: Record<string, string | undefined>): ColorLevel {
	const e = env ?? process.env
	if (e.NO_COLOR !== undefined) return "none"
	const ct = e.COLORTERM
	if (ct === "truecolor" || ct === "24bit") return "truecolor"
	return "basic"
}

export function resolveColor(def: ColorDef, placement: "fg" | "bg", level: ColorLevel): string {
	if (level === "none") return ""
	if (level === "truecolor") {
		const [r, g, b] = def.rgb
		const code = placement === "fg" ? 38 : 48
		return `\x1b[${code};2;${r};${g};${b}m`
	}
	return def.ansi
}

// ---- Theme Factory ----

export function createDefaultTheme(level: ColorLevel): Theme {
	const r = (def: ColorDef) => resolveColor(def, "fg", level)

	return {
		name: "default",
		colors: {
			fg: {
				accent: r(PRIMITIVES.white),
				default: r(PRIMITIVES.white),
				subtle: r(PRIMITIVES.dimGray),
				muted: r(PRIMITIVES.gray),
			},
			status: {
				success: r(PRIMITIVES.green),
				warning: r(PRIMITIVES.yellow),
				danger: r(PRIMITIVES.red),
				info: r(PRIMITIVES.cyan),
			},
			progress: {
				low: r(PRIMITIVES.green),
				medium: r(PRIMITIVES.cyan),
				high: r(PRIMITIVES.yellow),
				critical: r(PRIMITIVES.red),
				empty: r(PRIMITIVES.dimGray),
			},
			badge: {
				pro: r(PRIMITIVES.green),
				max: r(PRIMITIVES.magenta),
				ent: r(PRIMITIVES.cyan),
			},
			box: {
				border: "",
				title: level === "none" ? "" : "\x1b[1m",
			},
		},
	}
}

// ---- State Management ----

let _colorLevel: ColorLevel = detectColorLevel()
let _activeTheme: Theme = createDefaultTheme(_colorLevel)

export function getTheme(): Theme {
	return _activeTheme
}

export function setTheme(theme: Theme): void {
	_activeTheme = theme
}

export function getColorLevel(): ColorLevel {
	return _colorLevel
}

export function initTheme(env?: Record<string, string | undefined>): void {
	_colorLevel = detectColorLevel(env)
	_activeTheme = createDefaultTheme(_colorLevel)
}
