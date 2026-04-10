# Kanban Backend API Reference

## Overview

`kanban/backend`는 칸반 보드의 CRUD 연산을 담당하는 Express.js REST API입니다. SQLite 데이터베이스를 사용하여 보드, 컬럼, 카드를 관리하며, WebSocket 브로드캐스트를 통해 실시간 동기화를 지원합니다.

**주요 기능:**
- 보드 조회 (단건/목록)
- 카드 CRUD 연산
- 카드 이동 (컬럼 간 이동 및 위치 관리)
- WIP(Work In Progress) 제한 적용
- 태그, 우선순위, 진행률 관리
- 대량 삭제 (정리/클린업)
- 실시간 브로드캐스트

---

## Base URL

```
http://localhost:3001
```

---

## Data Types

### Board

```typescript
interface Board {
  id: number;                // Board ID (PK)
  name: string;             // Board name
  created_at: string;       // ISO 8601 timestamp
}
```

### Column

```typescript
interface Column {
  id: number;               // Column ID (PK)
  board_id: number;         // Reference to Board
  name: string;             // Column name (e.g., "Todo", "In Progress", "Done")
  position: number;         // Display order (0-based)
  wip_limit: number | null; // Work In Progress limit (null = unlimited)
}
```

### Card

```typescript
interface Card {
  id: number;                          // Card ID (PK)
  column_id: number;                   // Reference to Column
  title: string;                       // Card title (required)
  description: string | null;          // Card description (markdown supported)
  priority: 'low' | 'medium' | 'high'; // Priority level
  assignee: string | null;             // Assigned user ID
  progress: number;                    // Progress percentage (0-100)
  position: number;                    // Position within column (0-based)
  due_date: string | null;             // ISO 8601 date (YYYY-MM-DD)
  tags: string[];                      // Array of tag strings (max 50 chars each)
  session_id: string | null;           // Reference to agent session (optional)
  created_at: string;                  // ISO 8601 timestamp
  updated_at: string;                  // ISO 8601 timestamp
}
```

### BoardSummary

```typescript
interface BoardSummary extends Board {
  columns: Array<Column & { cards: Card[] }>;
}
```

### CardActivity

```typescript
interface CardActivity {
  id: number;
  card_id: number;
  action: 'created' | 'moved' | 'progress_updated' | 'assignee_changed' | 'commented' | 'updated';
  agent: string | null;              // Agent that made the change
  detail: string;                    // Action detail/reason
  created_at: string;
}
```

---

## API Endpoints

### Boards

#### GET /boards
**Description:** List all boards

**Query Parameters:** None

**Response:**
```json
[
  {
    "id": 1,
    "name": "AI Team Sprint",
    "created_at": "2026-04-01T10:00:00Z"
  }
]
```

**Status Codes:**
- 200: Success

---

#### GET /boards/:id
**Description:** Get board with all columns and cards (hierarchical view)

**URL Parameters:**
- `:id` (number) — Board ID

**Response:**
```json
{
  "id": 1,
  "name": "AI Team Sprint",
  "created_at": "2026-04-01T10:00:00Z",
  "columns": [
    {
      "id": 1,
      "board_id": 1,
      "name": "Todo",
      "position": 0,
      "wip_limit": 5,
      "cards": [
        {
          "id": 1,
          "column_id": 1,
          "title": "API 문서화",
          "description": "Socket-bridge 아키텍처 문서화",
          "priority": "high",
          "assignee": "Backend",
          "progress": 50,
          "position": 0,
          "due_date": "2026-04-15",
          "tags": ["documentation", "backend"],
          "session_id": null,
          "created_at": "2026-04-11T08:00:00Z",
          "updated_at": "2026-04-11T10:30:00Z"
        }
      ]
    }
  ]
}
```

**Status Codes:**
- 200: Success
- 404: Board not found

**Performance Notes:**
- Uses single JOIN query to fetch all columns and cards
- Prevents N+1 query problem
- O(1) database round trip per board

---

### Cards

#### GET /cards
**Description:** Get cards in a specific column

**Query Parameters:**
- `columnId` (number, required) — Column ID

**Response:**
```json
[
  {
    "id": 1,
    "column_id": 1,
    "title": "API 문서화",
    "description": "Socket-bridge 아키텍처 문서화",
    "priority": "high",
    "assignee": "Backend",
    "progress": 50,
    "position": 0,
    "due_date": "2026-04-15",
    "tags": ["documentation", "backend"],
    "session_id": null,
    "created_at": "2026-04-11T08:00:00Z",
    "updated_at": "2026-04-11T10:30:00Z"
  }
]
```

**Status Codes:**
- 200: Success
- 400: Missing `columnId` query parameter

---

#### POST /cards
**Description:** Create a new card in a column

**Request Body:**
```json
{
  "column_id": 1,                              // required
  "title": "API 문서화",                       // required
  "description": "Socket-bridge 아키텍처...", // optional
  "priority": "high",                         // default: "medium"
  "assignee": "Backend",                      // optional
  "progress": 0,                              // default: 0
  "due_date": "2026-04-15",                   // optional (YYYY-MM-DD)
  "tags": ["documentation", "backend"],       // optional
  "session_id": "sess-123"                    // optional
}
```

