export {
	type Config,
	type ResolvedConfig,
	type OAuthConfig,
	type DisplayConfig,
	type WidgetConfig,
	type CharacterConfig,
	type ThemeName,
	type CharacterThemeName,
	ConfigSchema,
	VALID_THEMES,
	VALID_CHARACTER_THEMES,
	getDefaultConfig,
	resolveConfig,
	parseConfig,
	safeParseConfig,
} from "./schema"

export {
	type LoadConfigResult,
	loadConfig,
	getConfigDir,
	getDefaultConfigPath,
} from "./loader"
