import { resolve } from "node:path"
import { listScenarios } from "../fixtures/scenarios"
import { assertCli } from "./assertions"
import { runCliWithScenario } from "./cli-runner"
import { createReporter, writeReport } from "./reporter"

const REPORT_PATH = resolve(import.meta.dir, "../../test-results/report.json")

interface TestCase {
	name: string
	description: string
	scenario: string
	args: string[]
	assertions: (result: ReturnType<typeof assertCli>) => void
}

const TEST_CASES: TestCase[] = [
	{
		name: "help_flag",
		description: "CLI displays help with --help",
		scenario: "healthy",
		args: ["--help"],
		assertions: (a) => a.exitSuccess().stdoutContains("USAGE:"),
	},
	{
		name: "once_healthy",
		description: "One-shot display with healthy scenario",
		scenario: "healthy",
		args: ["--once"],
		assertions: (a) => a.exitSuccess().hasBoxDrawing().stdoutContains("Rate Limits"),
	},
	{
		name: "once_high_usage",
		description: "One-shot display with high usage",
		scenario: "highUsage",
		args: ["--once"],
		assertions: (a) => a.exitSuccess().stdoutContains("85%"),
	},
	{
		name: "once_low_usage",
		description: "One-shot display with low usage",
		scenario: "lowUsage",
		args: ["--once"],
		assertions: (a) => a.exitSuccess().stdoutContains("PRO"),
	},
	{
		name: "once_enterprise",
		description: "One-shot display with enterprise org",
		scenario: "enterpriseOrg",
		args: ["--once"],
		assertions: (a) => a.exitSuccess().stdoutContains("ENT"),
	},
	{
		name: "once_no_limits",
		description: "One-shot display with no limits",
		scenario: "noLimits",
		args: ["--once"],
		assertions: (a) => a.exitSuccess().stdoutContains("No limits"),
	},
]

async function main() {
	console.log("Generating E2E test report...")
	console.log("Available scenarios:", listScenarios().join(", "))
	console.log("")

	const reporter = createReporter()

	for (const testCase of TEST_CASES) {
		console.log("Running: " + testCase.name + " (" + testCase.scenario + ")")

		try {
			const { result, cleanup } = await runCliWithScenario(testCase.args, testCase.scenario)

			const assertions = assertCli(result)
			testCase.assertions(assertions)

			reporter.addScenario(testCase.name, testCase.description, result, assertions.getResults())

			await cleanup()

			const summary = assertions.getSummary()
			if (summary.failed > 0) {
				console.log("  FAILED (" + summary.failed + " assertions)")
			} else {
				console.log("  PASSED")
			}
		} catch (error) {
			console.log("  ERROR: " + (error instanceof Error ? error.message : String(error)))
			reporter.addError(
				testCase.name,
				testCase.description,
				error instanceof Error ? error : new Error(String(error)),
			)
		}
	}

	const report = reporter.generateReport()
	await writeReport(report, REPORT_PATH)

	reporter.printSummary()

	console.log("")
	console.log("Report written to: " + REPORT_PATH)

	process.exit(report.summary.failed > 0 || report.summary.errored > 0 ? 1 : 0)
}

main().catch((error) => {
	console.error("Fatal error:", error)
	process.exit(1)
})
