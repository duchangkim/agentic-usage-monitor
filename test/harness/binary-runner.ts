import { resolve } from "node:path"
import { type MockServerHandle, startMockServer } from "../mock-server/oauth-server"

export interface BinaryTestContext {
	mockServer: MockServerHandle | null
	scenario: string
	termWidth: number
	termHeight: number
	timeout: number
	credentialsPath?: string
}

export interface BinaryTestResult {
	exitCode: number
	stdout: string
	stderr: string
	duration: number
	timedOut: boolean
}

const PROJECT_ROOT = resolve(import.meta.dir, "../..")
const BINARY_PATH = resolve(PROJECT_ROOT, "dist/usage-monitor")
const TEST_CREDENTIALS_PATH = resolve(import.meta.dir, "../fixtures/credentials.json")

export { BINARY_PATH, PROJECT_ROOT }

export async function createBinaryTestContext(
	options: Partial<BinaryTestContext> = {},
): Promise<BinaryTestContext> {
	const scenario = options.scenario ?? "healthy"
	const mockServer = options.mockServer ?? (await startMockServer({ scenario }))

	return {
		mockServer,
		scenario,
		termWidth: options.termWidth ?? 80,
		termHeight: options.termHeight ?? 24,
		timeout: options.timeout ?? 10000,
	}
}

export async function runBinary(
	args: string[],
	context: BinaryTestContext,
): Promise<BinaryTestResult> {
	const start = Date.now()

	const env: Record<string, string> = {
		...process.env,
		COLUMNS: String(context.termWidth),
		LINES: String(context.termHeight),
		TEST_CREDENTIALS_PATH: context.credentialsPath ?? TEST_CREDENTIALS_PATH,
		TERM: "xterm-256color",
		NO_COLOR: "1",
	}

	if (context.mockServer) {
		env.OAUTH_API_BASE = context.mockServer.url + "/api/oauth"
	}

	const proc = Bun.spawn([BINARY_PATH, ...args], {
		env,
		stdout: "pipe",
		stderr: "pipe",
		cwd: PROJECT_ROOT,
	})

	let timedOut = false
	const timeoutId = setTimeout(() => {
		timedOut = true
		proc.kill()
	}, context.timeout)

	const stdout = await new Response(proc.stdout).text()
	const stderr = await new Response(proc.stderr).text()
	const exitCode = await proc.exited

	clearTimeout(timeoutId)

	return {
		exitCode,
		stdout,
		stderr,
		duration: Date.now() - start,
		timedOut,
	}
}
