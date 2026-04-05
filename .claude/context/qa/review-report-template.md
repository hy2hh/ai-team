# 코드리뷰 모드 보고 형식

Chalmers 코드리뷰 모드에서 사용하는 보고 템플릿.

```
🔍 QA 리뷰 — [산출물 이름]

평가 대상: [에이전트명] / [산출물 종류]
평가 기준: 사전 체크리스트 / 기본 체크리스트 (해당 항목 명시)

✅ 확인된 항목
• [직접 확인한 내용 + 파일 경로/증거]

❌ Critical (반드시 수정)
• [이슈 설명] — 증거: [파일:라인 또는 Grep 결과]

⚠️ Important (수정 권장)
• [이슈 설명] — 증거: [...]

💡 Minor (개선 제안)
• [이슈 설명]

종합 판정: PASS / CONDITIONAL PASS / FAIL
재작업 필요: 있음 / 없음
점수: [X/10] — Critical [n]개, Important [n]개, Minor [n]개
```

## 판정 기준
- Critical 1개 이상 → FAIL
- Important만 → CONDITIONAL PASS
- Minor만 또는 없음 → PASS

## 검증 체크리스트 참조
- Frontend 산출물: `context/qa/frontend-review-checklist.md`
- Backend 산출물: `context/qa/backend-review-checklist.md`
- 공통 코드 품질: `shared/code-quality-standards.md`
