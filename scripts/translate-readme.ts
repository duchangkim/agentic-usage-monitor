#!/usr/bin/env bun
/**
 * Translate README.md to Korean (README.ko.md) using GitHub Models API.
 *
 * Usage:
 *   GITHUB_TOKEN=<token> bun run scripts/translate-readme.ts
 */
import { readFileSync, writeFileSync } from "node:fs"

const API_URL = "https://models.github.ai/inference/chat/completions"
const MODEL = "openai/gpt-4o"
const TEMPERATURE = 0.1

const SYSTEM_PROMPT = `You are a professional translator specializing in software documentation.
Translate the following English Markdown document to Korean, following these rules strictly:

1. Preserve 100% of the Markdown formatting (headings, code blocks, tables, links, badges, images).
2. Do NOT translate: code blocks, inline code, URLs, badge markup, file paths, CLI commands, option/flag names, ASCII art.
3. Do NOT translate the project name "Agentic Usage Monitor".
4. Keep technical terms commonly used in English by Korean developers as-is: tmux, Docker, CLI, E2E, OAuth, API, PATH, macOS, Linux, Ubuntu, Debian, Windows, PowerShell, MIT, etc.
5. Translate natural language descriptions, instructions, and section headings into natural Korean.
6. In tables, translate only the "Description" column. Keep "Flag" column values as-is.
7. Add the following language navigation line as the very first line of the output:
   [English](README.md) | **한국어**

Output ONLY the translated Markdown. Do not include any explanations or comments.`

async function translateReadme(): Promise<string> {
	const token = process.env.GITHUB_TOKEN
	if (!token) {
		throw new Error("GITHUB_TOKEN environment variable is required")
	}

	const readme = readFileSync("README.md", "utf-8")

	const response = await fetch(API_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: MODEL,
			temperature: TEMPERATURE,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: readme },
			],
		}),
	})

	if (!response.ok) {
		const body = await response.text()
		throw new Error(`GitHub Models API error ${response.status}: ${body}`)
	}

	const data = (await response.json()) as {
		choices: { message: { content: string } }[]
	}

	const content = data.choices[0]?.message?.content
	if (!content) {
		throw new Error("No content in API response")
	}

	return content
}

async function main(): Promise<void> {
	console.log("Translating README.md to Korean...")

	const translated = await translateReadme()

	writeFileSync("README.ko.md", translated)
	console.log("Written: README.ko.md")
}

main()
