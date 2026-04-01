import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { Card, CardRow } from '../types';
import { broadcast } from '../index';

const router = Router();

// ── 헬퍼: SQLite raw row → Card (tags JSON 파싱) ────────────────────────────
function parseCardRow(row: CardRow): Card {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags ?? '[]');
    tags = Array.isArray(parsed) ? parsed : [];
  } catch {
    tags = [];
  }
  return { ...row, tags };
}

// ── 태그 입력값 → JSON 문자열 (검증 포함) ──────────────────────────────────
function serializeTags(input: unknown): string {
  if (!Array.isArray(input)) return '[]';
  const sanitized = input
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => (t as string).trim().slice(0, 50)); // 태그 최대 50자
  return JSON.stringify(sanitized);
}

// ── due_date 유효성 검증 (YYYY-MM-DD 또는 null) ────────────────────────────
function validateDueDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : val;
}

// ── GET /cards?columnId=N ──────────────────────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { columnId } = req.query;
  if (!columnId) return res.status(400).json({ error: 'columnId required' });
  const rows = db.prepare('SELECT * FROM cards WHERE column_id = ? ORDER BY position DESC').all(columnId) as CardRow[];
  res.json(rows.map(parseCardRow));
});

// ── POST /cards ─────────────────────────────────────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { column_id, title, description, priority = 'medium', assignee, progress = 0, due_date, tags } = req.body;
  if (!column_id || !title) return res.status(400).json({ error: 'column_id and title required' });

  const progressVal = Math.max(0, Math.min(100, Number(progress) || 0));
  const dueDateVal = validateDueDate(due_date);
  const tagsVal = serializeTags(tags);

  const maxPos = (db.prepare('SELECT MAX(position) as maxp FROM cards WHERE column_id = ?').get(column_id) as { maxp: number | null }).maxp;
  const position = (maxPos ?? -1) + 1;

  const result = db.prepare(
    'INSERT INTO cards (column_id, title, description, priority, assignee, progress, position, due_date, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(column_id, title, description || null, priority, assignee || null, progressVal, position, dueDateVal, tagsVal);

  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid) as CardRow;
  broadcast({ type: 'card:created', boardId: 1 });
  res.status(201).json(parseCardRow(row));
});

// ── PATCH /cards/:id ─────────────────────────────────────────────────────────
router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { title, description, priority, assignee, progress, due_date, tags } = req.body;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined)       { fields.push('title = ?');       values.push(title || null); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description || null); }
  if (priority !== undefined)    { fields.push('priority = ?');    values.push(priority); }
  if (assignee !== undefined)    { fields.push('assignee = ?');    values.push(assignee || null); }
  if (progress !== undefined)    { fields.push('progress = ?');    values.push(Math.max(0, Math.min(100, Number(progress) || 0))); }
  if (due_date !== undefined)    { fields.push('due_date = ?');    values.push(validateDueDate(due_date)); }
  if (tags !== undefined)        { fields.push('tags = ?');        values.push(serializeTags(tags)); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);

  db.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...values as Parameters<typeof db.prepare>);
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as CardRow | undefined;
  if (!row) return res.status(404).json({ error: 'Card not found' });
  broadcast({ type: 'card:updated', boardId: 1 });
  res.json(parseCardRow(row));
});

// ── PATCH /cards/:id/move ────────────────────────────────────────────────────
router.patch('/:id/move', (req: Request, res: Response) => {
  const db = getDb();
  const { column_id, position } = req.body;
  if (column_id === undefined) return res.status(400).json({ error: 'column_id required' });

  const moveCard = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as CardRow | undefined;
    if (!existing) return { error: 'Card not found', status: 404 };

    // WIP limit 체크
    const col = db.prepare('SELECT wip_limit FROM columns WHERE id = ?').get(column_id) as { wip_limit: number | null } | undefined;
    if (col?.wip_limit) {
      const { cnt } = db.prepare('SELECT COUNT(*) as cnt FROM cards WHERE column_id = ? AND id != ?').get(column_id, req.params.id) as { cnt: number };
      if (cnt >= col.wip_limit) {
        return { error: `WIP limit exceeded (${cnt}/${col.wip_limit})`, status: 422 };
      }
    }

    // position이 명시되지 않으면 대상 컬럼의 마지막 위치에 추가
    let newPosition = position;
    if (newPosition === undefined || newPosition === null) {
      const maxPos = (db.prepare('SELECT MAX(position) as maxp FROM cards WHERE column_id = ? AND id != ?').get(column_id, req.params.id) as { maxp: number | null }).maxp;
      newPosition = (maxPos ?? -1) + 1;
    }

    db.prepare(
      "UPDATE cards SET column_id = ?, position = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(column_id, newPosition, req.params.id);

    return db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as CardRow;
  });

  const result = moveCard();
  if ('error' in result) return res.status(result.status).json({ error: result.error });
  broadcast({ type: 'card:moved', boardId: 1 });
  res.json(parseCardRow(result as CardRow));
});

// ── DELETE /cards/:id ────────────────────────────────────────────────────────
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Card not found' });
  broadcast({ type: 'card:deleted', boardId: 1 });
  res.json({ success: true });
});

export default router;
