import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { z } from "zod"
import type { CredentialSource } from "../data/oauth-credentials"

const CredentialConfigSchema = z.object({
	source: z.enum(["auto", "claude-code", "opencode"]),
})

const AgentEntrySchema = z.object({
	command: z.string(),
	credential: CredentialConfigSchema,
})

const AgentConfigSchema = z.object({
	agents: z.record(z.string(), AgentEntrySchema),
})

export type AgentEntry = z.infer<typeof AgentEntrySchema>
export type AgentConfig = z.infer<typeof AgentConfigSchema>

export interface ResolvedAgentEntry {
	command: string
	credential: { source: CredentialSource }
}

export type ResolvedAgents = Record<string, ResolvedAgentEntry>

export const DEFAULT_AGENTS: ResolvedAgents = {
	claude: {
		command: "claude",
		credential: { source: "claude-code" },
	},
	opencode: {
		command: "opencode",
		credential: { source: "opencode" },
	},
}

export type LoadAgentConfigResult =
	| { success: true; config: AgentConfig }
	| { success: false; error: string }

export function getAgentConfigPath(): string {
	return join(homedir(), ".config", "usage-monitor", "agents.json")
}

export function loadAgentConfig(path?: string): LoadAgentConfigResult {
	const configPath = path ?? getAgentConfigPath()

	if (!existsSync(configPath)) {
		return { success: false, error: `Agent config not found: ${configPath}` }
	}

	try {
		const content = readFileSync(configPath, "utf-8")
		const parsed = JSON.parse(content)
		const validated = AgentConfigSchema.parse(parsed)
		return { success: true, config: validated }
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: `Invalid agent config: ${error.errors.map((e) => e.message).join(", ")}`,
			}
		}
		return {
			success: false,
			error: `Failed to parse agent config: ${error instanceof Error ? error.message : String(error)}`,
		}
	}
}

export function resolveAgentConfig(custom?: AgentConfig): ResolvedAgents {
	if (!custom) {
		return { ...DEFAULT_AGENTS }
	}

	return {
		...DEFAULT_AGENTS,
		...custom.agents,
	}
}

export function getAgentNames(agents: ResolvedAgents): string[] {
	return Object.keys(agents)
}

export function getAgent(agents: ResolvedAgents, name: string): ResolvedAgentEntry | undefined {
	return agents[name]
}
