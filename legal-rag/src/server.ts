/**
 * AI 법률 서비스 REST API 서버
 *
 * 기존 엔드포인트:
 *   POST /search          — 법률 문서 검색 (벡터 + FTS 하이브리드)
 *   GET  /documents/:id   — 판례 문서 단건 조회
 *   GET  /suggest?q=...   — 검색어 자동완성 제안
 *
 * MVP 케이스 관리 엔드포인트:
 *   POST /api/cases                   — 케이스 생성
 *   GET  /api/cases                   — 케이스 목록 (사용자별)
 *   GET  /api/cases/:id               — 케이스 조회
 *   POST /api/cases/:id/analyze       — AI 법률 판단 실행
 *   POST /api/documents               — 내용증명 문서 생성
 *   GET  /api/documents/:id/download  — PDF 다운로드
 *
 * 포트: 3002 (LEGAL_API_PORT 환경변수로 오버라이드 가능)
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import { initDatabase, DocumentStore } from './vectordb/index.js';
import { search } from './index.js';
import type { LegalDocument } from './types/legal-document.js';
import {
  CreateCaseRequestSchema,
  CreateDocumentRequestSchema,
  type Case,
  type AnalysisResult,
  type GeneratedDocument,
  type AnalyzeResponse
} from './types/case.js';

const app = express();
const PORT = Number(process.env.LEGAL_API_PORT ?? 3002);
const DB_PATH = process.env.LEGAL_DB_PATH ?? './data/legal.db';
const PDF_DIR = process.env.LEGAL_PDF_DIR ?? './data/pdfs';

// PDF 디렉토리 생성
if (!fs.existsSync(PDF_DIR)) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
}

// ────────────────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ────────────────────────────────────────────────────────────
// Helper: DB 연결 (요청마다 재사용, 단순 구조)
// ────────────────────────────────────────────────────────────
function getStore(): DocumentStore {
  const db = initDatabase(DB_PATH);
  return new DocumentStore(db);
}

// ────────────────────────────────────────────────────────────
// POST /search
// Body: { query: string, limit?: number, filters?: SearchFilters }
// Response: { results: SearchResult[], total: number }
// ────────────────────────────────────────────────────────────
app.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, limit = 20, filters } = req.body as SearchRequest;

    if (!query || typeof query !== 'string' || query.trim() === '') {
      res.status(400).json({ error: 'query 필드가 필요합니다.' });
      return;
    }

    const rawResults = await search(query.trim(), {
      dbPath: DB_PATH,
      limit: Math.min(Number(limit) || 20, 100),
    });

    // 필터 적용 (verdict / caseType / courtLevel / dateFrom / dateTo)
    let filtered = rawResults;

    if (filters) {
      const { verdict, caseType, courtLevel, dateFrom, dateTo } = filters as SearchFilters;

      if (verdict?.length) {
        filtered = filtered.filter(r => verdict.includes(r.document.verdict));
      }
      if (caseType?.length) {
        filtered = filtered.filter(r => caseType.includes(r.document.caseType));
      }
      if (courtLevel?.length) {
        filtered = filtered.filter(r => courtLevel.includes(r.document.courtLevel));
      }
      if (dateFrom) {
        filtered = filtered.filter(r => r.document.judgmentDate >= dateFrom);
      }
      if (dateTo) {
        filtered = filtered.filter(r => r.document.judgmentDate <= dateTo);
      }
    }

    res.json({
      results: filtered,
      total: filtered.length,
    });
  } catch (err) {
    console.error('[/search error]', err);
    res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /documents/:id
// Response: LegalDocument (embedding 제외)
// ────────────────────────────────────────────────────────────
app.get('/documents/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: '문서 ID가 필요합니다.' });
      return;
    }

    const db = initDatabase(DB_PATH);

    const row = db.prepare(`
      SELECT * FROM documents WHERE id = ?
    `).get(id) as DocumentRow | undefined;

    db.close();

    if (!row) {
      res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
      return;
    }

    const doc = rowToDocument(row);
    // embedding 필드는 응답에서 제외
    const { embedding: _embedding, ...docWithoutEmbedding } = doc as LegalDocument & { embedding?: unknown };
    res.json(docWithoutEmbedding);
  } catch (err) {
    console.error('[/documents/:id error]', err);
    res.status(500).json({ error: '문서 조회 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /suggest?q=...
// Response: { suggestions: string[] }
// ────────────────────────────────────────────────────────────
app.get('/suggest', (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();

    if (!q || q.length < 1) {
      res.json({ suggestions: [] });
      return;
    }

    const db = initDatabase(DB_PATH);

    // FTS 기반 키워드 제안: 문서 title + keywords에서 q를 포함하는 상위 항목 추출
    const titleRows = db.prepare(`
      SELECT DISTINCT title FROM documents
      WHERE title LIKE ?
      LIMIT 5
    `).all(`%${q}%`) as Array<{ title: string }>;

    // keywords JSON 배열에서 일치 항목 추출
    const keywordRows = db.prepare(`
      SELECT keywords FROM documents
      WHERE keywords LIKE ?
      LIMIT 20
    `).all(`%${q}%`) as Array<{ keywords: string }>;

    db.close();

    const titleSuggestions = titleRows.map(r => r.title);

    const keywordSuggestions: string[] = [];
    for (const row of keywordRows) {
      try {
        const kws: string[] = JSON.parse(row.keywords || '[]');
        for (const kw of kws) {
          if (kw.includes(q)) keywordSuggestions.push(kw);
        }
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }

    const suggestions = [...new Set([...titleSuggestions, ...keywordSuggestions])].slice(0, 10);

    res.json({ suggestions });
  } catch (err) {
    console.error('[/suggest error]', err);
    res.status(500).json({ error: '제안 조회 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /health
// ────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  try {
    const store = getStore();
    const docCount = store.getDocumentCount();
    res.json({ status: 'ok', documents: docCount });
  } catch {
    res.status(503).json({ status: 'error', message: 'DB 연결 실패' });
  }
});

// ════════════════════════════════════════════════════════════
// MVP 케이스 관리 API
// ════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────
// POST /api/cases — 케이스 생성
// ────────────────────────────────────────────────────────────
app.post('/api/cases', (req: Request, res: Response) => {
  try {
    // 요청 유효성 검증
    const parseResult = CreateCaseRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: '잘못된 요청 형식입니다.',
        details: parseResult.error.flatten()
      });
      return;
    }

    const { title, category, description, opposingParty, incidentDate, evidenceList } = parseResult.data;

    // 사용자 ID (MVP: 헤더에서 추출, 실제는 인증 시스템 연동)
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    const now = new Date().toISOString();
    const caseId = uuidv4();

    const db = initDatabase(DB_PATH);

    db.prepare(`
      INSERT INTO cases (id, user_id, title, category, description, opposing_party, incident_date, evidence_list, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)
    `).run(
      caseId,
      userId,
      title,
      category,
      description,
      opposingParty || null,
      incidentDate || null,
      JSON.stringify(evidenceList || []),
      now,
      now
    );

    db.close();

    const newCase: Case = {
      id: caseId,
      userId,
      title,
      category,
      description,
      opposingParty,
      incidentDate,
      evidenceList,
      status: 'submitted',
      createdAt: now,
      updatedAt: now
    };

    res.status(201).json(newCase);
  } catch (err) {
    console.error('[POST /api/cases error]', err);
    res.status(500).json({ error: '케이스 생성 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/cases — 케이스 목록 (사용자별)
// Query: ?limit=20&offset=0&status=completed
// ────────────────────────────────────────────────────────────
app.get('/api/cases', (req: Request, res: Response) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'anonymous';
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const status = req.query.status as string | undefined;

    const db = initDatabase(DB_PATH);

    let query = 'SELECT * FROM cases WHERE user_id = ?';
    const params: (string | number)[] = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params) as CaseRow[];

    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) as count FROM cases WHERE user_id = ?';
    const countParams: string[] = [userId];
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    const totalResult = db.prepare(countQuery).get(...countParams) as { count: number };

    db.close();

    const cases = rows.map(rowToCase);

    res.json({
      cases,
      total: totalResult.count,
      limit,
      offset
    });
  } catch (err) {
    console.error('[GET /api/cases error]', err);
    res.status(500).json({ error: '케이스 목록 조회 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/cases/:id — 케이스 조회 (분석 결과 포함)
// ────────────────────────────────────────────────────────────
app.get('/api/cases/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    const db = initDatabase(DB_PATH);

    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow | undefined;

    if (!caseRow) {
      db.close();
      res.status(404).json({ error: '케이스를 찾을 수 없습니다.' });
      return;
    }

    // 권한 확인 (MVP: 본인 케이스만)
    if (caseRow.user_id !== userId && userId !== 'anonymous') {
      db.close();
      res.status(403).json({ error: '접근 권한이 없습니다.' });
      return;
    }

    // 분석 결과 조회
    const analysisRow = db.prepare('SELECT * FROM analysis_results WHERE case_id = ?').get(id) as AnalysisRow | undefined;

    db.close();

    const caseData = rowToCase(caseRow);
    const analysis = analysisRow ? rowToAnalysisResult(analysisRow) : null;

    res.json({
      ...caseData,
      analysis
    });
  } catch (err) {
    console.error('[GET /api/cases/:id error]', err);
    res.status(500).json({ error: '케이스 조회 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/cases/:id/analyze — AI 법률 판단 실행
// EC-1: RAG 검색 결과 없음
// EC-2: 외부 API 연동 실패 (엘박스 등)
// EC-4: AI 응답 신뢰도 경고
// ────────────────────────────────────────────────────────────
app.post('/api/cases/:id/analyze', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const db = initDatabase(DB_PATH);

    // 케이스 조회
    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow | undefined;

    if (!caseRow) {
      db.close();
      res.status(404).json({ error: '케이스를 찾을 수 없습니다.' });
      return;
    }

    // 이미 분석 완료된 경우
    if (caseRow.status === 'completed') {
      const existingAnalysis = db.prepare('SELECT * FROM analysis_results WHERE case_id = ?').get(id) as AnalysisRow | undefined;
      db.close();

      if (existingAnalysis) {
        res.json({
          caseId: id,
          status: 'completed',
          result: rowToAnalysisResult(existingAnalysis)
        } as AnalyzeResponse);
        return;
      }
    }

    // 상태를 analyzing으로 변경
    db.prepare('UPDATE cases SET status = ?, updated_at = ? WHERE id = ?')
      .run('analyzing', new Date().toISOString(), id);

    db.close();

    // RAG 검색 실행
    const caseData = rowToCase(caseRow);
    const searchQuery = `${caseData.category} ${caseData.title} ${caseData.description}`;

    let searchResults: Awaited<ReturnType<typeof search>> = [];
    let isRagEmpty = false;

    try {
      searchResults = await search(searchQuery, {
        dbPath: DB_PATH,
        limit: 10
      });

      // EC-1: RAG 검색 결과 없음
      if (!searchResults || searchResults.length === 0) {
        isRagEmpty = true;
        console.log('[analyze] No RAG results found, proceeding with general knowledge');
      }
    } catch (searchErr) {
      // EC-2: API 연동 실패 → fallback으로 진행
      console.warn('[analyze] RAG search failed, proceeding without case references:', searchErr);
      isRagEmpty = true;
      searchResults = [];
      // 에러를 throw하지 않고 빈 결과로 진행
    }

    // AI 분석 결과 생성
    const analysisResult = generateAnalysisResult(caseData, searchResults || [], isRagEmpty);

    // 결과 저장
    const db3 = initDatabase(DB_PATH);

    db3.prepare(`
      INSERT INTO analysis_results (id, case_id, win_probability, confidence, legal_basis, related_cases, recommendations, warnings, summary, model_version, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(case_id) DO UPDATE SET
        win_probability = excluded.win_probability,
        confidence = excluded.confidence,
        legal_basis = excluded.legal_basis,
        related_cases = excluded.related_cases,
        recommendations = excluded.recommendations,
        warnings = excluded.warnings,
        summary = excluded.summary,
        model_version = excluded.model_version,
        analyzed_at = excluded.analyzed_at
    `).run(
      uuidv4(),
      id,
      analysisResult.winProbability,
      analysisResult.confidence,
      JSON.stringify(analysisResult.legalBasis),
      JSON.stringify(analysisResult.relatedCases),
      JSON.stringify(analysisResult.recommendations),
      JSON.stringify(analysisResult.warnings),
      analysisResult.summary,
      analysisResult.modelVersion,
      analysisResult.analyzedAt
    );

    db3.prepare('UPDATE cases SET status = ?, updated_at = ? WHERE id = ?')
      .run('completed', new Date().toISOString(), id);

    db3.close();

    res.json({
      caseId: id,
      status: 'completed',
      result: analysisResult
    } as AnalyzeResponse);

  } catch (err) {
    console.error('[POST /api/cases/:id/analyze error]', err);

    // 에러 시 상태 복구
    try {
      const db = initDatabase(DB_PATH);
      db.prepare('UPDATE cases SET status = ?, updated_at = ? WHERE id = ?')
        .run('error', new Date().toISOString(), id);
      db.close();
    } catch { /* ignore */ }

    res.status(500).json({
      caseId: id,
      status: 'error',
      error: {
        code: 'EC-2',
        message: 'AI 분석 중 오류가 발생했습니다.'
      }
    } as AnalyzeResponse);
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/documents — 내용증명 문서 생성
// EC-3: 문서 생성 실패
// ────────────────────────────────────────────────────────────
app.post('/api/documents', async (req: Request, res: Response) => {
  try {
    // 요청 유효성 검증
    const parseResult = CreateDocumentRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: '잘못된 요청 형식입니다.',
        details: parseResult.error.flatten()
      });
      return;
    }

    const { caseId, type, senderName, senderAddress, recipientName, recipientAddress, content } = parseResult.data;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    const db = initDatabase(DB_PATH);

    // 케이스 조회
    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId) as CaseRow | undefined;

    if (!caseRow) {
      db.close();
      res.status(404).json({ error: '케이스를 찾을 수 없습니다.' });
      return;
    }

    const caseData = rowToCase(caseRow);

    // 문서 내용 생성
    const documentContent = content || generateDocumentContent(type, caseData, {
      senderName: senderName || '발신인',
      senderAddress: senderAddress || '',
      recipientName: recipientName || '수신인',
      recipientAddress: recipientAddress || ''
    });

    const now = new Date().toISOString();
    const docId = uuidv4();

    const typeLabels: Record<string, string> = {
      'certified_content': '내용증명',
      'contract_review': '계약서 검토',
      'legal_notice': '법적 통지서'
    };

    const docTitle = `${typeLabels[type] || type} - ${caseData.title}`;

    db.prepare(`
      INSERT INTO generated_documents (id, case_id, user_id, type, title, content, is_paid, payment_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 9900, ?, ?)
    `).run(docId, caseId, userId, type, docTitle, documentContent, now, now);

    db.close();

    const generatedDoc: GeneratedDocument = {
      id: docId,
      caseId,
      userId,
      type,
      title: docTitle,
      content: documentContent,
      isPaid: false,
      paymentAmount: 9900,
      createdAt: now,
      updatedAt: now
    };

    res.status(201).json(generatedDoc);

  } catch (err) {
    console.error('[POST /api/documents error]', err);
    // EC-3: 문서 생성 실패
    res.status(500).json({
      error: '문서 생성 중 오류가 발생했습니다.',
      code: 'EC-3',
      message: '문서 생성에 실패했습니다. 다시 시도해주세요.'
    });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/documents/:id/download — PDF 다운로드
// EC-3: PDF 생성 실패
// ────────────────────────────────────────────────────────────
app.get('/api/documents/:id/download', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] as string || 'anonymous';

    const db = initDatabase(DB_PATH);

    const docRow = db.prepare('SELECT * FROM generated_documents WHERE id = ?').get(id) as GeneratedDocumentRow | undefined;

    if (!docRow) {
      db.close();
      res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
      return;
    }

    // 권한 확인
    if (docRow.user_id !== userId && userId !== 'anonymous') {
      db.close();
      res.status(403).json({ error: '접근 권한이 없습니다.' });
      return;
    }

    // PDF가 이미 생성되어 있는 경우
    if (docRow.pdf_path && fs.existsSync(docRow.pdf_path)) {
      db.close();
      res.download(docRow.pdf_path, `${docRow.title}.pdf`);
      return;
    }

    // PDF 생성
    const pdfPath = path.join(PDF_DIR, `${id}.pdf`);

    try {
      await generatePDF(docRow.content, docRow.title, pdfPath);
    } catch (pdfErr) {
      console.error('[PDF generation error]', pdfErr);
      db.close();
      // EC-3: PDF 생성 실패
      res.status(500).json({
        error: 'PDF 생성 중 오류가 발생했습니다.',
        code: 'EC-3',
        message: '결제 취소 또는 재시도 옵션을 선택해주세요.'
      });
      return;
    }

    // PDF 경로 저장
    const now = new Date().toISOString();
    db.prepare('UPDATE generated_documents SET pdf_path = ?, pdf_generated_at = ?, updated_at = ? WHERE id = ?')
      .run(pdfPath, now, now, id);

    db.close();

    res.download(pdfPath, `${docRow.title}.pdf`);

  } catch (err) {
    console.error('[GET /api/documents/:id/download error]', err);
    res.status(500).json({
      error: 'PDF 다운로드 중 오류가 발생했습니다.',
      code: 'EC-3'
    });
  }
});

