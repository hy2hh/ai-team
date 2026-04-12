# AI Team — 운영 단축키
# 사용법: make <command>
# 설치: make 는 macOS 기본 포함

SCRIPT_DIR  := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))
PROJECT_DIR := $(shell dirname $(SCRIPT_DIR))

.PHONY: start stop restart status logs watch watch-install watch-remove summary summary-install summary-remove setup help

## 서비스 관리
start:       ## Bridge 시작
	bash $(PROJECT_DIR)/scripts/start-all.sh

start-local: ## Bridge 시작 (로컬 claude 계정)
	bash $(PROJECT_DIR)/scripts/start-all.sh local

stop:        ## Bridge 종료
	bash $(PROJECT_DIR)/scripts/stop-all.sh

restart:     ## Bridge 안전 재시작
	bash $(PROJECT_DIR)/scripts/headless-ops.sh restart

restart-force: ## Bridge 강제 재시작 (작업 중인 에이전트 있어도)
	bash $(PROJECT_DIR)/scripts/headless-ops.sh restart force

## 모니터링
status:      ## Bridge 연결 상태 확인
	bash $(PROJECT_DIR)/scripts/headless-ops.sh status

logs:        ## Bridge 최근 로그 30줄
	bash $(PROJECT_DIR)/scripts/headless-ops.sh logs

logs-tail:   ## Bridge 로그 실시간 (Ctrl+C로 종료)
	tmux capture-pane -t ai-team-bridge -p | tail -50

watch:       ## Bridge 상태 즉시 점검 (watchdog 1회 실행)
	bash $(PROJECT_DIR)/scripts/watch-bridge.sh

incidents:   ## 인시던트 로그 확인
	@if [ -f $(PROJECT_DIR)/scripts/incidents.log ]; then \
		cat $(PROJECT_DIR)/scripts/incidents.log; \
	else \
		echo "인시던트 없음"; \
	fi

## Watchdog cron 설정
watch-install: ## Watchdog cron 등록 (5분마다 자동 감시)
	@bash $(PROJECT_DIR)/scripts/setup-aliases.sh watch:install

watch-remove: ## Watchdog cron 제거
	@bash $(PROJECT_DIR)/scripts/setup-aliases.sh watch:remove

summary:         ## 일일 인시던트 요약 즉시 발송
	bash $(PROJECT_DIR)/scripts/headless-ops.sh daily-summary

summary-install: ## Daily summary cron 등록 (매일 오전 9시)
	@bash $(PROJECT_DIR)/scripts/setup-aliases.sh summary:install

summary-remove:  ## Daily summary cron 제거
	@bash $(PROJECT_DIR)/scripts/setup-aliases.sh summary:remove

setup:           ## 전체 자동화 한번에 설치 (단축키 + watchdog + daily summary)
	@bash $(PROJECT_DIR)/scripts/setup-aliases.sh all

## 멀티-머신 호스트 관리
host-claim:  ## 이 머신을 bridge 호스트로 등록 (watchdog 활성화)
	@echo "$$(hostname)" > $(SCRIPT_DIR)/.bridge-host && echo "✅ 호스트 등록: $$(hostname)"

host-release: ## bridge 호스트 등록 해제 (watchdog 비활성화)
	@rm -f $(SCRIPT_DIR)/.bridge-host && echo "✅ 호스트 등록 해제"

host-status: ## 현재 bridge 호스트 확인
	@if [ -f $(SCRIPT_DIR)/.bridge-host ]; then \
		registered=$$(cat $(SCRIPT_DIR)/.bridge-host); \
		current=$$(hostname); \
		if [ "$$registered" = "$$current" ]; then \
			echo "✅ 이 머신이 호스트: $$registered"; \
		else \
			echo "⚠️  다른 머신이 호스트: $$registered (현재: $$current)"; \
		fi; \
	else \
		echo "❌ 호스트 미등록 (ai-start 또는 make host-claim 실행)"; \
	fi

## 도움말
help:        ## 이 도움말
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
