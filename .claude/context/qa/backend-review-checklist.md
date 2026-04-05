# Backend Review Checklist

백엔드 산출물(Backend/SecOps) 코드 리뷰 시 사용하는 검증 체크리스트.
OWASP Top 10 + Node.js/Express 보안 가이드라인 기반. 위반 발견 시 심각도 분류 후 보고.

---

## 1. SQL/데이터베이스 위반

### Critical
- [ ] 문자열 연결 SQL 쿼리 (SQL injection 취약)
- [ ] ORM raw query에 사용자 입력 직접 삽입
- [ ] DB 마이그레이션에 롤백 전략 없음
- [ ] 트랜잭션 없이 다중 테이블 수정

### Important
- [ ] N+1 쿼리 패턴 (루프 내 개별 쿼리)
- [ ] 인덱스 없는 WHERE/JOIN 컬럼
- [ ] Connection pool 미설정 또는 기본값 사용
- [ ] 대량 데이터 페이지네이션 없음

### 검증 방법
Grep 도구로 다음 패턴 검색:
- SQL injection: `query.*\`.*\$\{` 패턴 (*.ts, *.js)
- N+1: 루프(for/forEach/map) 내부의 await query/find/select 패턴

---

## 2. 인증/인가 위반

### Critical
- [ ] 인증 미들웨어 누락 (보호 엔드포인트에 미적용)
- [ ] 하드코딩된 시크릿/토큰/비밀번호
- [ ] JWT 검증 없이 페이로드 신뢰
- [ ] 권한 체크 없는 리소스 접근 (IDOR 취약)

### Important
- [ ] 비밀번호 평문 저장 (bcrypt/argon2 미사용)
- [ ] JWT 만료 시간 미설정 또는 과도하게 긴 설정 (>24h)
- [ ] Rate limiting 미적용
- [ ] CORS 설정 와일드카드(*) 사용

### 검증 방법
Grep 도구로 다음 패턴 검색:
- 하드코딩 시크릿: `password\s*=\s*["']` 또는 `secret\s*=\s*["']` (test/example 제외)
- 인증 미적용 라우트: `router.(get|post|put|delete)` 중 auth/middleware 미포함 라인

---

## 3. 입력 검증/출력 인코딩 위반

### Critical
- [ ] 사용자 입력 무검증 (req.body/req.params/req.query 직접 사용)
- [ ] Command injection 취약 (child_process에 사용자 입력 — execFileNoThrow 사용 필수)
- [ ] Path traversal 취약 (파일 경로에 사용자 입력)
- [ ] 에러 메시지에 스택 트레이스/내부 정보 노출

### Important
- [ ] 요청 바디 크기 제한 없음
- [ ] 파일 업로드 타입/크기 미검증
- [ ] Content-Type 미검증

### 검증 방법
Grep 도구로 다음 패턴 검색:
- 입력 무검증: `req.body.|req.params.|req.query.` 중 validate/schema/zod/joi 미포함
- 위험한 프로세스 실행: child_process 직접 사용 여부 (execFileNoThrow 대신 사용 시 위반)

---

## 4. API 설계 위반

### Critical
- [ ] 에러 응답 형식 불일치 (일관된 에러 스키마 없음)
- [ ] HTTP 상태 코드 오용 (200 OK에 에러 본문)

### Important
- [ ] REST 동사 불일치 (GET에 부수효과, POST에 조회)
- [ ] 응답 페이로드 과다 (필요 이상 데이터 반환)
- [ ] 타임아웃 미설정 (외부 서비스 호출)

### 검증 방법
Grep 도구로 다음 패턴 검색:
- 에러 응답 형식: `res.status` 및 `res.json.*error` 패턴의 일관성 확인
- HTTP 메서드: `router.(get|post|put|delete|patch)` 패턴으로 REST 규칙 대조

---

## 5. 성능/확장성 위반

### Critical
- [ ] 동기 블로킹 I/O (readFileSync 등 프로덕션 코드)
- [ ] 메모리 누수 (이벤트 리스너 미해제, 스트림 미닫기)

### Important
- [ ] 캐싱 전략 없음 (반복 DB 조회에 캐시 미적용)
- [ ] 로깅 과다 (프로덕션에서 debug 로그 활성)
- [ ] Health check 엔드포인트 없음
- [ ] Graceful shutdown 미구현

### 검증 방법
Grep 도구로 다음 패턴 검색:
- 동기 I/O: `readFileSync|writeFileSync|existsSync` (test 제외)
- 리스너 누수: `.on(` 호출 중 대응하는 `.off(` 또는 `removeListener` 없는 경우

---

## 6. 에러 핸들링/복원력 위반

### Critical
- [ ] 전역 에러 핸들러 없음 (uncaughtException/unhandledRejection)
- [ ] async 함수에 try-catch 없음
- [ ] 외부 서비스 호출에 재시도/서킷 브레이커 없음

### Important
- [ ] 에러 로깅 누락 (catch 블록에서 무시)
- [ ] 트랜잭션 롤백 미처리

### 검증 방법
Grep 도구로 다음 패턴 검색:
- 빈 catch 블록: `catch` 다음 2줄 내에 빈 `}` 패턴
- 전역 핸들러: `uncaughtException|unhandledRejection` 존재 여부

---

## 7. 환경/설정 위반

### Critical
- [ ] .env 파일 git 추적 (.gitignore 미설정)
- [ ] 프로덕션 시크릿 코드 내 하드코딩

### Important
- [ ] .env.example 없음 (필요 환경변수 문서화 미흡)
- [ ] 환경변수 기본값 없이 직접 참조 (undefined 위험)
- [ ] 설정 검증 없음 (서버 시작 시 필수 환경변수 미체크)

### 검증 방법
- .gitignore에 `.env` 포함 확인
- `process.env.` 참조 중 `||` 또는 `??` 기본값 없는 라인 검출

---

## 심각도 기준

| 심각도 | 기준 | 조치 |
|--------|------|------|
| **Critical** | 보안 취약점, 데이터 손실 위험, 런타임 장애 | 즉시 수정 필수, FAIL 판정 |
| **Important** | 성능 저하, 아키텍처 위반, 운영 리스크 | 수정 권고, CONDITIONAL PASS 가능 |
| **Minor** | 개선 여지, 일관성 부족, 문서화 누락 | 기록 후 PASS 가능 |
