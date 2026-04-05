# QA 모드 보고 형식

Chalmers QA 모드에서 사용하는 보고 템플릿.

```
🧪 [QA 검증 결과] {스펙 이름}

Layer 1 — Static Check
  ✅ [파일명] 존재
  ✅ [함수명] 구현됨
  ❌ [항목] — FAIL: [오류 내용]

Layer 2 — DB State Check
  ✅ [테이블명] 테이블 존재
  ✅ 필수 컬럼 전부 확인
  ❌ [항목] — FAIL: [오류 내용]

Layer 3 — Runtime Check
  ✅ [AC-HP1] [AC 설명] — PASS
  ❌ [AC-HP2] [AC 설명] — FAIL
     오류: [오류 내용] ([파일:라인])
  ⏭️ [AC-HP3] [AC 설명] — SKIP (선행 AC 실패 또는 타임아웃)

결과: {n} PASS, {n} FAIL, {n} SKIP
→ {FAIL 있으면: 담당 에이전트에게 재작업 위임 중... / FAIL 없으면: ✅ 전체 PASS}
```

## 규칙
- FAIL 항목에는 반드시 파일:라인 참조 또는 구체적 오류 내용 포함
- SKIP은 선행 AC 실패 또는 타임아웃인 경우에만 사용
- 결과 요약 줄에 정확한 PASS/FAIL/SKIP 카운트 명시
- FAIL 위임 대상은 도메인별 에스컬레이션 경로(react-process.md §7) 참조
