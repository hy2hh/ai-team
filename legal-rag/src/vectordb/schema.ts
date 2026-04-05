import Database from 'better-sqlite3';
import type { LegalDocument, DocumentChunk } from '../types/legal-document.js';

/**
 * SQLite + Vector Extension 스키마
 *
 * 로컬 개발용 SQLite, 프로덕션 시 Pinecone/Qdrant/Weaviate 마이그레이션 고려
 * 임베딩 검색은 sqlite-vss 확장 또는 브루트포스 + ANN 인덱스 사용
 */

const SCHEMA_VERSION = 3;  // v3: chat_messages 테이블 추가

/**
 * 데이터베이스 초기화
 */
export function initDatabase(dbPath: string = './data/legal.db'): Database.Database {
  const db = new Database(dbPath);

  // WAL 모드로 동시성 향상
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // 스키마 버전 확인
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`);
  const currentVersion = db.prepare('SELECT version FROM schema_version').get() as { version: number } | undefined;

  if (!currentVersion || currentVersion.version < SCHEMA_VERSION) {
    createSchema(db);
    db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
  }

  return db;
}

/**
 * 스키마 생성
 */
function createSchema(db: Database.Database): void {
  db.exec(`
    -- 법률 문서 메타데이터 테이블
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source TEXT NOT NULL,

      case_number TEXT NOT NULL,
      case_type TEXT NOT NULL,
      court_level TEXT NOT NULL,
      court_name TEXT NOT NULL,
      judgment_date TEXT NOT NULL,
      verdict TEXT NOT NULL,

      title TEXT NOT NULL,
      facts TEXT,
      reasoning TEXT,
      decision TEXT,
      full_text TEXT NOT NULL,

      cited_laws TEXT,          -- JSON array
      cited_cases TEXT,         -- JSON array
      keywords TEXT,            -- JSON array
      legal_issues TEXT,        -- JSON array

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      UNIQUE(source, source_id)
    );

    -- 문서 청크 테이블 (RAG 검색 단위)
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_type TEXT NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER NOT NULL,
      embedding BLOB,           -- float32 array as blob (768 or 1536 dims)

      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE(document_id, chunk_index)
    );

    -- 인덱스
    CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source);
    CREATE INDEX IF NOT EXISTS idx_documents_case_type ON documents(case_type);
    CREATE INDEX IF NOT EXISTS idx_documents_court_level ON documents(court_level);
    CREATE INDEX IF NOT EXISTS idx_documents_judgment_date ON documents(judgment_date);
    CREATE INDEX IF NOT EXISTS idx_documents_verdict ON documents(verdict);

    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type);

    -- 전문 검색 인덱스 (FTS5)
    CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
      title,
      facts,
      reasoning,
      decision,
      content='documents',
      content_rowid='rowid'
    );

    -- FTS 트리거
    CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
      INSERT INTO documents_fts(rowid, title, facts, reasoning, decision)
      VALUES (new.rowid, new.title, new.facts, new.reasoning, new.decision);
    END;

    CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, facts, reasoning, decision)
      VALUES ('delete', old.rowid, old.title, old.facts, old.reasoning, old.decision);
    END;

    CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, title, facts, reasoning, decision)
      VALUES ('delete', old.rowid, old.title, old.facts, old.reasoning, old.decision);
      INSERT INTO documents_fts(rowid, title, facts, reasoning, decision)
      VALUES (new.rowid, new.title, new.facts, new.reasoning, new.decision);
    END;

    -- 수집 진행 상태 테이블
    CREATE TABLE IF NOT EXISTS ingestion_state (
      source TEXT PRIMARY KEY,
      last_offset INTEGER DEFAULT 0,
      last_sync_at TEXT,
      total_documents INTEGER DEFAULT 0,
      status TEXT DEFAULT 'idle'
    );

    -- ═══════════════════════════════════════════════════════════
    -- V2: 사용자 케이스 관리 테이블
    -- ═══════════════════════════════════════════════════════════

    -- 사용자 케이스 테이블
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,

      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,

      opposing_party TEXT,
      incident_date TEXT,
      evidence_list TEXT,           -- JSON array

      status TEXT NOT NULL DEFAULT 'draft',

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cases_user ON cases(user_id);
    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
    CREATE INDEX IF NOT EXISTS idx_cases_created ON cases(created_at);

    -- AI 분석 결과 테이블
    CREATE TABLE IF NOT EXISTS analysis_results (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL UNIQUE,

      win_probability REAL NOT NULL,
      confidence REAL NOT NULL,

      legal_basis TEXT,             -- JSON array
      related_cases TEXT,           -- JSON array
      recommendations TEXT,         -- JSON array
      warnings TEXT,                -- JSON array
      summary TEXT NOT NULL,

      model_version TEXT NOT NULL,
      analyzed_at TEXT NOT NULL,

      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    -- 생성된 문서 테이블 (내용증명 등)
    CREATE TABLE IF NOT EXISTS generated_documents (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      user_id TEXT NOT NULL,

      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,

      pdf_path TEXT,
      pdf_generated_at TEXT,

      is_paid INTEGER DEFAULT 0,
      payment_amount INTEGER DEFAULT 9900,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_generated_docs_case ON generated_documents(case_id);
    CREATE INDEX IF NOT EXISTS idx_generated_docs_user ON generated_documents(user_id);

    -- 채팅 메시지 테이블
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      user_id TEXT NOT NULL,

      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      citations TEXT,               -- JSON array (판례 번호)
      confidence TEXT,              -- 높음|중간|낮음

      created_at TEXT NOT NULL,

      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chat_case ON chat_messages(case_id);
    CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);
  `);
}

/**
 * 문서 저장소 클래스
 */
export class DocumentStore {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 문서 삽입/업데이트
   */
  upsertDocument(doc: LegalDocument): void {
    const stmt = this.db.prepare(`
      INSERT INTO documents (
        id, source_id, source,
        case_number, case_type, court_level, court_name, judgment_date, verdict,
        title, facts, reasoning, decision, full_text,
        cited_laws, cited_cases, keywords, legal_issues,
        created_at, updated_at
      ) VALUES (
        @id, @sourceId, @source,
        @caseNumber, @caseType, @courtLevel, @courtName, @judgmentDate, @verdict,
        @title, @facts, @reasoning, @decision, @fullText,
        @citedLaws, @citedCases, @keywords, @legalIssues,
        @createdAt, @updatedAt
      )
      ON CONFLICT(source, source_id) DO UPDATE SET
        case_number = excluded.case_number,
        case_type = excluded.case_type,
        court_level = excluded.court_level,
        court_name = excluded.court_name,
        judgment_date = excluded.judgment_date,
        verdict = excluded.verdict,
        title = excluded.title,
        facts = excluded.facts,
        reasoning = excluded.reasoning,
        decision = excluded.decision,
        full_text = excluded.full_text,
        cited_laws = excluded.cited_laws,
        cited_cases = excluded.cited_cases,
        keywords = excluded.keywords,
        legal_issues = excluded.legal_issues,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      id: doc.id,
      sourceId: doc.sourceId,
      source: doc.source,
      caseNumber: doc.caseNumber,
      caseType: doc.caseType,
      courtLevel: doc.courtLevel,
      courtName: doc.courtName,
      judgmentDate: doc.judgmentDate,
      verdict: doc.verdict,
      title: doc.title,
      facts: doc.facts || null,
      reasoning: doc.reasoning || null,
      decision: doc.decision || null,
      fullText: doc.fullText,
      citedLaws: JSON.stringify(doc.citedLaws),
      citedCases: JSON.stringify(doc.citedCases),
      keywords: JSON.stringify(doc.keywords),
      legalIssues: JSON.stringify(doc.legalIssues),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    });
  }

  /**
   * 청크 저장 (배치)
   */
  insertChunks(chunks: DocumentChunk[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO chunks (id, document_id, chunk_index, chunk_type, content, token_count, embedding)
      VALUES (@id, @documentId, @chunkIndex, @chunkType, @content, @tokenCount, @embedding)
      ON CONFLICT(document_id, chunk_index) DO UPDATE SET
        content = excluded.content,
        token_count = excluded.token_count,
        embedding = excluded.embedding
    `);

    const insertMany = this.db.transaction((items: DocumentChunk[]) => {
      for (const chunk of items) {
        stmt.run({
          id: chunk.id,
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          chunkType: chunk.chunkType,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          embedding: chunk.embedding ? Buffer.from(new Float32Array(chunk.embedding).buffer) : null
        });
      }
    });

    insertMany(chunks);
  }

  /**
   * 문서 수 조회
   */
  getDocumentCount(source?: string): number {
    if (source) {
      return (this.db.prepare('SELECT COUNT(*) as count FROM documents WHERE source = ?').get(source) as { count: number }).count;
    }
    return (this.db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number }).count;
  }

  /**
   * 청크 수 조회
   */
  getChunkCount(): number {
    return (this.db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number }).count;
  }

  /**
   * 전문 검색
   */
  searchFTS(query: string, limit: number = 20): LegalDocument[] {
    const stmt = this.db.prepare(`
      SELECT d.*
      FROM documents d
      JOIN documents_fts fts ON d.rowid = fts.rowid
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    const rows = stmt.all(query, limit) as DocumentRow[];
    return rows.map(this.rowToDocument);
  }

  /**
   * 벡터 유사도 검색 (브루트포스)
   * 프로덕션 시 sqlite-vss 또는 외부 벡터 DB 사용 권장
   */
  searchVector(embedding: number[], limit: number = 10): Array<{ chunk: DocumentChunk; score: number }> {
    // 모든 청크 로드 후 코사인 유사도 계산 (소규모 데이터셋용)
    const stmt = this.db.prepare('SELECT * FROM chunks WHERE embedding IS NOT NULL');
    const chunks = stmt.all() as ChunkRow[];

    const results = chunks.map(row => {
      const chunkEmbedding = new Float32Array(row.embedding.buffer);
      const score = cosineSimilarity(embedding, Array.from(chunkEmbedding));
      return {
        chunk: this.rowToChunk(row),
        score
      };
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * 수집 상태 업데이트
   */
  updateIngestionState(source: string, offset: number, total: number, status: string): void {
    this.db.prepare(`
      INSERT INTO ingestion_state (source, last_offset, total_documents, status, last_sync_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(source) DO UPDATE SET
        last_offset = excluded.last_offset,
        total_documents = excluded.total_documents,
        status = excluded.status,
        last_sync_at = excluded.last_sync_at
    `).run(source, offset, total, status);
  }

  /**
   * 수집 상태 조회
   */
  getIngestionState(source: string): IngestionState | null {
    return this.db.prepare('SELECT * FROM ingestion_state WHERE source = ?').get(source) as IngestionState | null;
  }

  private rowToDocument(row: DocumentRow): LegalDocument {
    return {
      id: row.id,
      sourceId: row.source_id,
      source: row.source as LegalDocument['source'],
      caseNumber: row.case_number,
      caseType: row.case_type as LegalDocument['caseType'],
      courtLevel: row.court_level as LegalDocument['courtLevel'],
      courtName: row.court_name,
      judgmentDate: row.judgment_date,
      verdict: row.verdict as LegalDocument['verdict'],
      title: row.title,
      facts: row.facts || undefined,
      reasoning: row.reasoning || undefined,
      decision: row.decision || undefined,
      fullText: row.full_text,
      citedLaws: JSON.parse(row.cited_laws || '[]'),
      citedCases: JSON.parse(row.cited_cases || '[]'),
      keywords: JSON.parse(row.keywords || '[]'),
      legalIssues: JSON.parse(row.legal_issues || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private rowToChunk(row: ChunkRow): DocumentChunk {
    return {
      id: row.id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      chunkType: row.chunk_type as DocumentChunk['chunkType'],
      content: row.content,
      tokenCount: row.token_count,
      embedding: row.embedding ? Array.from(new Float32Array(row.embedding.buffer)) : []
    };
  }
}

/**
 * 코사인 유사도 계산
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// Row 타입 정의
interface DocumentRow {
  id: string;
  source_id: string;
  source: string;
  case_number: string;
  case_type: string;
  court_level: string;
  court_name: string;
  judgment_date: string;
  verdict: string;
  title: string;
  facts: string | null;
  reasoning: string | null;
  decision: string | null;
  full_text: string;
  cited_laws: string | null;
  cited_cases: string | null;
  keywords: string | null;
  legal_issues: string | null;
  created_at: string;
  updated_at: string;
}

interface ChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  chunk_type: string;
  content: string;
  token_count: number;
  embedding: Buffer;
}

interface IngestionState {
  source: string;
  last_offset: number;
  last_sync_at: string;
  total_documents: number;
  status: string;
}
