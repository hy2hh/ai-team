---
name: upload-screenshot
description: >
  URL 스크린샷 촬영 또는 로컬 파일을 Slack에 업로드.
  Playwright로 촬영 → Slack Files API (getUploadURLExternal) 방식으로 업로드.
  트리거: "스크린샷 업로드", "screenshot upload", "Slack에 스크린샷", UI 검증 후 Slack 공유 필요 시.
---

# upload-screenshot 스킬

## 사용 패턴

### A. URL 촬영 후 업로드 (one-shot)
```bash
bash .claude/skills/upload-screenshot/scripts/screenshot-and-upload.sh \
  <url> <channel_id> [thread_ts] [title] [width]
```

예시:
```bash
# 대시보드 스크린샷 → #ai-team 스레드에 업로드
bash .claude/skills/upload-screenshot/scripts/screenshot-and-upload.sh \
  "http://localhost:3003/dashboard" \
  "C0ANKEB4CRF" \
  "1775542198.849469" \
  "대시보드 Apple 디자인 확인"
```

### B. 기존 파일만 업로드
```bash
bash .claude/skills/upload-screenshot/scripts/upload.sh \
  <file_path> <channel_id> [thread_ts] [title] [token_env_var]
```

예시:
```bash
bash .claude/skills/upload-screenshot/scripts/upload.sh \
  "/tmp/my-screenshot.png" \
  "C0ANKEB4CRF" \
  "1775542198.849469" \
  "UI 검증 스크린샷"
```

### C. Playwright만 촬영 (업로드 없이)
```bash
node .claude/skills/upload-screenshot/scripts/capture.js \
  <url> <output_path> [width] [height]
```

## 파라미터

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| url | 촬영할 URL (http/https/file://) | 필수 |
| channel_id | Slack 채널 ID | 필수 |
| thread_ts | 스레드 타임스탬프 | "" (채널 단독 포스팅) |
| title | 파일 제목 | 파일명 또는 Screenshot YYYY-MM-DD |
| width | 뷰포트 너비 (px) | 1440 |
| token_env_var | 사용할 봇 토큰 환경변수 | SLACK_BOT_TOKEN_FRONTEND |

## 내부 동작
1. `capture.js` — Playwright chromium으로 URL 촬영, 전체 body 높이 기준 fullpage
2. `upload.sh` — Slack `files.getUploadURLExternal` → PUT → `files.completeUploadExternal` (3단계 업로드)
3. 임시 파일 자동 삭제 (screenshot-and-upload.sh 사용 시)

## 스크린샷 촬영 시 필수 규칙 (모든 에이전트 공통)

> 이 규칙은 이 스킬을 사용하는 모든 에이전트에게 적용됩니다.

1. **스크린샷 요청 = 슬랙 업로드까지 완료** — `/tmp`에 저장만 하고 "확인했습니다"로 텍스트 보고하는 것은 금지.
2. **패턴 A 우선** — URL이 있으면 `screenshot-and-upload.sh` 한 번에 처리.
3. **이미 파일이 있으면 패턴 B** — `/tmp`에 파일이 존재하면 `upload.sh`로 슬랙 업로드.
4. **스레드 내 요청이면 `thread_ts` 필수** — 스레드에서 요청받은 경우 해당 스레드에 업로드.

## 주의사항
- Playwright(`@playwright/test`)가 node_modules에 설치되어 있어야 함 — 프로젝트 루트에서 실행 권장
- 로컬 서버 스크린샷은 서버가 실행 중이어야 함
- 토큰은 `.env`에서 자동 로드 (`SLACK_BOT_TOKEN_FRONTEND` 기본)
