import type { Assertion } from "./assertions"
import type { TestResult } from "./cli-runner"

export interface ScenarioResult {
	name: string
	description: string
	status: "pass" | "fail" | "skip" | "error"
	duration: number
	assertions: Assertion[]
	artifacts: {
		stdout: string
		stderr: string
		normalizedStdout?: string
	}
	error?: {
		message: string
		stack?: string
	}
}

export interface TestReport {
	timestamp: string
	mode: "mocked" | "real"
	environment: {
		platform: string
		bunVersion: string
		docker: boolean
		ci: boolean
	}
	summary: {
		total: number
		passed: number
		failed: number
		skipped: number
		errored: number
		duration: number
	}
	scenarios: ScenarioResult[]
}

export class TestReporter {
	private scenarios: ScenarioResult[] = []
	private startTime: number

	constructor() {
		this.startTime = Date.now()
	}

	addScenario(
		name: string,
		description: string,
		result: TestResult,
		assertions: Assertion[],
	): void {
		const allPassed = assertions.every((a) => a.pass)

		this.scenarios.push({
			name,
			description,
			status: allPassed ? "pass" : "fail",
			duration: result.duration,
			assertions,
			artifacts: {
				stdout: result.stdout,
				stderr: result.stderr,
			},
		})
	}

	addSkipped(name: string, description: string, reason: string): void {
		this.scenarios.push({
			name,
			description,
			status: "skip",
			duration: 0,
			assertions: [],
			artifacts: {
				stdout: "",
				stderr: "",
			},
			error: { message: reason },
		})
	}

	addError(name: string, description: string, error: Error): void {
		this.scenarios.push({
			name,
			description,
			status: "error",
			duration: 0,
			assertions: [],
			artifacts: {
				stdout: "",
				stderr: "",
			},
			error: {
				message: error.message,
				stack: error.stack,
			},
		})
	}

	generateReport(): TestReport {
		const totalDuration = Date.now() - this.startTime

		const passed = this.scenarios.filter((s) => s.status === "pass").length
		const failed = this.scenarios.filter((s) => s.status === "fail").length
		const skipped = this.scenarios.filter((s) => s.status === "skip").length
		const errored = this.scenarios.filter((s) => s.status === "error").length

		return {
			timestamp: new Date().toISOString(),
			mode: process.env.USE_REAL_API ? "real" : "mocked",
			environment: {
				platform: process.platform,
				bunVersion: Bun.version,
				docker: process.env.DOCKER === "true",
				ci: process.env.CI === "true",
			},
			summary: {
				total: this.scenarios.length,
				passed,
				failed,
				skipped,
				errored,
				duration: totalDuration,
			},
			scenarios: this.scenarios,
		}
	}

	toJSON(): string {
		return JSON.stringify(this.generateReport(), null, 2)
	}

	printSummary(): void {
		const report = this.generateReport()
		const { summary } = report

		console.log("")
		console.log("=".repeat(50))
		console.log("  E2E Test Report")
		console.log("=".repeat(50))
		console.log("")
		console.log("  Total:   " + summary.total)
		console.log("  Passed:  " + summary.passed)
		console.log("  Failed:  " + summary.failed)
		console.log("  Skipped: " + summary.skipped)
		console.log("  Errored: " + summary.errored)
		console.log("  Duration: " + summary.duration + "ms")
		console.log("")

		if (summary.failed > 0 || summary.errored > 0) {
			console.log("Failed/Errored scenarios:")
			for (const scenario of this.scenarios) {
				if (scenario.status === "fail" || scenario.status === "error") {
					console.log("  - " + scenario.name + ": " + scenario.status)
					if (scenario.error) {
						console.log("    Error: " + scenario.error.message)
					}
					const failedAssertions = scenario.assertions.filter((a) => !a.pass)
					for (const assertion of failedAssertions) {
						console.log("    Assertion: " + assertion.name)
						console.log("      Expected: " + String(assertion.expected))
						console.log("      Actual:   " + String(assertion.actual))
					}
				}
			}
			console.log("")
		}

		console.log("=".repeat(50))
	}
}

export function createReporter(): TestReporter {
	return new TestReporter()
}

export async function writeReport(report: TestReport, path: string): Promise<void> {
	await Bun.write(path, JSON.stringify(report, null, 2))
}