**Response:**
```json
{
  "id": 1,
  "column_id": 1,
  "title": "API 문서화",
  "description": "Socket-bridge 아키텍처...",
  "priority": "high",
  "assignee": "Backend",
  "progress": 0,
  "position": 0,
  "due_date": "2026-04-15",
  "tags": ["documentation", "backend"],
  "session_id": "sess-123",
  "created_at": "2026-04-11T08:00:00Z",
  "updated_at": "2026-04-11T08:00:00Z"
}
```

**Status Codes:**
- 201: Created
- 400: Missing required fields (`column_id`, `title`)

**Business Logic:**
- Position automatically set to max+1 (bottom of column)
- Progress clamped to 0-100 range
- Tags sanitized (max 50 chars each, duplicates filtered)
- due_date validated as ISO 8601 date

---

#### PATCH /cards/:id
**Description:** Update card fields (partial update)

**URL Parameters:**
- `:id` (number) — Card ID

**Request Body (all optional):**
```json
{
  "title": "새 제목",
  "description": "새로운 설명",
  "priority": "high",
  "assignee": "Frontend",
  "progress": 75,
  "due_date": "2026-04-20",
  "tags": ["ui", "frontend"]
}
```

**Response:**
```json
{
  "id": 1,
  "column_id": 1,
  "title": "새 제목",
  "description": "새로운 설명",
  "priority": "high",
  "assignee": "Frontend",
  "progress": 75,
  "position": 0,
  "due_date": "2026-04-20",
  "tags": ["ui", "frontend"],
  "session_id": null,
  "created_at": "2026-04-11T08:00:00Z",
  "updated_at": "2026-04-11T11:00:00Z"
}
```

**Status Codes:**
- 200: Success
- 400: No fields provided for update
- 404: Card not found

**Side Effects:**
- `updated_at` automatically updated to current time
- Triggers `card:updated` broadcast event

---

#### PATCH /cards/:id/move
**Description:** Move card to a different column and/or position

**URL Parameters:**
- `:id` (number) — Card ID

**Request Body:**
```json
{
  "column_id": 2,    // required: target column
  "position": 1      // optional: target position within column
}
```

**Response:**
```json
{
  "id": 1,
  "column_id": 2,
  "title": "API 문서화",
  "description": "Socket-bridge 아키텍처...",
  "priority": "high",
  "assignee": "Backend",
  "progress": 50,
  "position": 1,
  "due_date": "2026-04-15",
  "tags": ["documentation", "backend"],
  "session_id": null,
  "created_at": "2026-04-11T08:00:00Z",
  "updated_at": "2026-04-11T11:00:00Z"
}
```

**Status Codes:**
- 200: Success
- 400: Missing `column_id`
- 404: Card not found
- 422: WIP limit exceeded in target column

**Business Logic:**
1. **WIP Validation:** If target column has `wip_limit`, checks count of existing cards
   - If count >= limit, returns 422 error
   - Moving card counts as replacing, not addition
2. **Position Auto-Fill:** If `position` not specified, appends to end of column (max+1)
3. **Atomic Move:** Uses database transaction to ensure consistency
4. **Broadcasting:** Triggers `card:moved` event after successful move

**Example (WIP Check):**
```
Column A: wip_limit=3, current count=3
Card move to A with position=undefined → 422
  "error": "WIP limit exceeded (3/3)"
```

---

#### DELETE /cards/:id
**Description:** Delete a single card

**URL Parameters:**
- `:id` (number) — Card ID

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- 200: Success
- 404: Card not found

**Side Effects:**
- Triggers `card:deleted` broadcast event

---

#### DELETE /cards/cleanup
**Description:** Bulk delete cards matching criteria (maintenance operation)

**Request Body:**
```json
{
  "columns": [1, 2, 3],                    // optional: delete from these columns
  "before": "2026-04-10T00:00:00Z",       // optional: delete cards updated before this date
  "exclude_card_ids": [100, 101, 102]     // optional: skip these card IDs
}
```

**Response:**
```json
{
  "deleted": 15,
  "ids": [1, 2, 3, 4, 5, ...]
}
```

**Status Codes:**
- 200: Success
- 400: No filters provided (at least one filter required)

**Business Logic:**
- Constructs WHERE clause from all provided filters (AND condition)
- Filters:
  - `columns`: `column_id IN (...)`
  - `before`: `updated_at < ...`
  - `exclude_card_ids`: `id NOT IN (...)`
- At least one filter must be provided to prevent accidental full delete
- Atomic transaction: all-or-nothing
- Logs results to console

**Example Usage:**
```bash
# Delete all cards in columns 1-3 that were updated before April 10
curl -X DELETE http://localhost:3001/cards/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "columns": [1, 2, 3],
    "before": "2026-04-10T00:00:00Z"
  }'

# Response
# { "deleted": 15, "ids": [1, 2, 3, ...] }
```

