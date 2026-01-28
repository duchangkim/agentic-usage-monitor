# OpenCode Usage Monitor - Project Scope

## Vision

opencode/터미널에서 Claude 사용량을 **지속적으로** 모니터링하는 위젯.
LLM 요청 없이 백그라운드에서 자동 갱신되며, 두 가지 데이터를 통합 표시.

## Target Metrics

### 1. Claude.ai Rate Limits (소비자 플랜)

이미지 참조: Claude.ai 설정 > 사용량 페이지

```
┌─────────────────────────────────────────┐
│  📊 Claude.ai Limits                    │
│  ─────────────────────────────────────  │
│  Session:  ━━━━░░░░░░ 16%  (3h 58m)    │
│  Weekly:   ━░░░░░░░░░  2%  (Wed 11:59) │
│  Sonnet:   ░░░░░░░░░░  0%  (Wed 11:59) │
└─────────────────────────────────────────┘
```

- **Session Limit**: 현재 세션 사용량 % (몇 시간마다 리셋)
- **Weekly All Models**: 주간 전체 모델 사용량 %
- **Weekly Sonnet**: Sonnet 전용 주간 사용량 %
- **Reset Timer**: 리셋까지 남은 시간

### 2. API Usage (Anthropic Admin API)

```
┌─────────────────────────────────────────┐
│  📈 API Usage (This Month)              │
│  ─────────────────────────────────────  │
│  Tokens:  1.2M input / 450K output      │
│  Cost:    $47.25 USD                    │
│  Claude Code: 2,341 requests            │
└─────────────────────────────────────────┘
```

- **Token Usage**: 입력/출력 토큰
- **Cost**: 월간 API 비용
- **Claude Code Metrics**: 요청 수, 사용자별 통계

## Data Sources

### Official: Anthropic Admin API

```bash
# Cost Report
GET https://api.anthropic.com/v1/organizations/cost_report
Authorization: x-api-key {ADMIN_API_KEY}

# Claude Code Usage
GET https://api.anthropic.com/v1/organizations/usage_report/claude_code
```

**Requirements:**

- Admin API Key (Console > API Keys > Admin)
- Organization 레벨 권한

### Unofficial: Claude.ai Rate Limits

Claude.ai는 rate limit 데이터 API를 제공하지 않음. 옵션:

1. **Browser Session 방식**
   - Claude.ai 로그인 후 쿠키 추출
   - 내부 API 엔드포인트 호출 (리버스 엔지니어링 필요)
   - 불안정, 언제든 변경 가능

2. **Manual Input 방식**
   - 사용자가 직접 limit 정보 입력
   - 안정적이지만 자동화 불가

3. **추후 공식 API 대기**
   - Anthropic이 rate limit API 제공 시 전환

## Architecture

### Display: tmux Split + Standalone CLI