// ════════════════════════════════════════════════════════════
// Helper Functions
// ════════════════════════════════════════════════════════════

/**
 * AI 분석 결과 생성 (MVP: 규칙 기반 + RAG 결과 활용)
 */
function generateAnalysisResult(
  caseData: Case,
  searchResults: Awaited<ReturnType<typeof search>>,
  isRagEmpty: boolean
): AnalysisResult {
  const now = new Date().toISOString();

  // 관련 판례 변환
  const relatedCases = searchResults.slice(0, 5).map(r => ({
    caseNumber: r.document.caseNumber,
    courtName: r.document.courtName,
    judgmentDate: r.document.judgmentDate,
    summary: r.document.title,
    verdict: r.document.verdict,
    similarity: r.score
  }));

  // 승소 가능성 계산 (MVP: 단순 휴리스틱)
  let winProbability = 50;  // 기본값
  let confidence = 70;

  if (relatedCases.length > 0) {
    // 유사 판례 중 원고 승 비율 계산
    const plaintiffWins = relatedCases.filter(c =>
      c.verdict === 'plaintiff_win' || c.verdict === 'partial'
    ).length;
    winProbability = Math.round((plaintiffWins / relatedCases.length) * 100);
    confidence = Math.min(90, 50 + relatedCases.length * 8);  // 판례가 많을수록 신뢰도 증가
  }

  // EC-1 / EC-4 처리
  const warnings: string[] = [];

  if (isRagEmpty) {
    warnings.push('관련 판례를 찾지 못했습니다. 일반 법률 지식 기반으로 응답합니다.');
    confidence = Math.max(30, confidence - 40);
  }

  if (confidence < 60) {
    warnings.push('AI 판단 신뢰도가 낮습니다. 전문 변호사 상담을 권장합니다.');
  }

  // 법적 근거 (MVP: 카테고리 기반 매핑)
  const legalBasis = getLegalBasisForCategory(caseData.category);

  // 권장 조치
  const recommendations = getRecommendationsForCategory(caseData.category, winProbability);

  // 요약 생성
  const summary = `${caseData.title}에 대한 AI 법률 분석 결과입니다. ` +
    `승소 가능성은 약 ${winProbability}%로 예측됩니다. ` +
    (relatedCases.length > 0
      ? `${relatedCases.length}건의 유사 판례를 분석했습니다.`
      : '유사 판례가 없어 일반적인 법률 지식에 기반한 분석입니다.');

  return {
    caseId: caseData.id,
    winProbability,
    confidence,
    legalBasis,
    relatedCases,
    recommendations,
    warnings,
    summary,
    analyzedAt: now,
    modelVersion: 'legal-rag-mvp-v1'
  };
}

