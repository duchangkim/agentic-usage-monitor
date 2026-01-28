import type { Provider, UsageProvider } from "../types"
import { anthropicProvider } from "./anthropic"
import { googleProvider } from "./google"
import { openaiProvider } from "./openai"
import { openrouterProvider } from "./openrouter"

export const providers: Record<Provider, UsageProvider> = {
	anthropic: anthropicProvider,
	openai: openaiProvider,
	google: googleProvider,
	openrouter: openrouterProvider,
}

export function getProvider(name: Provider): UsageProvider {
	return providers[name]
}

export function getAllProviders(): UsageProvider[] {
	return Object.values(providers)
}

export { anthropicProvider, openaiProvider, googleProvider, openrouterProvider }
