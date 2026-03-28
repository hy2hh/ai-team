import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { Board, Column, Card } from '../types';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const db = getDb();
  const boards = db.prepare('SELECT * FROM boards ORDER BY id').all() as Board[];
  res.json(boards);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(req.params.id) as Board | undefined;
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(board.id) as Column[];
  const result = columns.map((col) => {
    const cards = db.prepare('SELECT * FROM cards WHERE column_id = ? ORDER BY position').all(col.id) as Card[];
    return { ...col, cards };
  });

  res.json({ ...board, columns: result });
});

export default router;
