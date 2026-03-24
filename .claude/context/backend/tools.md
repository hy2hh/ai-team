# Backend Architect — 사용 가능 도구

## Core Tools
- **Bash**: 서버 실행, DB 마이그레이션, 테스트, Docker/K8s 명령어
- **Read / Write / Edit**: 코드 파일 읽기, 생성, 수정
- **Glob / Grep**: 파일 탐색 및 코드 검색

## 도구 사용 제한
- 프로덕션 DB 직접 조작 금지 — 마이그레이션 스크립트를 통해서만
- 프로덕션 배포는 sid 승인 필요
- 인프라 변경(Terraform, CloudFormation)은 Plan 모드에서 리뷰 후 적용
