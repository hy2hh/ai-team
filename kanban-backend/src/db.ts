import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'kanban.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
    seedData();
  }
  return db;
}

function initSchema(): void {
  const database = db;
  database.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      wip_limit INTEGER
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
      assignee TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedData(): void {
  const database = db;
  const boardCount = (database.prepare('SELECT COUNT(*) as cnt FROM boards').get() as { cnt: number }).cnt;
  if (boardCount > 0) return;

  const insertBoard = database.prepare('INSERT INTO boards (name) VALUES (?)');
  const board = insertBoard.run('AI Team Board');
  const boardId = board.lastInsertRowid as number;

  const insertColumn = database.prepare('INSERT INTO columns (board_id, name, position, wip_limit) VALUES (?, ?, ?, ?)');
  const cols = [
    ['Backlog', 0, null],
    ['In Progress', 1, 3],
    ['Review', 2, 2],
    ['Done', 3, null],
    ['Blocked', 4, null],
  ];
  const colIds: number[] = [];
  for (const [name, pos, wip] of cols) {
    const col = insertColumn.run(boardId, name, pos, wip);
    colIds.push(col.lastInsertRowid as number);
  }

  const insertCard = database.prepare(
    'INSERT INTO cards (column_id, title, description, priority, assignee, position) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insertCard.run(colIds[0], '칸반보드 UI 개선', '드래그앤드롭 UX 개선', 'high', 'Bart', 0);
  insertCard.run(colIds[0], 'API 문서 작성', 'Swagger/OpenAPI 문서', 'medium', null, 1);
  insertCard.run(colIds[1], 'WebSocket 실시간 연동', '카드 이동 시 실시간 반영', 'high', 'Homer', 0);
  insertCard.run(colIds[2], '성능 최적화', 'Lighthouse 점수 90+ 목표', 'medium', 'Bart', 0);
}