/**
 * 카테고리별 법적 근거 매핑
 */
function getLegalBasisForCategory(category: string): AnalysisResult['legalBasis'] {
  const basisMap: Record<string, AnalysisResult['legalBasis']> = {
    'lease': [
      { law: '주택임대차보호법', article: '제3조', relevance: '대항력 및 우선변제권' },
      { law: '민법', article: '제618조', relevance: '임대차의 존속기간' }
    ],
    'contract': [
      { law: '민법', article: '제544조', relevance: '이행지체와 해제' },
      { law: '민법', article: '제390조', relevance: '채무불이행과 손해배상' }
    ],
    'labor': [
      { law: '근로기준법', article: '제23조', relevance: '해고의 제한' },
      { law: '근로기준법', article: '제26조', relevance: '해고의 예고' }
    ],
    'damage': [
      { law: '민법', article: '제750조', relevance: '불법행위의 내용' },
      { law: '민법', article: '제763조', relevance: '손해배상청구권의 범위' }
    ],
    'property': [
      { law: '부동산등기법', article: '제3조', relevance: '등기의 효력' },
      { law: '민법', article: '제211조', relevance: '소유권의 내용' }
    ],
    'family': [
      { law: '민법', article: '제840조', relevance: '재판상 이혼 사유' },
      { law: '민법', article: '제843조', relevance: '재산분할청구권' }
    ]
  };

  return basisMap[category] || [
    { law: '민법', relevance: '일반 민사 사건에 적용' }
  ];
}

