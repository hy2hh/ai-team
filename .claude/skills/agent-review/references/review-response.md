# Code Review Response Template

리뷰 결과를 Slack 스레드에 보고할 때 이 포맷을 사용한다.

---

```
## 리뷰 결과

**리뷰어**: @[에이전트명]
**대상**: [리뷰 요청 요약]

### Strengths
- [잘 된 부분 — 구체적 기술 근거와 함께]

### Issues

#### Critical
- **[파일:라인]**: [문제 설명]. 수정 방안: [구체적 코드/접근 제시]

#### Important
- **[파일:라인]**: [문제 설명]. 수정 방안: [구체적 코드/접근 제시]

#### Minor
- **[파일:라인]**: [문제 설명]. 제안: [개선 방향]

### Assessment
**Verdict**: APPROVE / APPROVE_WITH_CHANGES / REQUEST_CHANGES / BLOCK

[1-2문장으로 전체 판단 근거]
```

---

## Verdict 기준

| Verdict | 의미 |
|---------|------|
| APPROVE | Critical/Important 이슈 없음. 병합 가능. |
| APPROVE_WITH_CHANGES | Minor 이슈만 있음. 수정 후 재리뷰 불필요. |
| REQUEST_CHANGES | Important 이슈 있음. 수정 후 재리뷰 필요. |
| BLOCK | Critical 이슈 있음. 즉시 수정 필수. 병합 차단. |