---

## Validation Rules

### Card Fields

| Field | Rules | Example |
|-------|-------|---------|
| `title` | Required, non-empty | "API 문서화" |
| `description` | Optional, supports markdown | "## Overview\n\nDetails..." |
| `priority` | One of: low, medium, high | "high" |
| `assignee` | Optional, string | "Backend" |
| `progress` | 0-100, clamped | Input 150 → stored as 100 |
| `due_date` | ISO 8601 date or null | "2026-04-15" |
| `tags` | Array of strings (max 50 chars each) | ["doc", "backend"] |
| `session_id` | Optional, string | "sess-abc123" |

### Tag Serialization

Tags are stored as JSON strings in SQLite:

```typescript
// Request
{ "tags": ["doc", "backend"] }

// Stored in DB
"[\"doc\", \"backend\"]"

// Retrieved & parsed
{ "tags": ["doc", "backend"] }
```

**Sanitization:**
- Empty strings removed
- Whitespace trimmed
- Max 50 chars per tag
- Invalid JSON → defaults to `[]`

### Due Date Validation

```typescript
// Valid formats
"2026-04-15"    ✓
null            ✓
undefined       → null
""              → null
"2026-4-15"     ✗ (rejected, must be YYYY-MM-DD)
```

---

## Real-time Events (WebSocket)

When cards are modified, broadcast events are sent:

```typescript
// Client listens via WebSocket
socket.on('message', (data) => {
  if (data.type === 'card:created') {
    // Reload board or add card to UI
  }
  if (data.type === 'card:updated') {
    // Update card in UI
  }
  if (data.type === 'card:moved') {
    // Reorder columns
  }
  if (data.type === 'card:deleted') {
    // Remove card from UI
  }
});
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Human-readable error message"
}
```

### Common Errors

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "columnId required" | GET /cards without ?columnId |
| 400 | "column_id and title required" | POST without required fields |
| 400 | "No fields to update" | PATCH with no body |
| 400 | "At least one filter required" | DELETE /cleanup without filters |
| 404 | "Card not found" | PATCH/DELETE on non-existent card |
| 422 | "WIP limit exceeded (3/3)" | PATCH /move violates WIP limit |

---

## Examples

### Example 1: Create a card

```bash
curl -X POST http://localhost:3001/cards \
  -H "Content-Type: application/json" \
  -d '{
    "column_id": 1,
    "title": "API 문서화",
    "priority": "high",
    "assignee": "Backend",
    "due_date": "2026-04-15",
    "tags": ["documentation"]
  }'
```

### Example 2: Move card to "In Progress" column

```bash
curl -X PATCH http://localhost:3001/cards/1/move \
  -H "Content-Type: application/json" \
  -d '{
    "column_id": 2
  }'
```

### Example 3: Update card progress

```bash
curl -X PATCH http://localhost:3001/cards/1 \
  -H "Content-Type: application/json" \
  -d '{
    "progress": 75
  }'
```

### Example 4: Get full board view

```bash
curl http://localhost:3001/boards/1
```

### Example 5: Bulk cleanup (delete old cards)

```bash
curl -X DELETE http://localhost:3001/cards/cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "before": "2026-04-01T00:00:00Z",
    "exclude_card_ids": [1, 2, 3]
  }'
```

---

## Database Schema

### cards table
```sql
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  column_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  assignee TEXT,
  progress INTEGER DEFAULT 0,
  position INTEGER NOT NULL,
  due_date TEXT,
  tags TEXT DEFAULT '[]',           -- JSON string
  session_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (column_id) REFERENCES columns(id)
);
```

### columns table
```sql
CREATE TABLE columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  wip_limit INTEGER,
  FOREIGN KEY (board_id) REFERENCES boards(id)
);
```

### boards table
```sql
CREATE TABLE boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Performance Considerations

### GET /boards/:id Optimization

The endpoint uses a single LEFT JOIN query to fetch all columns and cards:

```sql
SELECT
  col.id as col_id, col.name as col_name, ...
  c.id as card_id, c.title, ...
FROM columns col
LEFT JOIN cards c ON c.column_id = col.id
WHERE col.board_id = ?
ORDER BY col.position, c.position ASC
```

**Benefits:**
- Single database round-trip
- Client-side aggregation into nested structure
- Avoids N+1 query problem
- Predictable latency

**Complexity:**
- O(c + n) where c = columns, n = cards
- JSON response construction O(c + n)

### Indexes (Recommended)

```sql
CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_cards_updated_at ON cards(updated_at);
CREATE INDEX idx_columns_board_id ON columns(board_id);
```

---

## Related Documentation

- **Socket-Bridge**: See `docs/api/socket-bridge-architecture.md`
- **Type Definitions**: See `kanban/backend/src/types.ts`
- **Routes**: See `kanban/backend/src/routes/`

---

**Last Updated:** 2026-04-11
**Author:** Homer (Backend Architect)
