#!/usr/bin/env bun
/**
 * Build standalone binary using `bun build --compile`.
 *
 * Usage:
 *   bun run scripts/build-binary.ts          # Build for current platform
 *   bun run scripts/build-binary.ts --all    # Build for all platforms
 */
import { execSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { platform } from "node:os"
import pkg from "../package.json"

const TARGETS = [
	{ target: "bun-darwin-arm64", suffix: "darwin-arm64" },
	{ target: "bun-darwin-x64", suffix: "darwin-x64" },
	{ target: "bun-linux-x64", suffix: "linux-x64" },
	{ target: "bun-linux-arm64", suffix: "linux-arm64" },
] as const

const ENTRY = "src/cli/index.ts"
const DIST = "dist"

function codesignIfDarwin(target: string, outputPath: string): void {
	const isDarwinHost = platform() === "darwin"
	// "bun" target builds for the current platform, so on macOS it produces a darwin binary
	const isDarwinTarget = target.includes("darwin") || (target === "bun" && isDarwinHost)

	if (isDarwinTarget && isDarwinHost) {
		console.log(`  Signing: ${outputPath} (ad-hoc)`)
		execSync(`codesign --force --sign - ${outputPath}`, {
			stdio: "inherit",
			cwd: process.cwd(),
		})
	} else if (isDarwinTarget && !isDarwinHost) {
		console.log(`  Skipping codesign: ${outputPath} (darwin target on non-darwin host)`)
	}
}

function buildBinary(target: string, outputName: string): void {
	const cmd = [
		"bun build",
		"--compile",
		"--minify",
		`--define '__PKG_VERSION__="${pkg.version}"'`,
		`--target=${target}`,
		`--outfile ${DIST}/${outputName}`,
		ENTRY,
	].join(" ")

	console.log(`Building: ${outputName} (${target})`)
	execSync(cmd, { stdio: "inherit", cwd: process.cwd() })
	codesignIfDarwin(target, `${DIST}/${outputName}`)
	console.log(`  -> ${DIST}/${outputName}`)
}

function main(): void {
	const buildAll = process.argv.includes("--all")

	if (!existsSync(DIST)) {
		mkdirSync(DIST, { recursive: true })
	}

	console.log(`Building agentic-usage-monitor v${pkg.version}`)
	console.log("")

	if (buildAll) {
		for (const { target, suffix } of TARGETS) {
			buildBinary(target, `usage-monitor-${suffix}`)
		}
	} else {
		buildBinary("bun", "usage-monitor")
	}

	console.log("")
	console.log("Done!")
}

main()
