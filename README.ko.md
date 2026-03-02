[English](README.md) | **한국어**

# Agentic Usage Monitor

AI 코딩 에이전트(Claude Code, OpenCode)를 위한 실시간 Claude 사용 제한 모니터링 (tmux 사용).

```
╭─────────────────── Claude Rate Limits ───────────────────╮
│                    ┌────────────────┐                    │
│                    │ Plenty of room │                    │
│                    └─┬──────────────┘                    │
│                         ▗▟███▙▖                          │
│                        ▐█ ◠ ◠ █▌                         │
│                        ▐█▄▄▄▄▄█▌                         │
│                         ▀█████▀                          │
├──────────────────────────────────────────────────────────┤
│ User: Duchang                                            │
│ Org:  duchang.dev@gmail.com's Organization               │
│ Plan: MAX                                                │
├──────────────────────────────────────────────────────────┤
│ 5-Hour: ━░░░░░░░░░░░░░░░░░░░░░░░░░░   4% (2h 22m)        │
│ 7-Day:  ━━━░░░░░░░░░░░░░░░░░░░░░░░░  10% (3d 19h)        │
├──────────────────────────────────────────────────────────┤
│ Updated: 11:11:11 PM                                     │
╰──────────────────────────────────────────────────────────╯

● Running | Refresh: 30s

q:exit  e:config  E:apply
```

## 설치

### Homebrew (macOS / Linux)

```bash
brew install duchangkim/tap/usage-monitor
```

### 독립 실행 파일 (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/duchangkim/agentic-usage-monitor/main/install.sh | sh
```

운영 체제/아키텍처를 감지하고 `~/.local/bin/`에 설치하며 체크섬을 검증합니다.

### Windows (실험적)

```powershell
irm https://raw.githubusercontent.com/duchangkim/agentic-usage-monitor/main/install.ps1 | iex
```

`%LOCALAPPDATA%\usage-monitor\`에 설치하고 PATH에 추가합니다. PowerShell 5.1+가 필요합니다.

> **참고:** Windows 지원은 실험적입니다. tmux는 Windows에서 사용할 수 없으므로 `launch` 및 에이전트 하위 명령은 대신 Windows Terminal 창 분할을 사용합니다.

### 사전 요구 사항

**tmux**는 `launch` 및 에이전트 하위 명령에 필요합니다 (macOS/Linux 전용):

```bash
brew install tmux       # macOS
sudo apt install tmux   # Ubuntu/Debian
```

## 사용법

### 에이전트 하위 명령

하나의 명령으로 에이전트와 모니터를 나란히 실행합니다:

```bash
usage-monitor claude     # Claude Code + claude-code credentials
usage-monitor opencode   # OpenCode + opencode credentials
```

### 임의 명령과 함께 실행

```bash
usage-monitor launch -- opencode              # 모니터가 오른쪽 (기본값)
usage-monitor launch -t -- opencode           # 모니터가 위쪽
usage-monitor launch -b -- claude             # 모니터가 아래쪽
usage-monitor launch -l -- nvim .             # 모니터가 왼쪽
usage-monitor launch -s myproject -- opencode # 명명된 세션
```

### 독립 실행 모니터

```bash
usage-monitor                     # 자동 새로고침 모드 (30초)
usage-monitor --once              # 한 번만 표시 후 종료
usage-monitor --compact           # 최소 3줄 모드
usage-monitor --source opencode   # 특정 자격 증명 소스
```

### 옵션

| Flag | Description |
| --- | --- |
| `--once`, `-1` | 한 번만 사용량을 표시하고 종료 |
| `--compact` | 최소 표시 모드 |
| `--source <src>` | 자격 증명 소스: `auto` (기본값), `claude-code`, `opencode` |
| `--theme <name>` | 색상 테마 (nord, dracula, github 등) |
| `--config <path>` | 설정 파일 경로 |
| `--help`, `-h` | 도움말 표시 |
| `--version`, `-v` | 버전 표시 |

### 자체 업데이트 / 제거

```bash
usage-monitor update      # 최신 버전으로 업데이트
usage-monitor uninstall   # 시스템에서 제거
```

## 개발

```bash
git clone https://github.com/duchangkim/agentic-usage-monitor
cd agentic-usage-monitor

bun install          # 종속성 설치
bun run build        # 빌드
bun run typecheck    # 타입 체크
bun run lint         # 린트
bun run cli --once   # 로컬 실행
```

### 테스트

```bash
bun test                  # 모든 테스트
bun run test:e2e          # E2E 테스트
bun run test:e2e:docker   # Docker에서 E2E 테스트 (격리된 환경)
bun run mock-server       # 모의 OAuth 서버 시작
```

## 라이선스

MIT