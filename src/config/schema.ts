import { z } from "zod"

export const OAuthConfigSchema = z.object({
	enabled: z.boolean().optional(),
	showProfile: z.boolean().optional(),
})

export const DisplayConfigSchema = z.object({
	refreshInterval: z.number().min(10).max(3600).optional(),
})

export const WidgetConfigSchema = z.object({
	style: z.enum(["rounded", "square", "double", "simple"]).optional(),
	position: z.enum(["left", "right", "top", "bottom"]).optional(),
	compact: z.boolean().optional(),
})

export const VALID_CHARACTER_THEMES = ["robot"] as const
export type CharacterThemeName = (typeof VALID_CHARACTER_THEMES)[number]

export const CharacterConfigSchema = z.object({
	enabled: z.boolean().optional(),
	theme: z.enum(VALID_CHARACTER_THEMES).optional(),
	animation: z.boolean().optional(),
	speechBubble: z.boolean().optional(),
	language: z.string().optional(),
	shimmer: z.boolean().optional(),
})

export type CharacterConfig = z.infer<typeof CharacterConfigSchema>

export const VALID_THEMES = ["default", "nord"] as const
export type ThemeName = (typeof VALID_THEMES)[number]

export const ConfigSchema = z.object({
	oauth: OAuthConfigSchema.optional(),
	display: DisplayConfigSchema.optional(),
	widget: WidgetConfigSchema.optional(),
	theme: z.enum(VALID_THEMES).optional(),
	character: CharacterConfigSchema.optional(),
})

export type OAuthConfig = z.infer<typeof OAuthConfigSchema>
export type DisplayConfig = z.infer<typeof DisplayConfigSchema>
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>
export type Config = z.infer<typeof ConfigSchema>

export interface ResolvedConfig {
	oauth: {
		enabled: boolean
		showProfile: boolean
	}
	display: {
		refreshInterval: number
	}
	widget: {
		style: "rounded" | "square" | "double" | "simple"
		position: "left" | "right" | "top" | "bottom"
		compact: boolean
	}
	theme: ThemeName
	character: {
		enabled: boolean
		theme: CharacterThemeName
		animation: boolean
		speechBubble: boolean
		language: string
		shimmer: boolean
	}
}

export function getDefaultConfig(): ResolvedConfig {
	return {
		oauth: {
			enabled: true,
			showProfile: true,
		},
		display: {
			refreshInterval: 30,
		},
		widget: {
			style: "rounded",
			position: "bottom",
			compact: false,
		},
		theme: "default",
		character: {
			enabled: true,
			theme: "robot",
			animation: true,
			speechBubble: true,
			language: "en",
			shimmer: true,
		},
	}
}

export function resolveConfig(partial: Config): ResolvedConfig {
	const defaults = getDefaultConfig()

	return {
		oauth: {
			enabled: partial.oauth?.enabled ?? defaults.oauth.enabled,
			showProfile: partial.oauth?.showProfile ?? defaults.oauth.showProfile,
		},
		display: {
			refreshInterval: partial.display?.refreshInterval ?? defaults.display.refreshInterval,
		},
		widget: {
			style: partial.widget?.style ?? defaults.widget.style,
			position: partial.widget?.position ?? defaults.widget.position,
			compact: partial.widget?.compact ?? defaults.widget.compact,
		},
		theme: partial.theme ?? defaults.theme,
		character: {
			enabled: partial.character?.enabled ?? defaults.character.enabled,
			theme: partial.character?.theme ?? defaults.character.theme,
			animation: partial.character?.animation ?? defaults.character.animation,
			speechBubble: partial.character?.speechBubble ?? defaults.character.speechBubble,
			language: partial.character?.language ?? defaults.character.language,
			shimmer: partial.character?.shimmer ?? defaults.character.shimmer,
		},
	}
}

export function parseConfig(input: unknown): Config {
	return ConfigSchema.parse(input)
}

export function safeParseConfig(input: unknown): z.SafeParseReturnType<unknown, Config> {
	return ConfigSchema.safeParse(input)
}
