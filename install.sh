#!/bin/sh
# Agentic Usage Monitor installer
# Usage: curl -fsSL https://raw.githubusercontent.com/duchangkim/agentic-usage-monitor/main/install.sh | sh
set -e

REPO="duchangkim/agentic-usage-monitor"
BINARY_NAME="usage-monitor"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

info() { printf '  \033[1;34m>\033[0m %s\n' "$1"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$1"; }
error() { printf '  \033[1;31mx\033[0m %s\n' "$1" >&2; }

detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS" in
        Darwin) OS="darwin" ;;
        Linux)  OS="linux" ;;
        *)      error "Unsupported OS: $OS"; exit 1 ;;
    esac

    case "$ARCH" in
        x86_64|amd64)  ARCH="x64" ;;
        arm64|aarch64) ARCH="arm64" ;;
        *)             error "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    PLATFORM="${OS}-${ARCH}"
}

get_latest_version() {
    if command -v curl >/dev/null 2>&1; then
        VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')
    elif command -v wget >/dev/null 2>&1; then
        VERSION=$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')
    else
        error "curl or wget is required"
        exit 1
    fi

    if [ -z "$VERSION" ]; then
        error "Failed to determine latest version"
        exit 1
    fi
}

download_binary() {
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${BINARY_NAME}-${PLATFORM}"
    CHECKSUM_URL="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"

    TMPDIR=$(mktemp -d)
    TMPFILE="${TMPDIR}/${BINARY_NAME}"
    CHECKSUMS="${TMPDIR}/checksums.txt"

    info "Downloading ${BINARY_NAME} ${VERSION} for ${PLATFORM}..."

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$DOWNLOAD_URL" -o "$TMPFILE"
        curl -fsSL "$CHECKSUM_URL" -o "$CHECKSUMS" 2>/dev/null || true
    else
        wget -qO "$TMPFILE" "$DOWNLOAD_URL"
        wget -qO "$CHECKSUMS" "$CHECKSUM_URL" 2>/dev/null || true
    fi

    # Verify checksum if available
    if [ -f "$CHECKSUMS" ] && [ -s "$CHECKSUMS" ]; then
        EXPECTED=$(grep "${BINARY_NAME}-${PLATFORM}$" "$CHECKSUMS" | awk '{print $1}')
        if [ -n "$EXPECTED" ]; then
            if command -v sha256sum >/dev/null 2>&1; then
                ACTUAL=$(sha256sum "$TMPFILE" | awk '{print $1}')
            elif command -v shasum >/dev/null 2>&1; then
                ACTUAL=$(shasum -a 256 "$TMPFILE" | awk '{print $1}')
            else
                warn "No SHA256 tool found, skipping checksum verification"
                ACTUAL=""
            fi

            if [ -n "$ACTUAL" ]; then
                if [ "$EXPECTED" != "$ACTUAL" ]; then
                    error "Checksum verification failed!"
                    error "  Expected: $EXPECTED"
                    error "  Actual:   $ACTUAL"
                    rm -rf "$TMPDIR"
                    exit 1
                fi
                info "Checksum verified"
            fi
        fi
    fi
}

install_binary() {
    mkdir -p "$INSTALL_DIR"
    mv "$TMPFILE" "${INSTALL_DIR}/${BINARY_NAME}"
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    rm -rf "$TMPDIR"

    # Remove macOS quarantine attribute
    if [ "$OS" = "darwin" ]; then
        xattr -d com.apple.quarantine "${INSTALL_DIR}/${BINARY_NAME}" 2>/dev/null || true
    fi

    info "Installed to ${INSTALL_DIR}/${BINARY_NAME}"
}

ensure_tmux() {
    if command -v tmux >/dev/null 2>&1; then
        return
    fi

    warn "tmux is not installed (required for 'usage-monitor launch')"

    case "$(uname -s)" in
        Darwin)
            if command -v brew >/dev/null 2>&1; then
                info "Installing tmux via Homebrew..."
                brew install tmux || { warn "Failed to install tmux. Install manually: brew install tmux"; return; }
            else
                warn "Install tmux manually: brew install tmux"
                return
            fi
            ;;
        Linux)
            if command -v apt-get >/dev/null 2>&1; then
                info "Installing tmux via apt..."
                sudo apt-get update -qq && sudo apt-get install -y -qq tmux || { warn "Failed to install tmux. Install manually: sudo apt install tmux"; return; }
            elif command -v dnf >/dev/null 2>&1; then
                info "Installing tmux via dnf..."
                sudo dnf install -y tmux || { warn "Failed to install tmux. Install manually: sudo dnf install tmux"; return; }
            elif command -v pacman >/dev/null 2>&1; then
                info "Installing tmux via pacman..."
                sudo pacman -S --noconfirm tmux || { warn "Failed to install tmux. Install manually: sudo pacman -S tmux"; return; }
            else
                warn "Install tmux manually using your package manager"
                return
            fi
            ;;
    esac

    if command -v tmux >/dev/null 2>&1; then
        info "tmux installed successfully"
    fi
}

check_path() {
    case ":$PATH:" in
        *":${INSTALL_DIR}:"*) ;;
        *)
            echo ""
            warn "${INSTALL_DIR} is not in your PATH"
            warn "Add it by running:"
            echo ""
            echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
            echo ""
            warn "Or add the above line to your shell profile (~/.bashrc, ~/.zshrc, etc.)"
            ;;
    esac
}

main() {
    echo ""
    echo "  Agentic Usage Monitor Installer"
    echo ""

    detect_platform
    get_latest_version
    download_binary
    install_binary
    ensure_tmux
    check_path

    echo ""
    info "Done! Run '${BINARY_NAME} --help' to get started."
    echo ""
}

main
