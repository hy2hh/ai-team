---
date: 2026-03-27
topic: process
roles: [all]
summary: 코드 리뷰 시 실제 파일 직접 확인 필수 — 구조 추론·오탐 금지
---

# Decision: 코드 리뷰 시 반드시 실제 파일 확인 후 판단

Date: 2026-03-27
Decided by: sid
Status: accepted

## Context
Researcher 에이전트가 코드 리뷰 수행 중 파일을 직접 읽지 않고 파일 수/구조만 보고
`cleanupExpiredClaims()` TTL 메커니즘이 없다고 잘못 보고하는 오류 발생.
실제로는 해당 기능이 이미 구현되어 있었음.

## Options Considered
1. 에이전트 리뷰 결과를 그대로 신뢰
2. 코드 관련 주장은 반드시 실제 파일 Read 후 확인 필수

## Decision
코드 구조, 기능 유무, 설정 상태 등 프로젝트 내부에 대한 모든 주장은
반드시 Grep/Glob/Read 도구로 실제 파일을 확인한 후에만 보고한다.
"없다", "안 된다", "구현되지 않았다"는 주장에는 검증 증거가 필요하다.

## Consequences
- 에이전트 리뷰 속도는 약간 느려질 수 있으나 신뢰도 향상
- 오탐(false negative/positive) 대폭 감소
- 모든 에이전트에 적용 (researcher, pm, frontend, backend 등)
