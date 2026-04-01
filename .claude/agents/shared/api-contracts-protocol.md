> ⚠️ 이 파일은 `/agent-api-contract` 스킬로 이전되었습니다. `.claude/skills/agent-api-contract/SKILL.md` 참조.

# API Contracts Protocol

> 출처: Emergent `contracts.md` 프론트/백 통합 프로토콜

## 적용 대상
Homer (Backend) ↔ Bart (Frontend) 간 API 연동 시.

## 규칙

### Contract 파일 위치
`.memory/contracts/{api-name}.md`

### 언제 작성하는가
- 새 API 엔드포인트 설계 시 (구현 전)
- 기존 API 스키마 변경 시
- 프론트엔드가 새 데이터를 요구할 때

### 작성 주체
- **신규 API**: Homer가 초안 작성 → Bart 리뷰 → 합의 후 구현
- **변경 요청**: 요청하는 쪽이 변경 제안 → 상대방 리뷰

### Contract 형식

```markdown
# API Contract: {엔드포인트명}

**상태**: draft | agreed | implemented | deprecated
**작성**: {에이전트명} | **리뷰**: {에이전트명}

## Endpoint
- Method: GET | POST | PUT | DELETE
- Path: `/api/v1/...`

## Request
```json
{
  "field": "type — 설명"
}
```

## Response (200)
```json
{
  "field": "type — 설명"
}
```

## Error Responses
| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_INPUT | 입력 유효성 실패 |
| 401 | UNAUTHORIZED | 인증 필요 |
| 404 | NOT_FOUND | 리소스 없음 |

## 예시
Request → Response 쌍 1개 이상.
```

### 프로세스
1. Contract draft 작성
2. 상대 에이전트 리뷰 (Slack @mention)
3. 합의 → 상태를 `agreed`로 변경
4. 구현 완료 → 상태를 `implemented`로 변경
5. **Contract 없이 API 구현 금지** — 합의 전 코드 작성 시작 금지

### 변경 관리
- 기존 contract 변경 시 하위 호환성 우선
- Breaking change는 반드시 sid 승인 + 양쪽 에이전트 합의
