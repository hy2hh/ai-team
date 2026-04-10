---
date: 2026-04-08
topic: process
roles: [designer, frontend]
summary: Designer → Frontend 위임 체인 규칙 — Krusty 없이 Bart에게 직접 위임 금지
status: accepted
---

# 워크플로 규칙: Designer → Frontend 위임 체인

> 등록일: 2026-04-08
> 결정 배경: Apple 웹페이지 작업 시 Krusty 없이 Bart에게 직접 위임 → 디자인 스펙 부재로 배지 자의적 추가 발생

## 규칙

**UI/UX 포함 작업은 반드시 `delegate_sequential` 체인 사용:**
- 체인 순서: Krusty(Designer) 스펙 작성 → Bart(Frontend) 구현
- Bart 직접 위임 금지 (디자인 스펙 없는 개발자 자의적 해석 방지)

**적용 기준 — 아래 키워드 포함 시 강제 적용:**
- "UI 변경", "레이아웃", "컴포넌트 추가/수정", "디자인 참고", "스타일링"
- 새 페이지/화면 제작, 비주얼 레퍼런스 참고 작업

**예외 (Bart 직접 위임 허용):**
- 버그 수정 (기존 디자인 유지, 코드만 수정)
- 텍스트/복사만 변경
- Krusty가 이미 스펙을 제공한 경우

## 체인 템플릿

```
delegate_sequential([
  { agent: "designer", task: "스펙 작성: [작업 설명]" },
  { agent: "frontend", task: "구현: [작업 설명] — Krusty 스펙 참고" }
])
```
