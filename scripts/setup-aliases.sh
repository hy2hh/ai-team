#!/bin/bash
# setup-aliases.sh — 셸 단축키 등록 + watchdog cron 설정
# 사용법:
#   bash scripts/setup-aliases.sh           — 단축키 설치 (zshrc/bashrc)
#   bash scripts/setup-aliases.sh watch:install  — watchdog cron 등록
#   bash scripts/setup-aliases.sh watch:remove   — watchdog cron 제거

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

# ─── Watchdog Cron 등록 ────────────────────────────────────────
watch_install() {
  local cron_cmd="*/5 * * * * bash $PROJECT_DIR/scripts/watch-bridge.sh >> $PROJECT_DIR/scripts/watch.log 2>&1"
  local marker="watch-bridge.sh"

  if crontab -l 2>/dev/null | grep -q "$marker"; then
    echo "✅ Watchdog cron이 이미 등록되어 있습니다."
    crontab -l | grep "$marker"
    return
  fi

  (crontab -l 2>/dev/null; echo "$cron_cmd") | crontab -
  echo "✅ Watchdog cron 등록 완료 (5분마다 실행)"
  echo "   로그: $PROJECT_DIR/scripts/watch.log"
  echo "   확인: crontab -l"
}

# ─── Watchdog Cron 제거 ────────────────────────────────────────
watch_remove() {
  local marker="watch-bridge.sh"

  if ! crontab -l 2>/dev/null | grep -q "$marker"; then
    echo "ℹ️  등록된 watchdog cron 없음"
    return
  fi

  crontab -l 2>/dev/null | grep -v "$marker" | crontab -
  echo "✅ Watchdog cron 제거 완료"
}

# ─── Daily Summary Cron 등록 ───────────────────────────────────
summary_install() {
  # 매일 오전 9시 발송
  local cron_cmd="0 9 * * * bash $PROJECT_DIR/scripts/headless-ops.sh daily-summary >> $PROJECT_DIR/scripts/summary.log 2>&1"
  local marker="daily-summary"

  if crontab -l 2>/dev/null | grep -q "$marker"; then
    echo "✅ Daily summary cron이 이미 등록되어 있습니다."
    crontab -l | grep "$marker"
    return
  fi

  (crontab -l 2>/dev/null; echo "$cron_cmd") | crontab -
  echo "✅ Daily summary cron 등록 완료 (매일 오전 9시)"
  echo "   로그: $PROJECT_DIR/scripts/summary.log"
  echo "   확인: crontab -l"
}

# ─── Daily Summary Cron 제거 ───────────────────────────────────
summary_remove() {
  local marker="daily-summary"

  if ! crontab -l 2>/dev/null | grep -q "$marker"; then
    echo "ℹ️  등록된 daily-summary cron 없음"
    return
  fi

  crontab -l 2>/dev/null | grep -v "$marker" | crontab -
  echo "✅ Daily summary cron 제거 완료"
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
  echo "확인: crontab -l"
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
