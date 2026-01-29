export interface MockUsageData {
	five_hour: {
		utilization: number
		resets_at: string
	} | null
	seven_day: {
		utilization: number
		resets_at: string
	} | null
	seven_day_oauth_apps: {
		utilization: number
		resets_at: string
	} | null
	seven_day_opus: {
		utilization: number
		resets_at: string
	} | null
}

export interface MockProfileData {
	account: {
		uuid: string
		full_name: string
		display_name: string
		email: string
		has_claude_max: boolean
		has_claude_pro: boolean
	}
	organization: {
		uuid: string
		name: string
		organization_type: string
		billing_type: string
		rate_limit_tier: string
	} | null
}

export interface MockScenario {
	name: string
	description: string
	profile: MockProfileData
	usage: MockUsageData
	delay?: number
	statusCode?: number
	errorBody?: { error: string; message?: string }
}

function futureDate(hours: number): string {
	return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export const SCENARIOS: Record<string, MockScenario> = {
	healthy: {
		name: "healthy",
		description: "Normal usage with moderate utilization",
		profile: {
			account: {
				uuid: "test-user-uuid",
				full_name: "Test User",
				display_name: "Test",
				email: "test@example.com",
				has_claude_max: true,
				has_claude_pro: false,
			},
			organization: null,
		},
		usage: {
			five_hour: {
				utilization: 44,
				resets_at: futureDate(3),
			},
			seven_day: {
				utilization: 12,
				resets_at: futureDate(120),
			},
			seven_day_oauth_apps: null,
			seven_day_opus: null,
		},
	},

	lowUsage: {
		name: "lowUsage",
		description: "Very low usage",
		profile: {
			account: {
				uuid: "low-usage-user",
				full_name: "Light User",
				display_name: "Light",
				email: "light@example.com",
				has_claude_max: false,
				has_claude_pro: true,
			},
			organization: null,
		},
		usage: {
			five_hour: {
				utilization: 5,
				resets_at: futureDate(4),
			},
			seven_day: {
				utilization: 2,
				resets_at: futureDate(150),
			},
			seven_day_oauth_apps: null,
			seven_day_opus: null,
		},
	},

	highUsage: {
		name: "highUsage",
		description: "High usage near limits",
		profile: {
			account: {
				uuid: "heavy-user-uuid",
				full_name: "Heavy User",
				display_name: "Heavy",
				email: "heavy@example.com",
				has_claude_max: true,
				has_claude_pro: false,
			},
			organization: null,
		},
		usage: {
			five_hour: {
				utilization: 85,
				resets_at: futureDate(1),
			},
			seven_day: {
				utilization: 78,
				resets_at: futureDate(48),
			},
			seven_day_oauth_apps: null,
			seven_day_opus: null,
		},
	},

	rateLimited: {
		name: "rateLimited",
		description: "User has hit rate limit",
		profile: {
			account: {
				uuid: "limited-user-uuid",
				full_name: "Limited User",
				display_name: "Limited",
				email: "limited@example.com",
				has_claude_max: true,
				has_claude_pro: false,
			},
			organization: null,
		},
		usage: {
			five_hour: {
				utilization: 100,
				resets_at: futureDate(0.5),
			},
			seven_day: {
				utilization: 95,
				resets_at: futureDate(24),
			},
			seven_day_oauth_apps: null,
			seven_day_opus: null,
		},
		statusCode: 429,
		errorBody: {
			error: "rate_limit_exceeded",
			message: "You have exceeded your rate limit",
		},
	},

	authError: {
		name: "authError",
		description: "Authentication failed",
		profile: {
			account: {
				uuid: "",
				full_name: "",
				display_name: "",
				email: "",
				has_claude_max: false,
				has_claude_pro: false,
			},
			organization: null,
		},
		usage: {
			five_hour: null,
			seven_day: null,
			seven_day_oauth_apps: null,
			seven_day_opus: null,
		},
		statusCode: 401,
		errorBody: {
			error: "invalid_token",
			message: "The access token is invalid or expired",
		},
	},

	enterpriseOrg: {
		name: "enterpriseOrg",
		description: "Enterprise organization user",
		profile: {
			account: {
				uuid: "ent-user-uuid",
				full_name: "Enterprise User",
				display_name: "EntUser",
				email: "user@enterprise.com",
				has_claude_max: false,
				has_claude_pro: false,
			},
			organization: {
				uuid: "org-uuid",
				name: "Enterprise Corp",
				organization_type: "claude_enterprise",
				billing_type: "enterprise",
				rate_limit_tier: "enterprise",
			},
		},
		usage: {
			five_hour: {
				utilization: 30,
				resets_at: futureDate(4),
			},
			seven_day: {
				utilization: 15,
				resets_at: futureDate(100),
			},
			seven_day_oauth_apps: {
				utilization: 5,
				resets_at: futureDate(100),
			},
			seven_day_opus: {
				utilization: 8,
				resets_at: futureDate(100),
			},
		},
	},

	noLimits: {
		name: "noLimits",
		description: "No rate limits (unlimited plan)",
		profile: {
			account: {
				uuid: "unlimited-user",
				full_name: "Unlimited User",
				display_name: "Unlimited",
				email: "unlimited@example.com",
				has_claude_max: true,
				has_claude_pro: false,
			},
			organization: null,
		},
		usage: {
			five_hour: null,
			seven_day: null,
			seven_day_oauth_apps: null,
			seven_day_opus: null,
		},
	},

	slowResponse: {
		name: "slowResponse",
		description: "Slow API response (for timeout testing)",
		profile: {
			account: {
				uuid: "slow-user",
				full_name: "Slow User",
				display_name: "Slow",
				email: "slow@example.com",
				has_claude_max: true,
				has_claude_pro: false,
			},
			organization: null,
		},
		usage: {
			five_hour: {
				utilization: 50,
				resets_at: futureDate(2),
			},
			seven_day: {
				utilization: 25,
				resets_at: futureDate(100),
			},
			seven_day_oauth_apps: null,
			seven_day_opus: null,
		},
		delay: 3000,
	},

	serverError: {
		name: "serverError",
		description: "Internal server error",
		profile: {
			account: {
				uuid: "",
				full_name: "",
				display_name: "",
				email: "",
				has_claude_max: false,
				has_claude_pro: false,
			},
			organization: null,
		},
		usage: {
			five_hour: null,
			seven_day: null,
			seven_day_oauth_apps: null,
			seven_day_opus: null,
		},
		statusCode: 500,
		errorBody: {
			error: "internal_error",
			message: "An unexpected error occurred",
		},
	},
}

export function getScenario(name: string): MockScenario {
	const scenario = SCENARIOS[name]
	if (!scenario) {
		throw new Error(
			"Unknown scenario: " + name + ". Available: " + Object.keys(SCENARIOS).join(", "),
		)
	}
	return scenario
}

export function listScenarios(): string[] {
	return Object.keys(SCENARIOS)
}
