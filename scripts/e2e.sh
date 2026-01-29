#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

usage() {
    cat <<EOF
E2E Test Runner for opencode-usage-monitor

Usage: $(basename "$0") [COMMAND] [OPTIONS]

COMMANDS:
    run         Run E2E tests (default)
    docker      Run E2E tests in Docker
    report      Generate JSON test report
    mock        Start mock OAuth server
    shell       Open shell in E2E Docker container
    clean       Remove test artifacts

OPTIONS:
    -s, --scenario SCENARIO    Set mock server scenario (default: healthy)
    -v, --verbose              Verbose output
    -h, --help                 Show this help

EXAMPLES:
    $(basename "$0")                    # Run E2E tests locally
    $(basename "$0") docker             # Run E2E tests in Docker
    $(basename "$0") report             # Generate JSON report
    $(basename "$0") mock -s highUsage  # Start mock server with highUsage scenario
    $(basename "$0") shell              # Open shell in Docker

SCENARIOS:
    healthy, lowUsage, highUsage, rateLimited, authError,
    enterpriseOrg, noLimits, slowResponse, serverError
EOF
}

COMMAND="run"
SCENARIO="healthy"
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        run|docker|report|mock|shell|clean)
            COMMAND="$1"
            shift
            ;;
        -s|--scenario)
            SCENARIO="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}" >&2
            usage >&2
            exit 1
            ;;
    esac
done

cd "$PROJECT_ROOT"

case "$COMMAND" in
    run)
        echo -e "${BLUE}Running E2E tests locally...${NC}"
        bun test test/e2e
        ;;

    docker)
        echo -e "${BLUE}Running E2E tests in Docker...${NC}"
        docker compose run --rm e2e
        ;;

    report)
        echo -e "${BLUE}Generating E2E test report...${NC}"
        mkdir -p test-results
        bun run test/harness/generate-report.ts
        echo ""
        echo -e "${GREEN}Report generated: test-results/report.json${NC}"
        ;;

    mock)
        echo -e "${BLUE}Starting mock OAuth server...${NC}"
        echo "  Scenario: $SCENARIO"
        echo "  Port: 8765"
        echo ""
        SCENARIO="$SCENARIO" bun run test/mock-server/oauth-server.ts
        ;;

    shell)
        echo -e "${BLUE}Opening E2E Docker shell...${NC}"
        docker compose run --rm e2e-shell
        ;;

    clean)
        echo -e "${BLUE}Cleaning test artifacts...${NC}"
        rm -rf test-results
        docker compose down --volumes --remove-orphans 2>/dev/null || true
        echo -e "${GREEN}Cleaned.${NC}"
        ;;
esac