```
┌─────────────────────────────────────────────────────────┐
│  Terminal (tmux)                                        │
│  ┌─────────────────────┬───────────────────────────────┐│
│  │ usage-monitor       │ opencode                      ││
│  │ (standalone)        │ (main TUI)                    ││
│  │                     │                               ││
│  │ ╭─ Claude Limits ─╮ │                               ││
│  │ │ Session: 16%    │ │                               ││
│  │ │ Weekly:  2%     │ │                               ││
│  │ ╰─────────────────╯ │                               ││
│  │                     │                               ││
│  │ ╭─ API Usage ─────╮ │                               ││
│  │ │ Cost: $47.25    │ │                               ││
│  │ │ Tokens: 1.2M    │ │                               ││
│  │ ╰─────────────────╯ │                               ││
│  └─────────────────────┴───────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Components

```
opencode-usage-monitor/
├── src/
│   ├── cli/              # Standalone CLI entry point
│   │   ├── index.ts      # Main CLI command
│   │   └── commands/     # Subcommands
│   ├── data/             # Data fetching layer
│   │   ├── admin-api.ts  # Anthropic Admin API client
│   │   ├── claude-ai.ts  # Claude.ai rate limit (unofficial)
│   │   └── cache.ts      # Data caching
│   ├── tui/              # TUI rendering (existing)
│   │   ├── widget.ts     # Usage widget
│   │   ├── progress.ts   # Progress bar component
│   │   └── ...
│   ├── config/           # Configuration
│   │   └── schema.ts     # Config validation
│   └── plugin/           # OpenCode plugin (optional)
│       └── index.ts      # Plugin entry point
├── bin/
│   └── usage-monitor     # CLI binary
└── ...
```

## Implementation Phases

### Phase 1: Anthropic Admin API Integration

- [x] Admin API client 구현
- [x] Cost report fetching
- [x] Claude Code usage report
- [x] CLI 표시

### Phase 2: TUI Widget Enhancement

- [x] Progress bar 컴포넌트
- [x] 다중 데이터 소스 통합 표시
- [x] Auto-refresh 구현
- [x] 설정 파일 지원
- [x] CLI entry point with commands

### Phase 1.5: OAuth Rate Limits (NEW)

- [x] OAuth credentials loader (~/.claude/.credentials.json)
- [x] OAuth API client (/api/oauth/usage, /api/oauth/profile)
- [x] Rate limit display (5-hour, 7-day windows)
- [x] Profile information display (user, org, plan badges)
- [x] CLI integration (--oauth-only, --rate-limits)

### Phase 3: Claude.ai Rate Limits (Optional)

- [x] OAuth API 사용 (Claude Code 인증 기반) - 완료!
- [ ] Browser session 기반 구현 (필요시)
- [ ] manual input fallback (필요시)

### Phase 4: Integration

- [x] tmux 통합 스크립트 (bin/opencode-with-monitor, bin/with-monitor)
- [x] opencode plugin hook (rate_limits tool 추가)
- [x] 문서화 (README.md)

### Phase 5: tmux Integration Enhancement (NEW)

**Architecture Decision**: OpenCode의 터미널 TUI 특성상 내부 위젯 렌더링 불가.
tmux를 통한 side-by-side 방식으로 최적의 사용자 경험 제공.

- [x] tmux 스크립트 개선 (자동 설치 감지, 에러 처리)
- [x] `/monitor` slash command (status, setup, help)
- [x] 자동 설치 스크립트 (bin/setup)
- [x] 사용자 친화적 README (tmux 가이드 포함)

## Configuration

```yaml
# ~/.config/usage-monitor/config.yaml
anthropic:
  admin_api_key: ${ANTHROPIC_ADMIN_API_KEY}  # Optional: for organizations
  enabled: true

oauth:
  enabled: true          # Uses ~/.claude/.credentials.json
  show_profile: true     # Show user/org info

display:
  refresh_interval: 30   # seconds
  show_api_usage: true
  show_rate_limits: true

widget:
  width: 42
  style: rounded
  position: left
```

## CLI Usage

```bash
# Install globally
npm install -g opencode-usage-monitor

# Run standalone monitor (shows OAuth rate limits by default)
usage-monitor

# One-shot display (no auto-refresh)
usage-monitor --once

# Show only OAuth rate limits (personal accounts)
usage-monitor --oauth-only
usage-monitor --rate-limits  # alias

# Show only Admin API usage (organizations)
usage-monitor --api-only

# Run with specific config
usage-monitor --config ~/.config/usage-monitor/config.yaml
```

## Current Status

### ✅ Completed

- TUI widget rendering (ANSI, box drawing)
- Position/toggle/style configuration
- Interactive demo
- Basic provider structure
- Anthropic Admin API client (organizations only)
- Progress bar component
- Auto-refresh mechanism (UsageMonitor, OAuthMonitor classes)
- Configuration file support (YAML with Zod validation)
- CLI binary with commands (--once, --help, --config, --oauth-only, --api-only)
- **OAuth rate limits tracking** (OpenCode + Claude Code credentials)
- OAuth credentials loader (OpenCode ~/.local/share/opencode/auth.json, Claude Code ~/.claude/.credentials.json)
- Profile info display (user, organization, plan badges)
- **tmux integration** (bin/opencode-with-monitor, bin/with-monitor, bin/setup)
- **OpenCode plugin** (rate_limits, monitor tools)
- **README.md documentation** (tmux guide 포함)

### 🎉 All Phases Complete!

## Architecture Decision

OpenCode/Crush는 Go로 작성된 터미널 TUI 애플리케이션으로, 플러그인을 통한 커스텀 UI 위젯 렌더링을 지원하지 않음.
(MCP Apps는 웹 기반 클라이언트 전용)

**채택된 솔루션**: tmux를 통한 side-by-side 통합
- 별도 패널에서 사용량 모니터 실행
- OpenCode와 자연스럽게 병행 사용
- `/monitor` 명령어로 tmux 상태 확인 및 설정 가이드 제공

## References

- Anthropic Admin API: https://docs.anthropic.com/en/api/admin-api
- Claude.ai Settings: https://claude.ai/settings/usage
- opencode: https://github.com/opencode-ai/opencode
