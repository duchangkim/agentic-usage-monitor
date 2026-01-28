import { z } from "zod"

export const AnthropicConfigSchema = z.object({
	adminApiKey: z.string().optional(),
	enabled: z.boolean().optional(),
})

export const OAuthConfigSchema = z.object({
	enabled: z.boolean().optional(),
	showProfile: z.boolean().optional(),
})

export const DisplayConfigSchema = z.object({
	refreshInterval: z.number().min(10).max(3600).optional(),
	showApiUsage: z.boolean().optional(),
	showRateLimits: z.boolean().optional(),
	currency: z.enum(["USD", "EUR", "KRW", "JPY", "GBP"]).optional(),
})

export const WidgetConfigSchema = z.object({
	width: z.number().min(30).max(100).optional(),
	style: z.enum(["rounded", "square", "double", "simple"]).optional(),
	position: z.enum(["left", "right"]).optional(),
	colors: z.boolean().optional(),
})

export const ConfigSchema = z.object({
	anthropic: AnthropicConfigSchema.optional(),
	oauth: OAuthConfigSchema.optional(),
	display: DisplayConfigSchema.optional(),
	widget: WidgetConfigSchema.optional(),
})

export type AnthropicConfig = z.infer<typeof AnthropicConfigSchema>
export type OAuthConfig = z.infer<typeof OAuthConfigSchema>
export type DisplayConfig = z.infer<typeof DisplayConfigSchema>
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>
export type Config = z.infer<typeof ConfigSchema>

export interface ResolvedConfig {
	anthropic: {
		adminApiKey: string | undefined
		enabled: boolean
	}
	oauth: {
		enabled: boolean
		showProfile: boolean
	}
	display: {
		refreshInterval: number
		showApiUsage: boolean
		showRateLimits: boolean
		currency: "USD" | "EUR" | "KRW" | "JPY" | "GBP"
	}
	widget: {
		width: number
		style: "rounded" | "square" | "double" | "simple"
		position: "left" | "right"
		colors: boolean
	}
}

export function getDefaultConfig(): ResolvedConfig {
	return {
		anthropic: {
			adminApiKey: undefined,
			enabled: true,
		},
		oauth: {
			enabled: true,
			showProfile: true,
		},
		display: {
			refreshInterval: 30,
			showApiUsage: true,
			showRateLimits: true,
			currency: "USD",
		},
		widget: {
			width: 52,
			style: "rounded",
			position: "left",
			colors: true,
		},
	}
}

export function resolveConfig(partial: Config): ResolvedConfig {
	const defaults = getDefaultConfig()

	return {
		anthropic: {
			adminApiKey: partial.anthropic?.adminApiKey ?? defaults.anthropic.adminApiKey,
			enabled: partial.anthropic?.enabled ?? defaults.anthropic.enabled,
		},
		oauth: {
			enabled: partial.oauth?.enabled ?? defaults.oauth.enabled,
			showProfile: partial.oauth?.showProfile ?? defaults.oauth.showProfile,
		},
		display: {
			refreshInterval: partial.display?.refreshInterval ?? defaults.display.refreshInterval,
			showApiUsage: partial.display?.showApiUsage ?? defaults.display.showApiUsage,
			showRateLimits: partial.display?.showRateLimits ?? defaults.display.showRateLimits,
			currency: partial.display?.currency ?? defaults.display.currency,
		},
		widget: {
			width: partial.widget?.width ?? defaults.widget.width,
			style: partial.widget?.style ?? defaults.widget.style,
			position: partial.widget?.position ?? defaults.widget.position,
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
