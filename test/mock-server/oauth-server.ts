import { type MockScenario, SCENARIOS, getScenario } from "../fixtures/scenarios"

// Well-known test tokens for token refresh testing.
// When the mock server sees EXPIRED_TOKEN, it returns 401 (simulating an expired access token).
// The /v1/oauth/token endpoint accepts VALID_REFRESH_TOKEN and returns REFRESHED_TOKEN.
export const EXPIRED_TOKEN = "mock-expired-token"
export const REFRESHED_TOKEN = "mock-refreshed-token"
export const VALID_REFRESH_TOKEN = "mock-valid-refresh-token"

export interface MockServerOptions {
	port?: number
	scenario?: string
	verbose?: boolean
}

export interface MockServerHandle {
	url: string
	port: number
	stop: () => Promise<void>
	setScenario: (name: string) => void
	getRequestLog: () => RequestLogEntry[]
	clearRequestLog: () => void
}

interface RequestLogEntry {
	timestamp: Date
	method: string
	path: string
	headers: Record<string, string>
	scenario: string
}

function jsonResponse(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}

async function handleTokenRefresh(req: Request): Promise<Response> {
	const body = (await req.json()) as {
		grant_type?: string
		refresh_token?: string
		client_id?: string
	}
	if (body.grant_type === "refresh_token" && body.refresh_token === VALID_REFRESH_TOKEN) {
		return jsonResponse({
			access_token: REFRESHED_TOKEN,
			refresh_token: "mock-new-refresh-token",
			expires_in: 3600,
		})
	}
	return jsonResponse(
		{ error: "invalid_grant", error_description: "The refresh token is expired or invalid" },
		400,
	)
}

async function handleScenarioRoute(
	scenario: MockScenario,
	path: string,
	req: Request,
	currentScenario: string,
	setScenario: (name: string) => void,
	requestLog: RequestLogEntry[],
): Promise<Response> {
	if (scenario.delay) {
		await new Promise((resolve) => setTimeout(resolve, scenario.delay))
	}

	if (scenario.statusCode && scenario.statusCode >= 400) {
		return jsonResponse(scenario.errorBody ?? { error: "error" }, scenario.statusCode)
	}

	if (path === "/api/oauth/usage") {
		return jsonResponse(scenario.usage)
	}
	if (path === "/api/oauth/profile") {
		return jsonResponse(scenario.profile)
	}
	if (path === "/health") {
		return jsonResponse({
			status: "ok",
			scenario: currentScenario,
			availableScenarios: Object.keys(SCENARIOS),
		})
	}
	if (path === "/_test/scenario" && req.method === "POST") {
		const body = (await req.json()) as { scenario: string }
		if (body.scenario && SCENARIOS[body.scenario]) {
			setScenario(body.scenario)
			return jsonResponse({ scenario: body.scenario })
		}
		return jsonResponse({ error: "invalid_scenario" }, 400)
	}
	if (path === "/_test/requests") {
		return jsonResponse(requestLog)
	}

	return new Response("Not found", { status: 404 })
}

export async function startMockServer(options: MockServerOptions = {}): Promise<MockServerHandle> {
	const port = options.port ?? 0
	let currentScenario = options.scenario ?? "healthy"
	const verbose = options.verbose ?? false
	const requestLog: RequestLogEntry[] = []

	const setScenario = (name: string) => {
		currentScenario = name
	}

	const server = Bun.serve({
		port,
		fetch: async (req) => {
			const url = new URL(req.url)
			const path = url.pathname

			const logEntry: RequestLogEntry = {
				timestamp: new Date(),
				method: req.method,
				path,
				headers: Object.fromEntries(req.headers.entries()),
				scenario: currentScenario,
			}
			requestLog.push(logEntry)

			if (verbose) {
				console.log(
					"[MockServer] " + req.method + " " + path + " (scenario: " + currentScenario + ")",
				)
			}

			let scenario: MockScenario
			try {
				scenario = getScenario(currentScenario)
			} catch {
				return jsonResponse({ error: "invalid_scenario" }, 500)
			}

			if (path === "/v1/oauth/token" && req.method === "POST") {
				return handleTokenRefresh(req)
			}

			const authHeader = req.headers.get("authorization")
			if (authHeader === `Bearer ${EXPIRED_TOKEN}`) {
				return jsonResponse(
					{
						error: {
							type: "authentication_error",
							message:
								"OAuth token has expired. Please obtain a new token or refresh your existing token.",
						},
					},
					401,
				)
			}

			return handleScenarioRoute(scenario, path, req, currentScenario, setScenario, requestLog)
		},
	})

	const actualPort = server.port
	const serverUrl = "http://localhost:" + String(actualPort)

	if (verbose) {
		console.log("[MockServer] Started on " + serverUrl + " with scenario: " + currentScenario)
	}

	return {
		url: serverUrl,
		port: actualPort,
		stop: async () => {
			server.stop(true)
			if (verbose) {
				console.log("[MockServer] Stopped")
			}
		},
		setScenario: (name: string) => {
			if (!SCENARIOS[name]) {
				throw new Error("Unknown scenario: " + name)
			}
			currentScenario = name
			if (verbose) {
				console.log("[MockServer] Switched to scenario: " + name)
			}
		},
		getRequestLog: () => [...requestLog],
		clearRequestLog: () => {
			requestLog.length = 0
		},
	}
}

if (import.meta.main) {
	const port = Number.parseInt(process.env.PORT ?? "8765", 10)
	const scenario = process.env.SCENARIO ?? "healthy"

	console.log("Starting mock OAuth server...")
	console.log("  Port: " + String(port))
	console.log("  Scenario: " + scenario)
	console.log("")

	const server = await startMockServer({ port, scenario, verbose: true })

	console.log("Mock server running at " + server.url)
	console.log("")
	console.log("Endpoints:")
	console.log("  GET  " + server.url + "/api/oauth/usage")
	console.log("  GET  " + server.url + "/api/oauth/profile")
	console.log("  GET  " + server.url + "/health")
	console.log("  POST " + server.url + "/_test/scenario")
	console.log("  GET  " + server.url + "/_test/requests")
	console.log("")
	console.log("Press Ctrl+C to stop")

	process.on("SIGINT", async () => {
		await server.stop()
		process.exit(0)
	})
}
