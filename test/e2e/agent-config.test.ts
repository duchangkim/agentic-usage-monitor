import { describe, expect, it } from "bun:test"
import { writeFileSync } from "node:fs"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	type AgentConfig,
	DEFAULT_AGENTS,
	loadAgentConfig,
	resolveAgentConfig,
} from "../../src/config/agents"

describe("Agent Config - Default Agents", () => {
	it("should have claude agent with claude-code credential source", () => {
		expect(DEFAULT_AGENTS.claude).toBeDefined()
		expect(DEFAULT_AGENTS.claude.command).toBe("claude")
		expect(DEFAULT_AGENTS.claude.credential.source).toBe("claude-code")
	})

	it("should have opencode agent with opencode credential source", () => {
		expect(DEFAULT_AGENTS.opencode).toBeDefined()
		expect(DEFAULT_AGENTS.opencode.command).toBe("opencode")
		expect(DEFAULT_AGENTS.opencode.credential.source).toBe("opencode")
	})
})

describe("Agent Config - Loading from file", () => {
	it("should load custom agents from JSON file", () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "agent-config-"))
		const configPath = join(tmpDir, "agents.json")
		const config: AgentConfig = {
			agents: {
				"work-claude": {
					command: "claude",
					credential: { source: "claude-code" },
				},
			},
		}
		writeFileSync(configPath, JSON.stringify(config))

		const result = loadAgentConfig(configPath)
		expect(result.success).toBe(true)
		if (result.success) {
			expect(result.config.agents["work-claude"]).toBeDefined()
			expect(result.config.agents["work-claude"].command).toBe("claude")
		}
	})

	it("should return error for invalid JSON", () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "agent-config-"))
		const configPath = join(tmpDir, "agents.json")
		writeFileSync(configPath, "not valid json")

		const result = loadAgentConfig(configPath)
		expect(result.success).toBe(false)
	})

	it("should return error for invalid schema", () => {
		const tmpDir = mkdtempSync(join(tmpdir(), "agent-config-"))
		const configPath = join(tmpDir, "agents.json")
		writeFileSync(configPath, JSON.stringify({ agents: { bad: { wrong: true } } }))

		const result = loadAgentConfig(configPath)
		expect(result.success).toBe(false)
	})

	it("should return not-found for missing file", () => {
		const result = loadAgentConfig("/tmp/nonexistent-agents-config.json")
		expect(result.success).toBe(false)
		if (!result.success) {
			expect(result.error).toContain("not found")
		}
	})
})

describe("Agent Config - Resolve", () => {
	it("should merge custom agents with defaults", () => {
		const custom: AgentConfig = {
			agents: {
				"work-claude": {
					command: "claude --profile work",
					credential: { source: "claude-code" },
				},
			},
		}

		const resolved = resolveAgentConfig(custom)
		// Default agents should still be present
		expect(resolved.claude).toBeDefined()
		expect(resolved.opencode).toBeDefined()
		// Custom agent should be added
		expect(resolved["work-claude"]).toBeDefined()
		expect(resolved["work-claude"].command).toBe("claude --profile work")
	})

	it("should allow overriding default agents", () => {
		const custom: AgentConfig = {
			agents: {
				claude: {
					command: "claude --verbose",
					credential: { source: "opencode" },
				},
			},
		}

		const resolved = resolveAgentConfig(custom)
		expect(resolved.claude.command).toBe("claude --verbose")
		expect(resolved.claude.credential.source).toBe("opencode")
	})

	it("should return only defaults when no custom config", () => {
		const resolved = resolveAgentConfig(undefined)
		expect(Object.keys(resolved)).toContain("claude")
		expect(Object.keys(resolved)).toContain("opencode")
	})
})
