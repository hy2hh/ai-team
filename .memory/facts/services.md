---
date: 2026-04-01
topic: operations
roles: [all]
summary: 외부 서비스 레지스트리 — Slack, Claude API 등 식별자 (인증정보는 .env 관리)
status: accepted
---

# External Services Registry

> 프로젝트별 외부 서비스 식별자. 인증 정보(토큰, API 키)는 .env에 관리.

## 사용법
- 프로젝트 시작 시 해당 프로젝트 섹션 추가
- 서비스 변경 시 이 파일 직접 업데이트
- 에이전트는 필요 시 Read로 로드
- **쓰기 권한**: 서비스를 실제로 사용하는 에이전트가 직접 작성 (PM 승인 불필요). 표의 `담당` 컬럼이 서비스별 주담당 에이전트를 명시.

## (프로젝트명 예시: project-alpha)

| Category | Service | Identifier | 담당 |
|----------|---------|------------|------|
| Code | GitHub | (repo URL) | Frontend, Backend, SecOps |
| Planning | Jira | (project key) | PM |
| Planning | Confluence | (space key) | PM |
| Design | Figma | (file key) | Designer |
| Frontend | Vercel | (project URL) | Frontend |
| Backend | AWS | (region / cluster) | Backend |
| Security | Snyk | (org/project) | SecOps |
