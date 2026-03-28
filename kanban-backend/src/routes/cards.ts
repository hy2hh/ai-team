import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { Card } from '../types';
import { broadcast } from '../index';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { columnId } = req.query;
  if (!columnId) return res.status(400).json({ error: 'columnId required' });
  const cards = db.prepare('SELECT * FROM cards WHERE column_id = ? ORDER BY position').all(columnId) as Card[];
  res.json(cards);
});

router.post('/', (req: Request, res: Response) => {
  const db = getDb();
  const { column_id, title, description, priority = 'medium', assignee, progress = 0 } = req.body;
  if (!column_id || !title) return res.status(400).json({ error: 'column_id and title required' });

  const progressVal = Math.max(0, Math.min(100, Number(progress) || 0));
  const maxPos = (db.prepare('SELECT MAX(position) as maxp FROM cards WHERE column_id = ?').get(column_id) as { maxp: number | null }).maxp;
  const position = (maxPos ?? -1) + 1;

  const result = db.prepare(
    'INSERT INTO cards (column_id, title, description, priority, assignee, progress, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(column_id, title, description || null, priority, assignee || null, progressVal, position);

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid) as Card;
  broadcast({ type: 'card:created', boardId: 1 });
  res.status(201).json(card);
});

router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { title, description, priority, assignee, progress } = req.body;

  const fields: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined)       { fields.push('title = ?');       values.push(title || null); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description || null); }
  if (priority !== undefined)    { fields.push('priority = ?');    values.push(priority); }
  if (assignee !== undefined)    { fields.push('assignee = ?');    values.push(assignee || null); }
  if (progress !== undefined)    { fields.push('progress = ?');    values.push(Math.max(0, Math.min(100, Number(progress) || 0))); }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push("updated_at = datetime('now')");
  values.push(req.params.id);

  db.prepare(`UPDATE cards SET ${fields.join(', ')} WHERE id = ?`).run(...values as Parameters<typeof db.prepare>);
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as Card | undefined;
  if (!card) return res.status(404).json({ error: 'Card not found' });
  broadcast({ type: 'card:updated', boardId: 1 });
  res.json(card);
});

router.patch('/:id/move', (req: Request, res: Response) => {
  const db = getDb();
  const { column_id, position } = req.body;
  if (column_id === undefined) return res.status(400).json({ error: 'column_id required' });

  const moveCard = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as Card | undefined;
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

    return db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as Card;
  });

  const result = moveCard();
  if ('error' in result) return res.status(result.status).json({ error: result.error });
  broadcast({ type: 'card:moved', boardId: 1 });
  res.json(result);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Card not found' });
  broadcast({ type: 'card:deleted', boardId: 1 });
  res.json({ success: true });
});

export default router;
