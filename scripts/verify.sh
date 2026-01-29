#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================"
echo "  Verification Pipeline"
echo "========================================"
echo ""

FAILED=0

run_step() {
    local name="$1"
    local cmd="$2"
    
    echo -n "[$name] "
    
    if output=$(eval "$cmd" 2>&1); then
        echo -e "${GREEN}PASS${NC}"
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "$output"
        FAILED=1
        return 1
    fi
}

run_step "typecheck" "bun run typecheck"
run_step "lint" "bun run lint"
run_step "build" "bun run build"

echo ""
echo "========================================"
if [ $FAILED -eq 0 ]; then
    echo -e "  ${GREEN}All checks passed${NC}"
    exit 0
else
    echo -e "  ${RED}Some checks failed${NC}"
    exit 1
fi
