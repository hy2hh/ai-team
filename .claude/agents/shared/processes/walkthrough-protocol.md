# Walkthrough Protocol

> 출처: Google Antigravity `walkthrough.md` 완료 보고 패턴

## 적용 대상
코드 수정을 동반하는 모든 작업 (Backend, Frontend, SecOps).

## 규칙

### 언제 작성하는가
- 기능 구현 완료 시
- 주요 리팩토링 완료 시
- 버그 수정 완료 시 (3개 이상 파일 수정)

### 저장 위치
`.memory/walkthroughs/YYYY-MM-DD_{topic}.md`

### 형식

```markdown
# Walkthrough: {작업 제목}

**날짜**: YYYY-MM-DD
**작업자**: {에이전트명}
**관련 커밋**: {hash 또는 커밋 메시지}

## 변경 요약
- {파일}: {무엇을 왜 변경했는지 1줄}
- {파일}: {무엇을 왜 변경했는지 1줄}

## 아키텍처 영향
- {변경으로 인해 달라진 구조적 사항. 없으면 "없음"}

## 검증 결과
- {어떤 테스트/검증을 수행했고 결과는 무엇인지}

## 주의사항
- {다음 작업자가 알아야 할 것. 없으면 "없음"}
```

### Slack 완료 보고와의 관계
- Slack 보고 = 간결한 요약 (1-3줄)
- Walkthrough = 상세 기록 (세션 간 컨텍스트 전달용)
- Slack 보고에 walkthrough 파일 경로를 포함한다
