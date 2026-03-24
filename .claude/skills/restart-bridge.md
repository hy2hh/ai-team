---
name: restart-bridge
description: Socket bridge 프로세스를 안전하게 재시작합니다
user_invocable: true
---

# Socket Bridge 재시작

다음 단계를 순서대로 실행하세요:

## 1. 기존 프로세스 종료
```bash
# tsx src/index.ts 프로세스 모두 찾아서 종료
pkill -f "tsx src/index.ts" 2>/dev/null
sleep 2
```

## 2. 프로세스 완전 종료 확인
```bash
# 남아있는 프로세스가 없는지 확인
ps aux | grep "tsx src/index.ts" | grep -v grep
```
- 결과가 있으면 `kill -9 <PID>`로 강제 종료
- 결과가 없으면 정상

## 3. socket-bridge 디렉토리에서 재시작
```bash
cd /Users/sid/git/ai-team/socket-bridge
npx tsx src/index.ts &
```

## 4. 연결 확인 (10초 대기 후)
로그에서 다음을 확인:
- `[init]` 6개 에이전트 botUserId 출력
- `[start]` 6/6 연결 완료
- `Agent SDK 런타임 활성` 메시지

## 5. 결과 보고
- 성공: "Bridge 재시작 완료 — 6/6 연결 정상"
- 실패: 에러 로그 포함하여 보고
