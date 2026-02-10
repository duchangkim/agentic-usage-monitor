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
	colors: z.boolean().optional(),
})

export const ConfigSchema = z.object({
	oauth: OAuthConfigSchema.optional(),
	display: DisplayConfigSchema.optional(),
	widget: WidgetConfigSchema.optional(),
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
		colors: boolean
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
			position: "right",
			compact: false,
			colors: true,
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
			colors: partial.widget?.colors ?? defaults.widget.colors,
		},
	}
}

export function parseConfig(input: unknown): Config {
	return ConfigSchema.parse(input)
}

export function safeParseConfig(input: unknown): z.SafeParseReturnType<unknown, Config> {
	return ConfigSchema.safeParse(input)
}
