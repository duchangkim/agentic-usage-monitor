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
		readonly heading: string
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

// Nord palette primitives
const NORD = {
	nord3: { rgb: [76, 86, 106], ansi: "\x1b[90m" }, // Polar Night — subtle/empty
	nord4: { rgb: [216, 222, 233], ansi: "\x1b[37m" }, // Snow Storm — default text
	nord6: { rgb: [236, 239, 244], ansi: "\x1b[97m" }, // Snow Storm — accent/bright
	nord8: { rgb: [136, 192, 208], ansi: "\x1b[36m" }, // Frost — info/cyan
	nord10: { rgb: [94, 129, 172], ansi: "\x1b[34m" }, // Frost — muted blue
	nord11: { rgb: [191, 97, 106], ansi: "\x1b[31m" }, // Aurora — red/danger
	nord13: { rgb: [235, 203, 139], ansi: "\x1b[33m" }, // Aurora — yellow/warning
	nord14: { rgb: [163, 190, 140], ansi: "\x1b[32m" }, // Aurora — green/success
	nord15: { rgb: [180, 142, 173], ansi: "\x1b[35m" }, // Aurora — purple/magenta
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

// ---- Theme Factories ----

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
				heading: r(PRIMITIVES.yellow),
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

function createNordTheme(level: ColorLevel): Theme {
	const r = (def: ColorDef) => resolveColor(def, "fg", level)

	return {
		name: "nord",
		colors: {
			fg: {
				accent: r(NORD.nord6),
				default: r(NORD.nord4),
				subtle: r(NORD.nord3),
				muted: r(NORD.nord10),
				heading: r(NORD.nord13),
			},
			status: {
				success: r(NORD.nord14),
				warning: r(NORD.nord13),
				danger: r(NORD.nord11),
				info: r(NORD.nord8),
			},
			progress: {
				low: r(NORD.nord14),
				medium: r(NORD.nord8),
				high: r(NORD.nord13),
				critical: r(NORD.nord11),
				empty: r(NORD.nord3),
			},
			badge: {
				pro: r(NORD.nord14),
				max: r(NORD.nord15),
				ent: r(NORD.nord8),
			},
			box: {
				border: "",
				title: level === "none" ? "" : "\x1b[1m",
			},
		},
	}
}

// ---- Preset Registry ----

type ThemeFactory = (level: ColorLevel) => Theme

const THEME_PRESETS: Record<string, ThemeFactory> = {
	default: createDefaultTheme,
	nord: createNordTheme,
}

export function getPreset(name: string, level: ColorLevel): Theme | undefined {
	const factory = THEME_PRESETS[name]
	if (!factory) return undefined
	return factory(level)
}

export function getPresetNames(): string[] {
	return Object.keys(THEME_PRESETS)
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

export function initTheme(env?: Record<string, string | undefined>, themeName?: string): void {
	_colorLevel = detectColorLevel(env)
	const preset = themeName ? getPreset(themeName, _colorLevel) : undefined
	_activeTheme = preset ?? createDefaultTheme(_colorLevel)
}
