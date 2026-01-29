import type { TestResult } from "./cli-runner"

export interface Assertion {
	name: string
	pass: boolean
	expected: unknown
	actual: unknown
	message?: string
}

function stripAnsi(str: string): string {
	const ESC = String.fromCharCode(27)
	const pattern = new RegExp(ESC + "\\[[0-9;]*m", "g")
	return str.replace(pattern, "")
}

function normalizeOutput(output: string): string {
	return stripAnsi(output)
		.replace(/\d{1,2}:\d{2}:\d{2}(?: [AP]M)?/g, "HH:MM:SS")
		.replace(/\d+h \d+m/g, "Xh Xm")
		.replace(/\(\d+h \d+m\)/g, "(Xh Xm)")
		.replace(/\d+m(?!\w)/g, "Xm")
}

export class CliAssertions {
	private assertions: Assertion[] = []
	private result: TestResult

	constructor(result: TestResult) {
		this.result = result
	}

	exitCode(expected: number): this {
		this.assertions.push({
			name: "exit_code",
			pass: this.result.exitCode === expected,
			expected,
			actual: this.result.exitCode,
		})
		return this
	}

	exitSuccess(): this {
		return this.exitCode(0)
	}

	exitFailure(): this {
		this.assertions.push({
			name: "exit_failure",
			pass: this.result.exitCode !== 0,
			expected: "non-zero",
			actual: this.result.exitCode,
		})
		return this
	}

	stdoutContains(text: string): this {
		const normalized = stripAnsi(this.result.stdout)
		const found = normalized.includes(text)
		this.assertions.push({
			name: "stdout_contains",
			pass: found,
			expected: text,
			actual: found ? "(found)" : "(not found)",
			message: found ? undefined : "Expected stdout to contain: " + text,
		})
		return this
	}

	stdoutNotContains(text: string): this {
		const normalized = stripAnsi(this.result.stdout)
		const found = normalized.includes(text)
		this.assertions.push({
			name: "stdout_not_contains",
			pass: !found,
			expected: "not " + text,
			actual: found ? "(found)" : "(not found)",
		})
		return this
	}

	stderrContains(text: string): this {
		const normalized = stripAnsi(this.result.stderr)
		const found = normalized.includes(text)
		this.assertions.push({
			name: "stderr_contains",
			pass: found,
			expected: text,
			actual: found ? "(found)" : "(not found)",
		})
		return this
	}

	stderrEmpty(): this {
		const isEmpty = this.result.stderr.trim() === ""
		this.assertions.push({
			name: "stderr_empty",
			pass: isEmpty,
			expected: "(empty)",
			actual: isEmpty ? "(empty)" : this.result.stderr.slice(0, 100),
		})
		return this
	}

	stdoutMatches(pattern: RegExp): this {
		const normalized = stripAnsi(this.result.stdout)
		const matches = pattern.test(normalized)
		this.assertions.push({
			name: "stdout_matches",
			pass: matches,
			expected: pattern.toString(),
			actual: matches ? "(matches)" : "(no match)",
		})
		return this
	}

	matchesSnapshot(snapshotContent: string): this {
		const normalizedActual = normalizeOutput(this.result.stdout)
		const normalizedExpected = normalizeOutput(snapshotContent)
		const matches = normalizedActual === normalizedExpected
		this.assertions.push({
			name: "snapshot_match",
			pass: matches,
			expected: normalizedExpected.slice(0, 200),
			actual: normalizedActual.slice(0, 200),
		})
		return this
	}

	performance(maxMs: number): this {
		this.assertions.push({
			name: "performance",
			pass: this.result.duration <= maxMs,
			expected: "<= " + maxMs + "ms",
			actual: this.result.duration + "ms",
		})
		return this
	}

	didNotTimeout(): this {
		this.assertions.push({
			name: "no_timeout",
			pass: !this.result.timedOut,
			expected: "no timeout",
			actual: this.result.timedOut ? "timed out" : "completed",
		})
		return this
	}

	hasProgressBar(): this {
		const hasBar = this.result.stdout.includes("━") || this.result.stdout.includes("░")
		this.assertions.push({
			name: "has_progress_bar",
			pass: hasBar,
			expected: "progress bar characters",
			actual: hasBar ? "(found)" : "(not found)",
		})
		return this
	}

	hasBoxDrawing(): this {
		const boxChars = ["╭", "╮", "╰", "╯", "│", "─", "├", "┤"]
		const hasBox = boxChars.some((char) => this.result.stdout.includes(char))
		this.assertions.push({
			name: "has_box_drawing",
			pass: hasBox,
			expected: "box drawing characters",
			actual: hasBox ? "(found)" : "(not found)",
		})
		return this
	}

	getResults(): Assertion[] {
		return [...this.assertions]
	}

	allPassed(): boolean {
		return this.assertions.every((a) => a.pass)
	}

	getFailures(): Assertion[] {
		return this.assertions.filter((a) => !a.pass)
	}

	getSummary(): { total: number; passed: number; failed: number } {
		const passed = this.assertions.filter((a) => a.pass).length
		return {
			total: this.assertions.length,
			passed,
			failed: this.assertions.length - passed,
		}
	}
}

export function assertCli(result: TestResult): CliAssertions {
	return new CliAssertions(result)
}
