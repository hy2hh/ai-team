import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const PROJECT_DIR = join(import.meta.dirname, '..', '..');
export const MEMORY_DIR = join(PROJECT_DIR, '.memory');
export const DB_PATH = join(MEMORY_DIR, 'memory.db');

let _db: Database.Database | null = null;

// ─── 스키마 마이그레이션 ──────────────────────────────────
// schema_version 테이블로 현재 버전을 추적하고
// 누락된 마이그레이션을 순서대로 적용한다.
// 새 컬럼/테이블 추가 시 MIGRATIONS 배열에 항목을 추가하면 된다.

const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS claims (
        message_ts  TEXT    PRIMARY KEY,
        agent       TEXT    NOT NULL,
        status      TEXT    NOT NULL DEFAULT 'processing',
        version     INTEGER NOT NULL DEFAULT 1,
        channel     TEXT,
        created_at  INTEGER NOT NULL,
        updated_at  INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_claims_status
        ON claims(status);

      CREATE INDEX IF NOT EXISTS idx_claims_created_at
        ON claims(created_at);

      CREATE INDEX IF NOT EXISTS idx_claims_updated_at
        ON claims(updated_at);

      CREATE TABLE IF NOT EXISTS heartbeats (
        role         TEXT    PRIMARY KEY,
        last_seen    INTEGER NOT NULL,
        status       TEXT    NOT NULL DEFAULT 'active',
        current_task TEXT,
        pid          INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_heartbeats_last_seen
        ON heartbeats(last_seen);

      CREATE TABLE IF NOT EXISTS agent_stats (
        agent        TEXT    PRIMARY KEY,
        total        INTEGER NOT NULL DEFAULT 0,
        failures     INTEGER NOT NULL DEFAULT 0,
        last_failure TEXT,
        last_updated TEXT    NOT NULL
      );
    `,
  },
  {
    version: 2,
    sql: `
      -- Auto-Proceed 승인 대기열
      CREATE TABLE IF NOT EXISTS pending_approvals (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        message_ts   TEXT    NOT NULL,
        channel      TEXT    NOT NULL,
        risk_level   TEXT    NOT NULL DEFAULT 'MEDIUM',
        reason       TEXT,
        agents       TEXT,
        action_summary TEXT,
        status       TEXT    NOT NULL DEFAULT 'pending',
        veto_expires INTEGER,
        created_at   INTEGER NOT NULL,
        resolved_at  INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_approvals_status
        ON pending_approvals(status);

      CREATE INDEX IF NOT EXISTS idx_approvals_veto
        ON pending_approvals(veto_expires);

      -- 에이전트 회의
      CREATE TABLE IF NOT EXISTS meetings (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        type         TEXT    NOT NULL,
        topic        TEXT    NOT NULL,
        status       TEXT    NOT NULL DEFAULT 'convened',
        initiator    TEXT    NOT NULL,
        participants TEXT    NOT NULL,
        context      TEXT,
        decision     TEXT,
        created_at   INTEGER NOT NULL,
        resolved_at  INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_meetings_status
        ON meetings(status);

      -- 회의 참여자 의견
      CREATE TABLE IF NOT EXISTS meeting_opinions (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id   INTEGER NOT NULL REFERENCES meetings(id),
        agent        TEXT    NOT NULL,
        opinion      TEXT    NOT NULL,
        vote         TEXT,
        round        INTEGER NOT NULL DEFAULT 1,
        created_at   INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_opinions_meeting
        ON meeting_opinions(meeting_id);

      -- Ralph Loop 검증 결과
      CREATE TABLE IF NOT EXISTS verification_results (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        message_ts   TEXT    NOT NULL,
        agent        TEXT    NOT NULL,
        checklist    TEXT    NOT NULL,
        passed       INTEGER NOT NULL DEFAULT 0,
        attempt      INTEGER NOT NULL DEFAULT 1,
        details      TEXT,
        created_at   INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_verification_agent
        ON verification_results(agent);

      CREATE INDEX IF NOT EXISTS idx_verification_ts
        ON verification_results(message_ts);
    `,
  },
];

/**
 * schema_version 테이블 초기화 후, 현재 버전보다 높은 마이그레이션을 순서대로 적용
 */
const runMigrations = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER NOT NULL,
      applied_at  TEXT    NOT NULL
    );
  `);

  const row = db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number | null };
  const currentVersion = row.v ?? 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
        migration.version,
        new Date().toISOString(),
      );
    })();
    console.log(`[db] 마이그레이션 v${migration.version} 적용 완료`);
  }
};

/**
 * 공유 SQLite DB 인스턴스 반환 (싱글톤)
 * WAL 모드, busy_timeout(5000) 설정
 * 스키마 마이그레이션 자동 적용
 */
export const getDb = (): Database.Database => {
  if (_db) {
    return _db;
  }

  // .memory 디렉토리 확보
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // WAL 모드 + busy timeout 설정
  db.pragma('journal_mode=WAL');
  db.pragma('busy_timeout=5000');

  // 스키마 마이그레이션 적용
  runMigrations(db);

  _db = db;
  return db;
};

/**
 * VACUUM + ANALYZE 실행 (주기적 DB 유지보수)
 */
export const runMaintenance = (): void => {
  const db = getDb();
  // WAL 체크포인트 — WAL 파일을 메인 DB로 병합하고 파일 크기 초기화
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.exec('VACUUM');
  db.exec('ANALYZE');
  console.log('[db] maintenance 완료');
};
