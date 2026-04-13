#!/bin/bash
# setup-aliases.sh — 셸 단축키 등록 + watchdog LaunchAgent 설정
# 사용법:
#   bash scripts/setup-aliases.sh           — 단축키 설치 (zshrc/bashrc)
#   bash scripts/setup-aliases.sh watch:install  — watchdog LaunchAgent 등록
#   bash scripts/setup-aliases.sh watch:remove   — watchdog LaunchAgent 제거

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ─── 셸 단축키 설치 ────────────────────────────────────────────
install_aliases() {
  local shell_rc=""
  if [ -n "${ZSH_VERSION:-}" ] || [ "$(basename "${SHELL:-}")" = "zsh" ]; then
    shell_rc="$HOME/.zshrc"
  else
    shell_rc="$HOME/.bashrc"
  fi

  local marker="# ai-team aliases (auto-generated)"
  if grep -q "$marker" "$shell_rc" 2>/dev/null; then
    echo "✅ 단축키가 이미 등록되어 있습니다: $shell_rc"
    echo "   재설치하려면 해당 블록을 삭제 후 다시 실행하세요."
    return
  fi

  cat >> "$shell_rc" << EOF

$marker
alias ai-start="bash $PROJECT_DIR/scripts/start-all.sh"
alias ai-stop="bash $PROJECT_DIR/scripts/stop-all.sh"
alias ai-restart="bash $PROJECT_DIR/scripts/headless-ops.sh restart"
alias ai-status="bash $PROJECT_DIR/scripts/headless-ops.sh status"
alias ai-logs="bash $PROJECT_DIR/scripts/headless-ops.sh logs"
alias ai-watch="bash $PROJECT_DIR/scripts/watch-bridge.sh"
alias ai-incidents="cat $PROJECT_DIR/scripts/incidents.log 2>/dev/null || echo '인시던트 없음'"
alias ai-host-claim="make -C $PROJECT_DIR/scripts host-claim"
alias ai-host-release="make -C $PROJECT_DIR/scripts host-release"
alias ai-host-status="make -C $PROJECT_DIR/scripts host-status"
# make 단축키 (scripts/ 디렉토리 기준)
alias aim="make -C $PROJECT_DIR/scripts"
# ai-team aliases end
EOF

  echo "✅ 단축키 등록 완료: $shell_rc"
  echo ""
  echo "  적용 방법: source $shell_rc"
  echo ""
  echo "  사용 가능한 단축키:"
  echo "    ai-start       Bridge 시작"
  echo "    ai-stop        Bridge 종료"
  echo "    ai-restart     Bridge 안전 재시작"
  echo "    ai-status      연결 상태 확인"
  echo "    ai-logs        최근 로그 30줄"
  echo "    ai-watch       watchdog 즉시 실행"
  echo "    ai-incidents   인시던트 로그"
  echo "    aim <command>  make 단축키 (aim restart, aim status 등)"
}

# ─── Watchdog LaunchAgent 등록 ────────────────────────────────
watch_install() {
  local label="com.ai-team.watch-bridge"
  local plist="$HOME/Library/LaunchAgents/${label}.plist"

  if launchctl list | grep -q "$label"; then
    echo "✅ Watchdog LaunchAgent가 이미 등록되어 있습니다."
    return
  fi

  cat > "$plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${SCRIPT_DIR}/watch-bridge.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>StandardOutPath</key>
    <string>${SCRIPT_DIR}/watch.log</string>
    <key>StandardErrorPath</key>
    <string>${SCRIPT_DIR}/watch.log</string>
    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
PLIST

  launchctl bootstrap "gui/$(id -u)" "$plist"
  echo "✅ Watchdog LaunchAgent 등록 완료 (5분마다 실행)"
  echo "   로그: $SCRIPT_DIR/watch.log"
  echo "   확인: launchctl list | grep $label"
}

# ─── Watchdog LaunchAgent 제거 ────────────────────────────────
watch_remove() {
  local label="com.ai-team.watch-bridge"
  local plist="$HOME/Library/LaunchAgents/${label}.plist"

  if ! launchctl list | grep -q "$label"; then
    echo "ℹ️  등록된 watchdog LaunchAgent 없음"
    return
  fi

  launchctl bootout "gui/$(id -u)" "$plist"
  rm -f "$plist"
  echo "✅ Watchdog LaunchAgent 제거 완료"
}

# ─── Daily Summary LaunchAgent 등록 ──────────────────────────
summary_install() {
  local label="com.ai-team.daily-summary"
  local plist="$HOME/Library/LaunchAgents/${label}.plist"

  if launchctl list | grep -q "$label"; then
    echo "✅ Daily summary LaunchAgent가 이미 등록되어 있습니다."
    return
  fi

  cat > "$plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${PROJECT_DIR}/scripts/headless-ops.sh</string>
        <string>daily-summary</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>${SCRIPT_DIR}/summary.log</string>
    <key>StandardErrorPath</key>
    <string>${SCRIPT_DIR}/summary.log</string>
</dict>
</plist>
PLIST

  launchctl bootstrap "gui/$(id -u)" "$plist"
  echo "✅ Daily summary LaunchAgent 등록 완료 (매일 오전 9시)"
  echo "   로그: $SCRIPT_DIR/summary.log"
  echo "   확인: launchctl list | grep $label"
}

# ─── Daily Summary LaunchAgent 제거 ──────────────────────────
summary_remove() {
  local label="com.ai-team.daily-summary"
  local plist="$HOME/Library/LaunchAgents/${label}.plist"

  if ! launchctl list | grep -q "$label"; then
    echo "ℹ️  등록된 daily-summary LaunchAgent 없음"
    return
  fi

  launchctl bootout "gui/$(id -u)" "$plist"
  rm -f "$plist"
  echo "✅ Daily summary LaunchAgent 제거 완료"
}

# ─── 전체 설치 ─────────────────────────────────────────────────
install_all() {
  echo "=== 전체 자동화 설치 ==="
  echo ""
  install_aliases
  echo ""
  watch_install
  echo ""
  summary_install
  echo ""
  echo "=== 완료 ==="
  echo "적용: source ~/.zshrc"
  echo "확인: launchctl list | grep com.ai-team"
}

# ─── 진입점 ────────────────────────────────────────────────────
case "${1:-all}" in
  all)              install_all ;;
  install)          install_aliases ;;
  watch:install)    watch_install ;;
  watch:remove)     watch_remove ;;
  summary:install)  summary_install ;;
  summary:remove)   summary_remove ;;
  *)
    echo "사용법: $0 [all|install|watch:install|watch:remove|summary:install|summary:remove]"
    exit 1
    ;;
esac
