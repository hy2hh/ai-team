import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { Card } from '../types';

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
  res.status(201).json(card);
});

router.patch('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { title, description, priority, assignee, progress } = req.body;
  const progressVal = progress !== undefined ? Math.max(0, Math.min(100, Number(progress) || 0)) : null;
  db.prepare(
    'UPDATE cards SET title = COALESCE(?, title), description = COALESCE(?, description), priority = COALESCE(?, priority), assignee = COALESCE(?, assignee), progress = COALESCE(?, progress), updated_at = datetime(\'now\') WHERE id = ?'
  ).run(title || null, description || null, priority || null, assignee || null, progressVal, req.params.id);
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as Card | undefined;
  if (!card) return res.status(404).json({ error: 'Card not found' });
  res.json(card);
});

router.patch('/:id/move', (req: Request, res: Response) => {
  const db = getDb();
  const { column_id, position } = req.body;
  if (column_id === undefined) return res.status(400).json({ error: 'column_id required' });

  const moveCard = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as Card | undefined;
    if (!existing) return null;

    // position이 명시되지 않으면 대상 컬럼의 마지막 위치에 추가
    let newPosition = position;
    if (newPosition === undefined || newPosition === null) {
      const maxPos = (db.prepare('SELECT MAX(position) as maxp FROM cards WHERE column_id = ? AND id != ?').get(column_id, req.params.id) as { maxp: number | null }).maxp;
      newPosition = (maxPos ?? -1) + 1;
    }

    db.prepare(
      'UPDATE cards SET column_id = ?, position = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(column_id, newPosition, req.params.id);

    return db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as Card;
  });

  const card = moveCard();
  if (!card) return res.status(404).json({ error: 'Card not found' });
  res.json(card);
});

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const result = db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Card not found' });
  res.json({ success: true });
});

export default router;
