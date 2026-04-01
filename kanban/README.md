# Kanban Dashboard

AI Team 칸반 보드 — 에이전트 작업 상태를 시각적으로 추적합니다.

## 구조

```
kanban/
  backend/   — Express + SQLite API 서버 (port 3001)
  frontend/  — Next.js 웹 UI (port 3000)
```

## 실행

### 백엔드 (port 3001)

```bash
cd kanban/backend
npm install
npx ts-node-dev --respawn --transpile-only src/index.ts
```

### 프론트엔드 (port 3000)

```bash
cd kanban/frontend
npm install
npm run dev
```

### tmux로 백그라운드 실행

```bash
# 백엔드
tmux new-session -d -s kanban-backend -c kanban/backend \
  'npx ts-node-dev --respawn --transpile-only src/index.ts'

# 프론트엔드
tmux new-session -d -s kanban-frontend -c kanban/frontend \
  'npm run dev'
```

## 확인

```bash
# 백엔드 API
curl http://localhost:3001/boards/1

# 프론트엔드
open http://localhost:3000
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/boards/:id` | 보드 전체 조회 |
| POST | `/cards` | 카드 생성 |
| PATCH | `/cards/:id` | 카드 수정 |
| PATCH | `/cards/:id/move` | 카드 이동 (column, position) |
| DELETE | `/cards/:id` | 카드 삭제 |