/**
 * 권장 조치 생성
 */
function getRecommendationsForCategory(category: string, winProbability: number): string[] {
  const baseRecommendations: string[] = [];

  if (winProbability >= 70) {
    baseRecommendations.push('법적 절차 진행을 권장합니다.');
    baseRecommendations.push('관련 증거 자료를 체계적으로 정리하세요.');
  } else if (winProbability >= 40) {
    baseRecommendations.push('조정 또는 합의를 우선 시도해보세요.');
    baseRecommendations.push('전문 변호사와 상담하여 전략을 수립하세요.');
  } else {
    baseRecommendations.push('전문 변호사와 상담이 필요합니다.');
    baseRecommendations.push('추가 증거 확보 가능성을 검토하세요.');
  }

  const categoryRecommendations: Record<string, string[]> = {
    'lease': ['내용증명 발송을 고려하세요.', '보증금 반환 시 확인서를 받으세요.'],
    'labor': ['근로감독관에게 진정서 제출을 검토하세요.'],
    'contract': ['계약 조항을 다시 검토하세요.'],
    'damage': ['손해액을 객관적으로 입증할 자료를 준비하세요.']
  };

  return [...baseRecommendations, ...(categoryRecommendations[category] || [])];
}

/**
 * 내용증명 문서 내용 생성
 */
