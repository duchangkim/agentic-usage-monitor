import type { Provider, UsageProvider } from "../types"
import { anthropicProvider } from "./anthropic"

export const providers: Record<Provider, UsageProvider> = {
	anthropic: anthropicProvider,
}

export function getProvider(name: Provider): UsageProvider {
	return providers[name]
}

export function getAllProviders(): UsageProvider[] {
	return Object.values(providers)
}

export { anthropicProvider }
