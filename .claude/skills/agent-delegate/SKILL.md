---
name: agent-delegate
description: Use when delegating tasks to other agents or receiving delegated work
---

# Task Delegation Protocol

## 위임 시 (Delegating)

### 필수 포함 정보
1. **What**: 산출물의 명확한 설명
2. **Why**: 맥락과 동기
3. **When**: 우선순위 (urgent / normal / low)
4. **Dependencies**: 선행/후행 의존성
5. **Spec**: 관련 스펙 파일 경로 (있는 경우)

### 스펙 확인 (2+ 에이전트 협업 시)
`docs/specs/`에 Feature Spec 존재 여부 확인. 없으면 PM에게 작성 요청.

### 위임 메시지 형식
```
@[에이전트명] [Task 제목] 위임합니다.

### Task Description
[전체 텍스트. "계획서 참조" 금지]

### Context
- 전체 흐름에서의 위치
- 선행 의존성 / 후행 작업

### Files
- Create/Modify: `정확한/파일/경로.ts`

### Verification
[완료 확인 명령어 + 예상 출력]

### Before You Begin
불명확한 점 → 코드 작성 전 질문. 추측 진행 금지.

### Escalation
막히면 멈추고 보고. 페널티 없음.
```

### Task 업데이트
`.memory/tasks/active-{delegatee-role}.md`에 새 Task 기록

## 수신 시 (Receiving)

### 응답 프로토콜
1. **위임 맥락 표시** (첫 줄 필수): `_위임자로부터 위임받았습니다 — 위임 이유_`
2. `.memory/`에서 관련 컨텍스트 확인
3. 작업 실행
4. 스레드에 완료 보고
5. `.memory/tasks/` 업데이트

### 상태 코드
| 상태 | 의미 | 다음 행동 |
|------|------|---------|
| **DONE** | 요구사항 충족 | Spec Review 진행 |
| **DONE_WITH_CONCERNS** | 우려 있음 | Marge 평가 |
| **BLOCKED** | 진행 불가 | Marge 해결 |
| **NEEDS_CONTEXT** | 추가 정보 필요 | 정보 제공 대기 |

## Cross-Verification

### 완료 트리거
- Cross-verification 전원 PASS → **즉시** 완료 보고 발송. 대기 금지.
- 위임 조율자(PM)가 전체 흐름의 완료 선언 책임

### WARN/FAIL 처리
- **WARN**: 경고 내용을 완료 보고에 명시 + 후속 조치 계획
- **FAIL**: 이슈 수정 → 재검증 PASS 후 보고

## 책임 회피 금지 패턴
- ❌ "확인이 필요하다면", "검증해볼까요"
- ❌ "Homer가 했으니 Homer가 보고"
- ❌ 완료 보고 없이 다른 에이전트에게 위임만 하기