function generateDocumentContent(
  type: string,
  caseData: Case,
  info: { senderName: string; senderAddress: string; recipientName: string; recipientAddress: string }
): string {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

  if (type === 'certified_content') {
    return `
내 용 증 명

발신인: ${info.senderName}
주  소: ${info.senderAddress}

수신인: ${info.recipientName}
주  소: ${info.recipientAddress}

제  목: ${caseData.title}

본인은 아래와 같이 통지합니다.

1. 사건 개요
${caseData.description}

${caseData.opposingParty ? `2. 상대방: ${caseData.opposingParty}` : ''}
${caseData.incidentDate ? `3. 발생일: ${caseData.incidentDate}` : ''}

본 내용증명은 위 사실을 확인하고, 향후 법적 조치의 근거로 활용하기 위해 발송합니다.

${today}

발신인: ${info.senderName} (인)
    `.trim();
  }

  return `
[${type}]

제목: ${caseData.title}
작성일: ${today}

${caseData.description}
  `.trim();
}

/**
 * PDF 생성
 */
function generatePDF(content: string, title: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: title,
          Author: 'AI 법률 서비스',
          Creator: 'legal-rag-mvp'
        }
      });

      // 한글 폰트 설정 (시스템 폰트 사용)
      // PDFKit은 .ttc 파일을 지원하지 않으므로 .ttf 폰트만 사용
      // macOS: AppleGothic, Windows: Malgun Gothic
      const fontCandidates = [
        '/System/Library/Fonts/Supplemental/AppleGothic.ttf',   // macOS
        'C:\\Windows\\Fonts\\malgun.ttf',                        // Windows
        '/usr/share/fonts/truetype/nanum/NanumGothic.ttf'       // Linux (나눔고딕)
      ];
      const fontPath = fontCandidates.find(f => fs.existsSync(f));
      if (fontPath) {
        doc.font(fontPath);
      }

      const writeStream = fs.createWriteStream(outputPath);

      writeStream.on('finish', resolve);
      writeStream.on('error', reject);

      doc.pipe(writeStream);

      // 제목
      doc.fontSize(18).text(title, { align: 'center' });
      doc.moveDown(2);

      // 본문
      doc.fontSize(12).text(content, {
        align: 'left',
        lineGap: 5
      });

      // 푸터
      doc.moveDown(3);
      doc.fontSize(10).fillColor('gray').text(
        `생성일시: ${new Date().toLocaleString('ko-KR')} | AI 법률 서비스`,
        { align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ════════════════════════════════════════════════════════════
// 추가 엔드포인트 (Frontend API 계약 호환)
// ════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────
// GET /api/cases/:id/analysis — 분석 결과 조회 (또는 자동 실행)
// ────────────────────────────────────────────────────────────
app.get('/api/cases/:id/analysis', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const db = initDatabase(DB_PATH);
    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow | undefined;
    if (!caseRow) {
      db.close();
      res.status(404).json({ error: '케이스를 찾을 수 없습니다.' });
      return;
    }

    const analysisRow = db.prepare('SELECT * FROM analysis_results WHERE case_id = ?').get(id) as AnalysisRow | undefined;
    db.close();

    if (!analysisRow) {
      // 분석 결과 없으면 분석 자동 트리거
      res.status(202).json({
        caseId: id,
        status: 'pending',
        message: '분석이 아직 완료되지 않았습니다. POST /api/cases/:id/analyze를 호출하거나 잠시 후 다시 시도하세요.'
      });
      return;
    }

    const result = rowToAnalysisResult(analysisRow);
    // Frontend AnalysisResult 타입에 맞게 변환
    res.json({
      caseId: result.caseId,
      winProbability: result.winProbability,
      summary: result.summary,
      reasoning: result.summary, // reasoning 필드 alias
      precedents: result.relatedCases.map(rc => ({
        id: rc.caseNumber,
        court: rc.courtName.includes('대법') ? '대법원' : rc.courtName.includes('고등') ? '고등법원' : '지방법원',
        caseNumber: rc.caseNumber,
        date: rc.judgmentDate,
        summary: rc.summary,
        relevance: rc.similarity >= 0.7 ? '높음' : rc.similarity >= 0.4 ? '중간' : '낮음'
      })),
      relatedLaws: result.legalBasis.map(lb => ({
        name: lb.law,
        article: lb.article ?? '',
        content: lb.relevance
      })),
      recommendations: result.recommendations.map(r => ({
        type: r.includes('문서') || r.includes('내용증명') ? 'document' : 'lawyer',
        label: r.length > 30 ? r.slice(0, 30) + '...' : r,
        description: r
      }))
    });
  } catch (err) {
    console.error('[GET /api/cases/:id/analysis error]', err);
    res.status(500).json({ error: '분석 결과 조회 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/cases/:id/chat — 채팅 히스토리 조회
// ────────────────────────────────────────────────────────────
app.get('/api/cases/:id/chat', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const db = initDatabase(DB_PATH);
    const rows = db.prepare(
      'SELECT * FROM chat_messages WHERE case_id = ? ORDER BY created_at ASC'
    ).all(id) as ChatMessageRow[];
    db.close();

    const messages = rows.map(rowToChatMessage);
    res.json(messages);
  } catch (err) {
    console.error('[GET /api/cases/:id/chat error]', err);
    res.status(500).json({ error: '채팅 히스토리 조회 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/cases/:id/chat — 채팅 메시지 전송 (SSE 스트리밍)
// ────────────────────────────────────────────────────────────
app.post('/api/cases/:id/chat', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { message } = req.body as { message?: string };
  const userId = req.headers['x-user-id'] as string || 'anonymous';

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: '메시지 내용이 필요합니다.' });
    return;
  }

  try {
    const db = initDatabase(DB_PATH);
    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(id) as CaseRow | undefined;
    if (!caseRow) {
      db.close();
      res.status(404).json({ error: '케이스를 찾을 수 없습니다.' });
      return;
    }

    // 사용자 메시지 저장
    const userMsgId = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO chat_messages (id, case_id, user_id, role, content, citations, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(userMsgId, id, userId, 'user', message.trim(), null, null, now);
    db.close();

    // SSE 응답 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 분석 결과 조회 (컨텍스트용)
    const db2 = initDatabase(DB_PATH);
    const analysisRow = db2.prepare('SELECT * FROM analysis_results WHERE case_id = ?').get(id) as AnalysisRow | undefined;
    db2.close();

    // AI 응답 생성 (MVP: 규칙 기반 응답)
    const caseData = rowToCase(caseRow);
    const analysis = analysisRow ? rowToAnalysisResult(analysisRow) : null;

    const responseText = generateChatResponse(message.trim(), caseData, analysis);
    const confidence = analysis ? (analysis.winProbability >= 70 ? '높음' : analysis.winProbability >= 40 ? '중간' : '낮음') : '중간';

    // 청크 단위로 SSE 전송
    const chunks = responseText.match(/.{1,50}/g) ?? [responseText];
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    // 어시스턴트 메시지 저장
    const asstMsgId = uuidv4();
    const asstNow = new Date().toISOString();
    const db3 = initDatabase(DB_PATH);
    db3.prepare(
      'INSERT INTO chat_messages (id, case_id, user_id, role, content, citations, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(asstMsgId, id, 'assistant', 'assistant', responseText, JSON.stringify([]), confidence, asstNow);
    db3.close();

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[POST /api/cases/:id/chat error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: '채팅 처리 중 오류가 발생했습니다.' });
    } else {
      res.end();
    }
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/documents/generate — 문서 생성 (SSE 스트리밍)
// ────────────────────────────────────────────────────────────
app.post('/api/documents/generate', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string || 'anonymous';

  const parsed = CreateDocumentRequestSchema.safeParse({
    caseId: req.body?.caseId,
    type: req.body?.type === '내용증명' ? 'certified_content' : (req.body?.type ?? 'certified_content'),
    senderName: req.body?.sender?.name,
    senderAddress: req.body?.sender?.address,
    recipientName: req.body?.recipient?.name,
    recipientAddress: req.body?.recipient?.address,
    content: req.body?.reason
  });

  if (!parsed.success) {
    res.status(400).json({ error: '잘못된 요청 형식입니다.', details: parsed.error.issues });
    return;
  }

  const body = parsed.data;

  try {
    const db = initDatabase(DB_PATH);
    const caseRow = db.prepare('SELECT * FROM cases WHERE id = ?').get(body.caseId) as CaseRow | undefined;
    if (!caseRow) {
      db.close();
      res.status(404).json({ error: '케이스를 찾을 수 없습니다.' });
      return;
    }
    db.close();

    const caseData = rowToCase(caseRow);

    // SSE 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 문서 내용 생성
    const docContent = generateDocumentContent(body.type, caseData, {
      senderName: body.senderName ?? '발신인',
      senderAddress: body.senderAddress ?? '주소 미기재',
      recipientName: body.recipientName ?? '수신인',
      recipientAddress: body.recipientAddress ?? '주소 미기재'
    });

    // 청크 스트리밍
    const chunks = docContent.match(/.{1,80}/g) ?? [docContent];
    for (const chunk of chunks) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    // DB 저장
    const docId = uuidv4();
    const now = new Date().toISOString();
    const title = `${caseData.title} — ${body.type === 'certified_content' ? '내용증명' : body.type}`;

    const db2 = initDatabase(DB_PATH);
    db2.prepare(`
      INSERT INTO generated_documents (id, case_id, user_id, type, title, content, is_paid, payment_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(docId, body.caseId, userId, body.type, title, docContent, 0, 9900, now, now);
    db2.close();

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[POST /api/documents/generate error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: '문서 생성 중 오류가 발생했습니다.' });
    } else {
      res.end();
    }
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/documents — caseId + type으로 문서 조회
// ────────────────────────────────────────────────────────────
app.get('/api/documents', (req: Request, res: Response) => {
  const { caseId, type } = req.query as { caseId?: string; type?: string };

  try {
    const db = initDatabase(DB_PATH);

    let row: GeneratedDocumentRow | undefined;
    if (caseId && type) {
      // type 한글 → 영어 매핑
      const typeMap: Record<string, string> = {
        '내용증명': 'certified_content',
        '계약서': 'contract_review',
        '고소장': 'legal_notice',
        '합의서': 'certified_content'
      };
      const dbType = typeMap[type] ?? type;
      row = db.prepare(
        'SELECT * FROM generated_documents WHERE case_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1'
      ).get(caseId, dbType) as GeneratedDocumentRow | undefined;
    } else if (caseId) {
      row = db.prepare(
        'SELECT * FROM generated_documents WHERE case_id = ? ORDER BY created_at DESC LIMIT 1'
      ).get(caseId) as GeneratedDocumentRow | undefined;
    }

    db.close();

    if (!row) {
      res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
      return;
    }

    res.json({
      id: row.id,
      caseId: row.case_id,
      type: row.type,
      content: row.content,
      createdAt: row.created_at,
      downloadUrl: `/api/documents/${row.id}/download`
    });
  } catch (err) {
    console.error('[GET /api/documents error]', err);
    res.status(500).json({ error: '문서 조회 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /api/dashboard/kpi — 대시보드 KPI
// ────────────────────────────────────────────────────────────
app.get('/api/dashboard/kpi', (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string || 'anonymous';

  try {
    const db = initDatabase(DB_PATH);

    const activeCasesRow = db.prepare(
      "SELECT COUNT(*) as count FROM cases WHERE user_id = ? AND status NOT IN ('completed', 'error')"
    ).get(userId) as { count: number };

    const completedCasesRow = db.prepare(
      "SELECT COUNT(*) as count FROM cases WHERE user_id = ? AND status = 'completed'"
    ).get(userId) as { count: number };

    db.close();

    res.json({
      activeCases: activeCasesRow.count,
      completedCases: completedCasesRow.count,
      monthlyBilling: 29900,
      plan: 'subscription',
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    });
  } catch (err) {
    console.error('[GET /api/dashboard/kpi error]', err);
    res.status(500).json({ error: '대시보드 KPI 조회 중 오류가 발생했습니다.' });
  }
});

// ────────────────────────────────────────────────────────────
// POST /api/payments/intent — 결제 의도 생성 (MVP: Mock)
// ────────────────────────────────────────────────────────────
app.post('/api/payments/intent', (req: Request, res: Response) => {
  const { plan } = req.body as { plan?: string };

  if (!plan || !['subscription', 'per-case'].includes(plan)) {
    res.status(400).json({ error: "plan은 'subscription' 또는 'per-case' 이어야 합니다." });
    return;
  }

  const amount = plan === 'subscription' ? 29900 : 9900;

  res.json({
    clientSecret: `pi_mock_${uuidv4().replace(/-/g, '')}_secret_mock`,
    amount,
    type: plan
  });
});

// ════════════════════════════════════════════════════════════
// Chat Helper
// ════════════════════════════════════════════════════════════

/**
 * MVP 채팅 응답 생성 (규칙 기반)
 */
function generateChatResponse(message: string, caseData: Case, analysis: AnalysisResult | null): string {
  const lowerMsg = message.toLowerCase();

  // 승소 가능성 관련 질문
  if (lowerMsg.includes('승소') || lowerMsg.includes('이길') || lowerMsg.includes('가능성') || lowerMsg.includes('확률')) {
    if (analysis) {
      return `현재 사건 분석 결과, 승소 가능성은 약 ${analysis.winProbability}%로 예측됩니다. ` +
        `${analysis.winProbability >= 70 ? '비교적 유리한 상황입니다.' : analysis.winProbability >= 40 ? '결과를 장담하기 어렵습니다. 추가 증거 확보가 중요합니다.' : '쉽지 않은 상황입니다. 전문 변호사 상담을 권장합니다.'} ` +
        `관련 판례 ${analysis.relatedCases.length}건을 분석한 결과입니다.`;
    }
    return '아직 AI 분석이 완료되지 않았습니다. 분석을 먼저 실행해주세요.';
  }

  // 다음 단계 관련 질문
  if (lowerMsg.includes('다음') || lowerMsg.includes('어떻게') || lowerMsg.includes('절차') || lowerMsg.includes('방법')) {
    const recs = analysis?.recommendations ?? [];
    if (recs.length > 0) {
      return `권장 조치사항입니다:\n${recs.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
    }
    return `${caseData.category} 분야의 분쟁으로, 먼저 관련 증거를 확보하고 내용증명을 발송하는 것을 권장합니다.`;
  }

  // 판례 관련 질문
  if (lowerMsg.includes('판례') || lowerMsg.includes('사례') || lowerMsg.includes('비슷')) {
    if (analysis && analysis.relatedCases.length > 0) {
      const top = analysis.relatedCases[0];
      return `가장 유사한 판례는 ${top.courtName}의 ${top.caseNumber} (${top.judgmentDate})입니다. ` +
        `유사도: ${Math.round(top.similarity * 100)}%. ${top.summary}`;
    }
    return '유사 판례 데이터가 충분하지 않아 일반적인 법률 지식 기반으로 안내드립니다.';
  }

  // 비용 관련 질문
  if (lowerMsg.includes('비용') || lowerMsg.includes('가격') || lowerMsg.includes('얼마')) {
    return '내용증명 문서 생성은 건당 9,900원, 구독 서비스는 월 29,900원입니다.';
  }

  // 기본 응답
  return `${caseData.category} 분야 사건에 대해 질문해주셨습니다. ` +
    `더 정확한 답변을 위해 구체적으로 질문해주시면 도움이 됩니다. ` +
    `예: "승소 가능성이 어떻게 되나요?", "다음 절차는 무엇인가요?", "비슷한 판례가 있나요?"`;
}

// ════════════════════════════════════════════════════════════
// 추가 타입 정의
// ════════════════════════════════════════════════════════════

interface ChatMessageRow {
  id: string;
  case_id: string;
  user_id: string;
  role: string;
  content: string;
  citations: string | null;
  confidence: string | null;
  created_at: string;
}

function rowToChatMessage(row: ChatMessageRow) {
  return {
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    citations: row.citations ? JSON.parse(row.citations) : undefined,
    confidence: (row.confidence ?? undefined) as '높음' | '중간' | '낮음' | undefined,
    createdAt: row.created_at
  };
}

// ────────────────────────────────────────────────────────────
// 404 handler
// ────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: '요청한 엔드포인트를 찾을 수 없습니다.' });
});

// ────────────────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ AI 법률 서비스 API 서버 시작 — http://localhost:${PORT}`);
  console.log(`   DB: ${DB_PATH}`);
  console.log(`   엔드포인트:`);
  console.log(`     POST /search`);
  console.log(`     GET  /documents/:id`);
  console.log(`     GET  /suggest?q=...`);
  console.log(`     GET  /health`);
  console.log(`   MVP 케이스 관리 API:`);
  console.log(`     POST /api/cases`);
  console.log(`     GET  /api/cases`);
  console.log(`     GET  /api/cases/:id`);
  console.log(`     GET  /api/cases/:id/analysis`);
  console.log(`     POST /api/cases/:id/analyze`);
  console.log(`     GET  /api/cases/:id/chat`);
  console.log(`     POST /api/cases/:id/chat`);
  console.log(`     POST /api/documents`);
  console.log(`     POST /api/documents/generate`);
  console.log(`     GET  /api/documents`);
  console.log(`     GET  /api/documents/:id/download`);
  console.log(`     GET  /api/dashboard/kpi`);
  console.log(`     POST /api/payments/intent`);
});

// ────────────────────────────────────────────────────────────
// 타입 정의
// ────────────────────────────────────────────────────────────
interface SearchFilters {
  verdict?: string[];
  caseType?: string[];
  courtLevel?: string[];
  dateFrom?: string;
  dateTo?: string;
}

interface SearchRequest {
  query: string;
  limit?: number;
  filters?: SearchFilters;
}

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

// 케이스 Row 타입
interface CaseRow {
  id: string;
  user_id: string;
  title: string;
  category: string;
  description: string;
  opposing_party: string | null;
  incident_date: string | null;
  evidence_list: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// 분석 결과 Row 타입
interface AnalysisRow {
  id: string;
  case_id: string;
  win_probability: number;
  confidence: number;
  legal_basis: string | null;
  related_cases: string | null;
  recommendations: string | null;
  warnings: string | null;
  summary: string;
  model_version: string;
  analyzed_at: string;
}

// 생성 문서 Row 타입
interface GeneratedDocumentRow {
  id: string;
  case_id: string;
  user_id: string;
  type: string;
  title: string;
  content: string;
  pdf_path: string | null;
  pdf_generated_at: string | null;
  is_paid: number;
  payment_amount: number;
  created_at: string;
  updated_at: string;
}

function rowToDocument(row: DocumentRow): LegalDocument {
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
    facts: row.facts ?? undefined,
    reasoning: row.reasoning ?? undefined,
    decision: row.decision ?? undefined,
    fullText: row.full_text,
    citedLaws: JSON.parse(row.cited_laws ?? '[]'),
    citedCases: JSON.parse(row.cited_cases ?? '[]'),
    keywords: JSON.parse(row.keywords ?? '[]'),
    legalIssues: JSON.parse(row.legal_issues ?? '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToCase(row: CaseRow): Case {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category as Case['category'],
    description: row.description,
    opposingParty: row.opposing_party ?? undefined,
    incidentDate: row.incident_date ?? undefined,
    evidenceList: row.evidence_list ? JSON.parse(row.evidence_list) : undefined,
    status: row.status as Case['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToAnalysisResult(row: AnalysisRow): AnalysisResult {
  return {
    caseId: row.case_id,
    winProbability: row.win_probability,
    confidence: row.confidence,
    legalBasis: row.legal_basis ? JSON.parse(row.legal_basis) : [],
    relatedCases: row.related_cases ? JSON.parse(row.related_cases) : [],
    recommendations: row.recommendations ? JSON.parse(row.recommendations) : [],
    warnings: row.warnings ? JSON.parse(row.warnings) : [],
    summary: row.summary,
    analyzedAt: row.analyzed_at,
    modelVersion: row.model_version
  };
}

export default app;
