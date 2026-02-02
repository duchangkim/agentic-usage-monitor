export {
	type Config,
	type ResolvedConfig,
	type OAuthConfig,
	type DisplayConfig,
	type WidgetConfig,
	ConfigSchema,
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
