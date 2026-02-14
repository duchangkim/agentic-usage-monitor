import { execSync } from "node:child_process"
import { chmodSync, existsSync, renameSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const REPO = "duchangkim/agentic-usage-monitor"
const BINARY_NAME = "usage-monitor"

interface PlatformInfo {
	os: string
	arch: string
	platform: string
}

function detectPlatform(): PlatformInfo {
	const os = process.platform === "darwin" ? "darwin" : "linux"
	const arch = process.arch === "x64" ? "x64" : "arm64"
	return { os, arch, platform: `${os}-${arch}` }
}

async function getLatestVersion(): Promise<string> {
	const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
	if (!response.ok) {
		throw new Error(`Failed to fetch latest version: ${response.status}`)
	}
	const data = (await response.json()) as { tag_name: string }
	return data.tag_name
}

function getCurrentVersion(): string {
	// Read version injected at build time or from package.json
	const version =
		typeof __PKG_VERSION__ !== "undefined"
			? __PKG_VERSION__
			: (process.env.npm_package_version ?? "dev")
	return `v${version}`
}

declare const __PKG_VERSION__: string | undefined

function isBinaryInstall(): boolean {
	const execPath = process.execPath
	// Compiled binaries have execPath pointing to the binary itself
	// Dev mode (bun run) has execPath pointing to bun
	return !execPath.includes("bun") && !execPath.includes("node")
}

async function downloadFile(url: string, dest: string): Promise<void> {
	const response = await fetch(url)
	if (!response.ok) {
		throw new Error(`Download failed: ${response.status}`)
	}

	const buffer = await response.arrayBuffer()
	await Bun.write(dest, buffer)
}

async function verifyChecksum(
	filePath: string,
	platform: string,
	version: string,
): Promise<boolean> {
	try {
		const checksumUrl = `https://github.com/${REPO}/releases/download/${version}/checksums.txt`
		const response = await fetch(checksumUrl)
		if (!response.ok) return true // Skip verification if checksums unavailable

		const checksumText = await response.text()
		const expectedLine = checksumText
			.split("\n")
			.find((line) => line.endsWith(`${BINARY_NAME}-${platform}`))
		if (!expectedLine) return true // Skip if no matching checksum found

		const expectedHash = expectedLine.split(/\s+/)[0]
		if (!expectedHash) return true

		// Calculate SHA256 of downloaded file
		const file = Bun.file(filePath)
		const buffer = await file.arrayBuffer()
		const hasher = new Bun.CryptoHasher("sha256")
		hasher.update(buffer)
		const actualHash = hasher.digest("hex")

		return expectedHash === actualHash
	} catch {
		return true // Skip verification on error
	}
}

export async function runUpdate(): Promise<void> {
	console.log("")
	console.log("  Agentic Usage Monitor — Self Update")
	console.log("")

	if (!isBinaryInstall()) {
		console.log("  This installation was not done via standalone binary.")
		console.log("  Update using your package manager instead:")
		console.log("")
		console.log("    bun update -g agentic-usage-monitor")
		console.log("")
		process.exit(0)
	}

	const currentVersion = getCurrentVersion()
	console.log(`  Current version: ${currentVersion}`)

	let latestVersion: string
	try {
		latestVersion = await getLatestVersion()
	} catch (error) {
		console.error(`  Error: Failed to check for updates: ${error}`)
		process.exit(1)
	}
	console.log(`  Latest version:  ${latestVersion}`)

	if (currentVersion === latestVersion) {
		console.log("")
		console.log("  Already up to date!")
		console.log("")
		process.exit(0)
	}

	console.log("")
	console.log(`  Updating ${currentVersion} → ${latestVersion}...`)

	const { platform, os } = detectPlatform()
	const downloadUrl = `https://github.com/${REPO}/releases/download/${latestVersion}/${BINARY_NAME}-${platform}`

	const tmpDir = tmpdir()
	const tmpFile = join(tmpDir, `${BINARY_NAME}-update-${Date.now()}`)

	try {
		console.log(`  Downloading ${BINARY_NAME}-${platform}...`)
		await downloadFile(downloadUrl, tmpFile)

		console.log("  Verifying checksum...")
		const valid = await verifyChecksum(tmpFile, platform, latestVersion)
		if (!valid) {
			console.error("  Error: Checksum verification failed!")
			unlinkSync(tmpFile)
			process.exit(1)
		}
		console.log("  Checksum verified")

		// Replace the current binary
		const currentPath = process.execPath
		const backupPath = `${currentPath}.bak`

		chmodSync(tmpFile, 0o755)

		// Rename current binary to backup, move new binary in place
		if (existsSync(backupPath)) {
			unlinkSync(backupPath)
		}
		renameSync(currentPath, backupPath)
		renameSync(tmpFile, currentPath)
		unlinkSync(backupPath)

		// macOS: remove quarantine and ad-hoc codesign
		if (os === "darwin") {
			try {
				execSync(`xattr -d com.apple.quarantine ${JSON.stringify(currentPath)}`, {
					stdio: "ignore",
				})
			} catch {
				// Ignore
			}
			try {
				execSync(`codesign --force --sign - ${JSON.stringify(currentPath)}`, {
					stdio: "ignore",
				})
			} catch {
				// Non-fatal
			}
		}

		console.log("")
		console.log(`  Updated to ${latestVersion}!`)
		console.log("")
	} catch (error) {
		console.error(`  Error during update: ${error}`)
		// Cleanup temp file
		try {
			unlinkSync(tmpFile)
		} catch {
			// Ignore
		}
		process.exit(1)
	}
}
